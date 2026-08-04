import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CircleStop, Loader2, Search, Send, Sparkles, X } from 'lucide-react';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';
import AiProductCard from '@/Components/AiProductCard';

const statusCopy = (state, copy) => ({
    thinking: copy('Thinking through your request…', 'Nafikiria ombi lako…'),
    writing: copy('Finding the right products…', 'Natafuta bidhaa zinazofaa…'),
}[state] || copy('Takeer AI is ready', 'Takeer AI iko tayari'));

function parseSseFrame(frame) {
    let event = 'message';
    const data = [];
    frame.split(/\r?\n/).forEach((line) => {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    });
    if (data.length === 0) return null;
    try {
        return { event, data: JSON.parse(data.join('\n')) };
    } catch {
        return null;
    }
}

export default function SearchOverlay({ isOpen, onClose }) {
    const { t, copy } = useLocale();
    const [query, setQuery] = useState('');
    const [stage, setStage] = useState('idle'); // idle, checking, chat, denied
    const [access, setAccess] = useState(null);
    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [streaming, setStreaming] = useState(false);
    const [status, setStatus] = useState('');
    const [toolStatus, setToolStatus] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [pendingQuery, setPendingQuery] = useState('');
    const [claimingFree, setClaimingFree] = useState(false);
    const inputRef = useRef(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return undefined;
        setQuery('');
        setStage('idle');
        setAccess(null);
        setMessages([]);
        setConversationId(null);
        setStreaming(false);
        setStatus('');
        setToolStatus(null);
        setErrorMessage('');
        setPendingQuery('');
        setClaimingFree(false);
        const timeout = window.setTimeout(() => inputRef.current?.focus(), 120);
        return () => window.clearTimeout(timeout);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, streaming, toolStatus]);

    const handleClassicSearch = (value = query || pendingQuery) => {
        const nextQuery = String(value || '').trim();
        if (!nextQuery) {
            inputRef.current?.focus();
            return;
        }
        onClose?.();
        router.get('/search', { q: nextQuery, page: 1 });
    };

    const removeEmptyAssistant = () => {
        setMessages((current) => {
            const last = current[current.length - 1];
            if (last?.role === 'assistant' && !last.content && !(last.blocks || []).length) return current.slice(0, -1);
            return current;
        });
    };

    const checkAccess = async (nextQuery = '') => {
        setStage('checking');
        setPendingQuery(nextQuery);
        setErrorMessage('');
        try {
            const response = await axios.get('/ai/access', { params: { task: 'ai_search' } });
            const result = response.data || {};
            setAccess(result);
            if (result.allowed) {
                setStage('chat');
                return true;
            }
            setStage('denied');
            return false;
        } catch (error) {
            const result = error.response?.data?.access || { allowed: false, reason: error.response?.data?.code || 'feature_unavailable' };
            setAccess(result);
            setStage('denied');
            return false;
        }
    };

    const claimFreeCredits = async () => {
        if (claimingFree) return;
        const nextQuery = String(pendingQuery || query || '').trim();
        setClaimingFree(true);
        setErrorMessage('');
        try {
            const response = await axios.post('/api/ai/claim-free');
            const result = response.data || {};
            setAccess(result.access || access);
            if (result.access?.allowed) {
                setStage('chat');
                setPendingQuery('');
                if (nextQuery) await streamMessage(nextQuery);
            } else {
                setStage('denied');
            }
        } catch (error) {
            const result = error.response?.data || {};
            if (result.access) setAccess(result.access);
            setErrorMessage(result.message || copy('Free AI credits could not be claimed.', 'Free AI credits hazikuweza kudaiwa.'));
        } finally {
            setClaimingFree(false);
        }
    };

    const appendBlockToLastAssistant = (block) => {
        setMessages((current) => {
            const next = [...current];
            for (let index = next.length - 1; index >= 0; index -= 1) {
                if (next[index].role === 'assistant') {
                    next[index] = { ...next[index], blocks: [...(next[index].blocks || []), block] };
                    break;
                }
            }
            return next;
        });
    };

    const streamMessage = async (message, historySource = messages) => {
        const history = historySource
            .filter((item) => item.role === 'user' || item.role === 'assistant')
            .map((item) => ({ role: item.role, content: item.content || '' }))
            .filter((item) => item.content.trim());
        const userMessage = { role: 'user', content: message };
        const assistantMessage = { role: 'assistant', content: '', blocks: [] };
        setMessages((current) => [...current, userMessage, assistantMessage]);
        setQuery('');
        setStreaming(true);
        setStatus('thinking');
        setToolStatus(null);
        setErrorMessage('');

        try {
            const response = await fetch('/api/ai/search/chat', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'text/event-stream',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ message, history, conversation_id: conversationId }),
            });

            if (!response.ok) {
                let data = {};
                try { data = await response.json(); } catch { /* handled below */ }
                const error = new Error(data.message || copy('AI search is unavailable.', 'AI search haipatikani.'));
                error.status = response.status;
                error.data = data;
                throw error;
            }
            if (!response.body) throw new Error('Streaming is not supported by this browser.');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finished = false;
            const processEvent = ({ event, data }) => {
                if (event === 'ready') {
                    setConversationId(data.conversation_id || null);
                } else if (event === 'status') {
                    setStatus(data.state || 'thinking');
                } else if (event === 'message') {
                    setMessages((current) => {
                        const next = [...current];
                        const last = next.length - 1;
                        if (next[last]?.role === 'assistant') next[last] = { ...next[last], content: `${next[last].content || ''}${data.delta || ''}` };
                        return next;
                    });
                } else if (event === 'tool') {
                    setToolStatus(data.state === 'complete' ? null : data.name);
                } else if (event === 'ui') {
                    appendBlockToLastAssistant(data);
                } else if (event === 'error') {
                    removeEmptyAssistant();
                    setErrorMessage(data.message || copy('AI search failed.', 'AI search imeshindikana.'));
                    setPendingQuery(message);
                } else if (event === 'done') {
                    finished = true;
                }
            };

            while (!finished) {
                const { value, done } = await reader.read();
                buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
                buffer = buffer.replace(/\r\n/g, '\n');
                let separator = buffer.indexOf('\n\n');
                while (separator !== -1) {
                    const frame = buffer.slice(0, separator);
                    buffer = buffer.slice(separator + 2);
                    const parsed = parseSseFrame(frame);
                    if (parsed) processEvent(parsed);
                    separator = buffer.indexOf('\n\n');
                }
                if (done) break;
            }
        } catch (error) {
            removeEmptyAssistant();
            if (error.status === 401 || error.status === 402) {
                setAccess(error.data?.access || { allowed: false, reason: 'subscription_required' });
                setPendingQuery(message);
                setStage('denied');
            } else {
                setErrorMessage(error.message || copy('AI search is temporarily unavailable.', 'AI search haipatikani kwa sasa.'));
                setPendingQuery(message);
            }
        } finally {
            setStreaming(false);
            setToolStatus(null);
            setStatus('');
        }
    };

    const retryMessage = async () => {
        const message = String(pendingQuery || '').trim();
        if (!message || streaming) return;

        let retryHistory = [...messages];
        const last = retryHistory[retryHistory.length - 1];
        if (last?.role === 'assistant') retryHistory = retryHistory.slice(0, -1);
        const lastAfterAssistant = retryHistory[retryHistory.length - 1];
        if (lastAfterAssistant?.role === 'user' && lastAfterAssistant.content === message) retryHistory = retryHistory.slice(0, -1);

        setMessages(retryHistory);
        setErrorMessage('');
        setPendingQuery('');
        await streamMessage(message, retryHistory);
    };

    const handleSend = async (event, value = null) => {
        event?.preventDefault();
        const message = String(value ?? query).trim();
        if (!message || streaming) return;

        if (stage !== 'chat' || !access?.allowed) {
            const allowed = await checkAccess(message);
            if (!allowed) return;
        }
        await streamMessage(message);
    };

    const handleComposerKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend(event);
        }
    };

    const openProduct = (product) => {
        onClose?.();
        router.get(product?.url || `/product/${product?.slug || product?.id}`);
    };

    const buyProduct = (product) => {
        window.__openCheckout?.({ ...product, checkout_price: product?.checkout_price ?? product?.price });
    };

    if (!isOpen) return null;

    const hasConversation = messages.length > 0;
    const accessReason = access?.reason;
    const denialTitle = accessReason === 'credits_required' || accessReason === 'allowance_exhausted'
        ? copy('Your AI allowance is used up', 'Credits za AI zimekwisha')
        : copy('AI search is a separate experience', 'AI search ni huduma maalum');
    const freeClaim = access?.free_claim;
    const freeCreditAmount = Number(freeClaim?.credits || 0).toLocaleString();
    const freeClaimExpiry = freeClaim?.window_end ? new Date(freeClaim.window_end).toLocaleDateString() : null;
    const freeClaimFrequency = ({ daily: copy('daily', 'kila siku'), weekly: copy('weekly', 'kila wiki'), monthly: copy('monthly', 'kila mwezi'), once: copy('once', 'mara moja') }[freeClaim?.frequency] || copy('current', 'window hii'));

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex flex-col bg-background/60 backdrop-blur-2xl"
                >
                    <div className="flex shrink-0 justify-end p-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50 transition-colors hover:bg-accent"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden px-4">
                        <main ref={scrollRef} className="relative flex-1 overflow-y-auto">
                            {!hasConversation && (stage === 'idle' || stage === 'chat') && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex min-h-full flex-col items-center justify-center pb-24 pt-4"
                                >
                                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/20">
                                        <Sparkles className="h-7 w-7" />
                                    </div>
                                    <h2 className="mb-2 text-center text-3xl font-black text-foreground">{stage === 'chat' ? copy('Ask Takeer AI anything', 'Uliza Takeer AI chochote') : t('components.searchHeading')}</h2>
                                    <p className="max-w-lg text-center text-sm leading-6 text-muted-foreground">{copy('Ask naturally and get products from Takeer, or search normally with the words you enter.', 'Uliza kwa kawaida upate bidhaa kutoka Takeer, au tafuta kwa maneno utakayoingiza.')}</p>
                                </motion.div>
                            )}

                            {stage === 'checking' && !hasConversation && (
                                <div className="flex min-h-full items-center justify-center pb-24 pt-4">
                                    <div className="flex items-center gap-3 text-muted-foreground">
                                        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                                        <span className="font-medium">{copy('Checking AI search access…', 'Inaangalia ufikiaji wa AI search…')}</span>
                                    </div>
                                </div>
                            )}

                            {stage === 'denied' && !hasConversation && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex min-h-full items-center justify-center pb-24 pt-4"
                                >
                                    <div className="w-full max-w-lg rounded-3xl border border-brand-200 bg-brand-50/80 p-6 shadow-xl">
                                        <div className="flex items-start gap-3">
                                            <div className="rounded-2xl bg-brand-600 p-3 text-white"><Sparkles className="h-5 w-5" /></div>
                                            <div>
                                                <h3 className="text-lg font-black text-foreground">{denialTitle}</h3>
                                                <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy('AI search uses a separate subscription and credit allowance. You can continue with normal search at any time.', 'AI search hutumia subscription na credits zake. Unaweza kuendelea na search ya kawaida wakati wowote.')}</p>
                                            </div>
                                        </div>
                                        {freeClaim?.can_claim && (
                                            <div className="mt-5 rounded-2xl border border-brand-200 bg-background/80 p-4">
                                                <p className="text-sm font-black text-foreground">{copy(`Claim ${freeCreditAmount} free AI credits`, `Chukua credits ${freeCreditAmount} za AI bure`)}</p>
                                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{freeClaimExpiry ? copy(`Use them before ${freeClaimExpiry}. Your free allowance resets in the next window.`, `Zitumie kabla ya ${freeClaimExpiry}. Allowance yako ya bure itajirekebisha kwenye window inayofuata.`) : copy('Your free allowance is available for this window.', 'Allowance yako ya bure inapatikana kwenye window hii.')}</p>
                                            </div>
                                        )}
                                        {freeClaim && !freeClaim.can_claim && freeClaim.window_end && (
                                            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                                                <p className="text-sm font-black text-foreground">{copy(`Your ${freeClaimFrequency} AI allowance is already active.`, `Allowance yako ya AI ya ${freeClaimFrequency} tayari iko active.`)}</p>
                                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy(`You can claim or use the next allowance after ${freeClaimExpiry}.`, `Utaweza kudai au kutumia allowance inayofuata baada ya ${freeClaimExpiry}.`)}</p>
                                            </div>
                                        )}
                                        {errorMessage && <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">{errorMessage}</p>}
                                        <div className="mt-5 flex flex-wrap gap-2">
                                            {freeClaim?.can_claim && <button type="button" onClick={claimFreeCredits} disabled={claimingFree} className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70">{claimingFree ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {claimingFree ? copy('Adding credits…', 'Inaongeza credits…') : copy('Claim free credits', 'Chukua credits za bure')}</button>}
                                            <button type="button" onClick={() => handleClassicSearch()} className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700">{copy('Continue with classic search', 'Endelea na search ya kawaida')} <ArrowRight className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {hasConversation && (
                                <div className="mx-auto w-full max-w-3xl space-y-5 px-1 pb-36 pt-2 sm:px-4 sm:pt-4">
                                    {messages.map((message, index) => message.role === 'user' ? (
                                        <div key={`user-${index}`} className="flex justify-end">
                                            <div className="max-w-[86%] rounded-3xl rounded-br-md bg-brand-600 px-4 py-3 text-sm font-medium leading-6 text-white shadow-md shadow-brand-500/10 sm:max-w-[72%]">{message.content}</div>
                                        </div>
                                    ) : (
                                        <div key={`assistant-${index}`} className="flex items-start gap-3">
                                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"><Sparkles className="h-4 w-4" /></div>
                                            <div className="min-w-0 max-w-[94%] flex-1">
                                                <div className="rounded-3xl rounded-tl-md border border-brand-100 bg-brand-50/80 px-4 py-3 text-sm leading-6 text-foreground shadow-sm sm:px-5">{message.content || (streaming && index === messages.length - 1 ? <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" /></span> : null)}</div>
                                                {(message.blocks || []).map((block, blockIndex) => block.type === 'product_carousel' ? (
                                                    <div key={`${index}-${blockIndex}`} className="mt-3">
                                                        <div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{block.title}</p><span className="text-[11px] font-bold text-muted-foreground">{block.products?.length || 0} {copy('results', 'matokeo')}</span></div>
                                                        <div className="flex gap-3 overflow-x-auto pb-2">{(block.products || []).map((product) => <AiProductCard key={product.id} product={product} onView={openProduct} onBuy={buyProduct} />)}</div>
                                                    </div>
                                                ) : block.type === 'product_detail' ? (
                                                    <div key={`${index}-${blockIndex}`} className="mt-3 rounded-2xl border border-border bg-background p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{copy('Product details', 'Maelezo ya bidhaa')}</p><p className="mt-1 font-black text-foreground">{block.product?.title}</p><p className="mt-1 text-sm text-muted-foreground">{block.product?.description || copy('Details are available on the product page.', 'Maelezo zaidi yapo kwenye ukurasa wa bidhaa.')}</p><button type="button" onClick={() => openProduct(block.product)} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-brand-700">{copy('Open product', 'Fungua bidhaa')} <ArrowRight className="h-3.5 w-3.5" /></button></div>
                                                ) : null)}
                                            </div>
                                        </div>
                                    ))}
                                    {toolStatus && <div className="pl-11 text-xs font-bold text-muted-foreground"><Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" /> {toolStatus === 'search_products' ? copy('Searching Takeer catalog…', 'Natafuta kwenye catalog ya Takeer…') : copy('Checking product details…', 'Naangalia maelezo ya bidhaa…')}</div>}
                                    {status && streaming && <div className="pl-11 text-xs font-medium text-muted-foreground">{statusCopy(status, copy)}</div>}
                                    {errorMessage && <div className="ml-11 flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"><CircleStop className="h-4 w-4 shrink-0" /> <span>{errorMessage}</span>{pendingQuery && <button type="button" onClick={retryMessage} className="font-black underline">{copy('Try again', 'Jaribu tena')}</button>}<button type="button" onClick={() => handleClassicSearch(pendingQuery)} className="font-black underline">{copy('Use classic search', 'Tumia search ya kawaida')}</button></div>}
                                </div>
                            )}
                        </main>

                        <motion.div layout className={cn('w-full', hasConversation ? 'absolute bottom-5 left-0 right-0 px-1 bg-gradient-to-t from-background via-background/90 to-transparent pt-8 sm:px-4' : 'pb-5')}>
                            <form onSubmit={handleSend} className="relative mx-auto w-full max-w-lg group">
                                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-brand-500" />
                                <textarea ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleComposerKeyDown} rows={1} placeholder={t('components.searchPlaceholder')} className="min-h-[58px] w-full resize-none rounded-3xl border border-border bg-accent/60 py-4 pl-12 pr-14 text-base leading-6 text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground focus:border-brand-500 focus:bg-background focus:ring-4 focus:ring-brand-500/20" />
                                {query.trim() && <button type="submit" disabled={streaming} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-brand-600 text-white shadow-md transition-all hover:bg-brand-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">{streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="ml-0.5 h-4 w-4" />}</button>}
                            </form>
                            {!hasConversation && <div className="mx-auto mt-4 flex w-full max-w-lg flex-wrap justify-center gap-2"><button type="button" onClick={() => checkAccess()} className="inline-flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-100"><Sparkles className="h-4 w-4" /> {copy('Use AI search', 'Tumia AI search')}</button><button type="button" onClick={() => handleClassicSearch()} disabled={!query.trim()} className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">{copy('Search normally', 'Tafuta kawaida')}</button></div>}
                            <p className="mt-2 text-center text-[10px] font-medium text-muted-foreground">{copy('Takeer AI uses catalog data only. Always review product details before buying.', 'Takeer AI hutumia data ya catalog pekee. Kagua maelezo kabla ya kununua.')}</p>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
