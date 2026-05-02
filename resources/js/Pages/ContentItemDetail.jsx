import React, { useEffect, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Loader2, Lock, ShieldCheck, Store, Zap } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import EditorJsRenderer from '@/Components/EditorJsRenderer';
import axios from 'axios';
import { toast } from 'sonner';

export default function ContentItemDetail({ contentItem, hasAccess, previewBody }) {
    const [secureBody, setSecureBody] = useState(null);
    const [secureFileUrl, setSecureFileUrl] = useState(null);
    const [loadingBody, setLoadingBody] = useState(false);
    const merchant = contentItem?.merchant || {};
    const checkoutItem = {
        ...contentItem,
        checkoutType: 'content_item',
        merchant,
    };
    const isShortForm = contentItem?.format === 'plain_text';
    const resolvedTitle = contentItem?.title || (isShortForm ? 'Short Form Content' : 'Content');

    useEffect(() => {
        if (!hasAccess) return;

        let active = true;

        async function loadSecureBody() {
            setLoadingBody(true);
            try {
                const linkRes = await axios.post(`/api/content-items/${contentItem.id}/access-link`);
                const bodyRes = await axios.get(linkRes.data.url, {
                    headers: { Accept: 'application/json' },
                });

                if (active) {
                    setSecureBody(bodyRes.data?.body || '');
                    setSecureFileUrl(bodyRes.data?.file_url || null);
                }
            } catch (error) {
                if (active) {
                    toast.error('Imeshindwa kufungua content securely.');
                }
            } finally {
                if (active) {
                    setLoadingBody(false);
                }
            }
        }

        loadSecureBody();

        return () => {
            active = false;
        };
    }, [contentItem.id, hasAccess]);

    function sanitizeHtml(html) {
        if (typeof window === 'undefined') return String(html || '');
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
        const root = doc.body.firstElementChild;
        if (!root) return '';

        root.querySelectorAll('script,style,iframe,object,embed,form').forEach((node) => node.remove());
        root.querySelectorAll('*').forEach((el) => {
            [...el.attributes].forEach((attr) => {
                const name = attr.name.toLowerCase();
                const value = (attr.value || '').toLowerCase();
                if (name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                    return;
                }
                if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return root.innerHTML;
    }

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            <Head title={`${resolvedTitle} | Takeer`} />

            <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
                <Link href={merchant?.slug ? `/m/${merchant.slug}` : '/'} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back to store
                </Link>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[28px] border bg-card p-6 md:p-8">
                        <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">{resolvedTitle}</h1>
                        <p className="mt-4 text-base leading-8 text-muted-foreground">{contentItem.excerpt || (isShortForm ? 'Premium short-form content.' : 'Premium long-form knowledge content.')}</p>

                        <div className="mt-8 prose prose-sm max-w-none text-foreground">
                            {hasAccess ? (
                                loadingBody ? (
                                    <div className="rounded-3xl border border-dashed p-10 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-brand-600 mx-auto mb-3" />
                                        <p className="text-sm text-muted-foreground">Opening secure content...</p>
                                    </div>
                                ) : (
                                    <>
                                        {secureFileUrl && (
                                            <div className="mb-5 rounded-3xl border border-brand-200 bg-brand-50/60 p-5">
                                                <p className="text-sm font-black text-brand-900">Lesson file is ready</p>
                                                <p className="mt-1 text-sm text-brand-800/75">Open the file using the secure link below.</p>
                                                <a
                                                    href={secureFileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-brand-600 px-5 text-sm font-black text-white"
                                                >
                                                    Open lesson file
                                                </a>
                                            </div>
                                        )}
                                        {contentItem.format === 'editorjs' ? (
                                            <EditorJsRenderer data={secureBody} />
                                        ) : contentItem.format === 'html' ? (
                                            <div className="leading-8" dangerouslySetInnerHTML={{ __html: sanitizeHtml(secureBody || '') }} />
                                        ) : (
                                            <div className="whitespace-pre-wrap leading-8">{secureBody || ''}</div>
                                        )}
                                    </>
                                )
                            ) : (
                                <>
                                    <div className="whitespace-pre-wrap leading-8">{previewBody}</div>
                                    <div className="mt-6 rounded-3xl border border-dashed border-brand-200 bg-brand-50/60 p-6 text-center">
                                        <Lock className="h-6 w-6 text-brand-600 mx-auto mb-3" />
                                        <p className="font-black text-lg">Full content is locked</p>
                                        <p className="text-sm text-muted-foreground mt-2">Buy this article or join the required subscription tier to unlock everything.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-[28px] border bg-card p-6">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center">
                                    <Store className="h-5 w-5 text-brand-600" />
                                </div>
                                <div>
                                    <p className="font-black">{merchant.display_name || merchant.name}</p>
                                    <p className="text-sm text-muted-foreground">@{merchant.slug || merchant.username || 'merchant'}</p>
                                </div>
                            </div>

                            <div className="mt-6 rounded-2xl bg-accent/40 px-4 py-4">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Price</p>
                                <p className="mt-2 text-3xl font-black text-brand-600">TZS {Number(contentItem.price || 0).toLocaleString()}</p>
                            </div>

                            {!hasAccess && (
                                <Button className="w-full mt-5 h-12 rounded-2xl font-black" onClick={() => window.__openCheckout?.(checkoutItem)}>
                                    <Zap className="mr-2 h-4 w-4" />
                                    Unlock Content
                                </Button>
                            )}
                        </div>

                        <div className="rounded-[28px] border border-green-200 bg-green-50/70 p-5 flex gap-3">
                            <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-1" />
                            <p className="text-sm leading-7 text-green-900">
                                Takeer supports educational and business content only. This page is built for premium knowledge, not adult or political material.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
