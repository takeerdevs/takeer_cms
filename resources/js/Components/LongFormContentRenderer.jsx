import React from 'react';
import MarkdownIt from 'markdown-it';
import { isLexicalDocument, parseLexicalState } from '@/lib/longFormContent';

const markdownRenderer = new MarkdownIt({html: false, linkify: true});
markdownRenderer.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
    tokens[index].attrSet('target', '_blank');
    tokens[index].attrSet('rel', 'noopener noreferrer');
    return renderer.renderToken(tokens, index, options);
};

function safeUrl(value) {
    const url = String(value || '').trim();
    if (!url) return null;
    try {
        const parsed = new URL(url, typeof window === 'undefined' ? 'http://takeer.local' : window.location.origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        return parsed.href;
    } catch {
        return null;
    }
}

function readableForeground(background) {
    const value = String(background || '').trim();
    const shortHex = value.match(/^#([0-9a-f]{3})$/i);
    const longHex = value.match(/^#([0-9a-f]{6})$/i);
    const rgbMatch = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
    let rgb = [247, 247, 248];
    if (shortHex) rgb = shortHex[1].split('').map((part) => parseInt(part + part, 16));
    if (longHex) rgb = [0, 2, 4].map((offset) => parseInt(longHex[1].slice(offset, offset + 2), 16));
    if (rgbMatch) rgb = rgbMatch.slice(1, 4).map(Number);
    const [red, green, blue] = rgb.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return ((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) > 0.42 ? '#111827' : '#ffffff';
}

function textNode(node, key) {
    const format = Number(node.format || 0);
    let content = node.text || '';
    if (!content) return <React.Fragment key={key} />;
    if (format & 16) content = <code>{content}</code>;
    if (format & 1) content = <strong>{content}</strong>;
    if (format & 2) content = <em>{content}</em>;
    if (format & 4) content = <s>{content}</s>;
    if (format & 8) content = <u>{content}</u>;
    return <React.Fragment key={key}>{content}</React.Fragment>;
}

function renderCard(node, key) {
    const data = node.data && typeof node.data === 'object' ? node.data : {};
    const label = {
        audio: 'Audio',
        bookmark: 'Bookmark',
        button: 'Button',
        email_cta: 'Call to action',
        file: 'File',
        gallery: 'Gallery',
        gif: 'GIF',
        header: 'Header',
        html: 'HTML',
        markdown: 'Markdown',
        nft: 'NFT',
        product: 'Product',
        toggle: 'Toggle',
        video: 'Video',
    }[node.cardType] || data.provider || 'Content card';

    if (node.cardType === 'image' && data.src) {
        return (
            <figure key={key} className="my-5 space-y-2">
                <img src={data.src} alt={data.alt || 'Content image'} className="w-full rounded-2xl border object-contain" />
                {data.caption ? <figcaption className="text-center text-xs text-muted-foreground">{data.caption}</figcaption> : null}
            </figure>
        );
    }

    if (node.cardType === 'gallery') {
        const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
        if (!images.length) return null;
        return (
            <figure key={key} className="my-5 space-y-2">
                <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-2xl border sm:grid-cols-3">
                    {images.map((src, index) => <img key={`${src}-${index}`} src={src} alt="" className="aspect-square w-full object-cover" />)}
                </div>
                {data.caption ? <figcaption className="text-center text-xs text-muted-foreground">{data.caption}</figcaption> : null}
            </figure>
        );
    }

    if (node.cardType === 'gif') {
        const src = safeUrl(data.url || data.src);
        return src ? <figure key={key} className="my-5 space-y-2"><img src={src} alt={data.alt || ''} className="max-h-[640px] w-full rounded-2xl border object-contain" />{data.caption ? <figcaption className="text-center text-xs text-muted-foreground">{data.caption}</figcaption> : null}</figure> : null;
    }

    if (node.cardType === 'video') {
        const src = safeUrl(data.src || data.url);
        return src ? <figure key={key} className="my-5 space-y-2"><video controls loop={Boolean(data.loop)} poster={safeUrl(data.thumbnail) || undefined} src={src} className="max-h-[640px] w-full rounded-2xl bg-black" />{data.caption ? <figcaption className="text-center text-xs text-muted-foreground">{data.caption}</figcaption> : null}</figure> : null;
    }

    if (node.cardType === 'audio') {
        const src = safeUrl(data.src || data.url);
        return src ? <figure key={key} className="my-5 rounded-xl border p-4"><figcaption className="mb-2 font-semibold">{data.title || 'Audio'}</figcaption><audio controls src={src} className="w-full" />{data.caption ? <p className="mt-2 text-xs text-muted-foreground">{data.caption}</p> : null}</figure> : null;
    }

    if (node.cardType === 'file') {
        const src = safeUrl(data.src || data.url);
        return src ? <a key={key} href={src} target="_blank" rel="noopener noreferrer" className="my-5 block rounded-xl border p-4 hover:bg-muted/30"><span className="font-semibold">{data.title || data.name || 'Download file'}</span>{data.description ? <span className="mt-1 block text-sm text-muted-foreground">{data.description}</span> : null}</a> : null;
    }

    if (node.cardType === 'embed' || node.cardType === 'bookmark') {
        const url = safeUrl(data.url);
        if (!url) return null;
        return (
            <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="my-4 block rounded-xl border px-5 py-4 hover:bg-muted/40">
                <span className="font-semibold">{data.title || data.provider || url}</span>
                {data.description ? <span className="mt-1 block text-sm text-muted-foreground">{data.description}</span> : null}
            </a>
        );
    }

    if (node.cardType === 'callout') {
        const background = data.background || '#eaf6ff';
        return <aside key={key} className="my-5 rounded-2xl border px-4 py-3 text-sm font-semibold" style={{backgroundColor: background, color: readableForeground(background)}}>{data.showEmoji !== false ? `${data.emoji || '💡'} ` : ''}{data.text || ''}</aside>;
    }

    if (node.cardType === 'divider') return <hr key={key} className="my-6 border-border/70" />;
    if (node.cardType === 'button') {
        const url = safeUrl(data.url);
        return url && data.text?.trim() ? <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="my-4 inline-flex rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background">{data.text}</a> : null;
    }
    if (node.cardType === 'toggle') {
        return <details key={key} className="my-4 rounded-xl border px-4 py-3"><summary className="cursor-pointer font-semibold">{data.title || 'Toggle content'}</summary><p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{data.content || ''}</p></details>;
    }
    if (node.cardType === 'markdown') {
        return <section key={key} className="prose my-5 max-w-none" dangerouslySetInnerHTML={{__html: markdownRenderer.render(data.content || '')}} />;
    }
    if (node.cardType === 'html') {
        return <pre key={key} className="my-5 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-950 px-5 py-4 font-mono text-sm leading-7 text-slate-100"><code>{data.content || ''}</code></pre>;
    }
    if (node.cardType === 'header') {
        const background = data.background || '#000000';
        const layout = ['regular', 'wide', 'full', 'split'].includes(data.layout) ? data.layout : 'regular';
        const sizeClass = layout === 'full' ? 'min-h-[520px] px-12 py-24' : layout === 'wide' ? 'min-h-[400px] px-12 py-20' : layout === 'split' ? 'min-h-[360px] px-10 py-16' : 'min-h-[300px] px-10 py-14';
        const buttonColor = data.buttonColor || '#ffffff';
        return <section key={key} className={`my-7 flex flex-col justify-center ${sizeClass} ${data.alignment === 'center' ? 'items-center text-center' : 'items-start text-left'}`} style={{backgroundColor: background, color: readableForeground(background)}}>{data.text || data.title ? <h2 className="text-4xl font-black">{data.text || data.title}</h2> : null}{data.subheading ? <p className="mt-3 text-xl opacity-75">{data.subheading}</p> : null}{data.showButton && data.buttonText && safeUrl(data.buttonUrl) ? <a href={safeUrl(data.buttonUrl)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex rounded-lg px-6 py-3 text-base font-bold" style={{backgroundColor: buttonColor, color: readableForeground(buttonColor)}}>{data.buttonText}</a> : null}</section>;
    }
    if (node.cardType === 'email_cta') {
        const background = data.background || '#f7f7f8';
        const buttonColor = data.buttonColor || '#111111';
        return <section key={key} className={`my-6 rounded-xl border px-8 py-7 ${data.alignment === 'center' ? 'text-center' : 'text-left'}`} style={{backgroundColor: background, color: readableForeground(background)}}>{data.showSponsor !== false ? <p className="mb-5 border-b border-current/20 pb-3 text-xs font-bold uppercase tracking-wider opacity-60">Sponsored</p> : null}<p className="whitespace-pre-wrap">{data.body || ''}</p>{data.showButton !== false && data.buttonText?.trim() && safeUrl(data.buttonUrl) ? <a href={safeUrl(data.buttonUrl)} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-lg px-4 py-2 text-sm font-bold" style={{backgroundColor: buttonColor, color: readableForeground(buttonColor)}}>{data.buttonText}</a> : null}</section>;
    }
    if (node.cardType === 'product') return <section key={key} className="my-6 overflow-hidden rounded-xl border">{data.image ? <img src={data.image} alt="" className="h-64 w-full object-cover" /> : null}<div className="p-6"><h3 className="text-xl font-bold">{data.title || 'Product'}</h3>{data.showRating !== false ? <p className="mt-2 tracking-widest text-amber-400">★★★★★</p> : null}{data.description ? <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{data.description}</p> : null}{data.showButton !== false && safeUrl(data.buttonUrl) ? <a href={safeUrl(data.buttonUrl)} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background">{data.buttonText || 'Learn more'}</a> : null}</div></section>;
    return <aside key={key} className="my-4 rounded-xl border bg-muted/20 px-4 py-3 text-sm"><p className="font-semibold">{data.title || label}</p>{data.url ? <p className="mt-1 break-all text-muted-foreground">{data.url}</p> : null}</aside>;
}

function renderNodes(nodes, prefix = 'node') {
    if (!Array.isArray(nodes)) return null;

    return nodes.map((node, index) => {
        if (!node || typeof node !== 'object') return null;
        const key = `${prefix}-${index}`;
        const children = renderNodes(node.children, key);

        if (node.type === 'text') return textNode(node, key);
        if (node.type === 'linebreak') return <br key={key} />;
        if (node.type === 'takeer_card') return renderCard(node, key);
        if (node.type === 'paragraph') return <p key={key} className="mb-4 last:mb-0">{children}</p>;
        if (node.type === 'heading') {
            const tag = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tag) ? node.tag : 'h2';
            const Tag = tag;
            return <Tag key={key} className="mb-3 mt-7 text-foreground first:mt-0">{children}</Tag>;
        }
        if (node.type === 'quote') return <blockquote key={key} className="mb-5 border-l-4 border-brand-300 pl-4 italic text-muted-foreground">{children}</blockquote>;
        if (node.type === 'list') {
            const Tag = node.listType === 'number' ? 'ol' : 'ul';
            return <Tag key={key} className={`${node.listType === 'number' ? 'list-decimal' : 'list-disc'} mb-5 ml-5 space-y-1`}>{children}</Tag>;
        }
        if (node.type === 'listitem') return <li key={key}>{children}</li>;
        if (node.type === 'link' || node.type === 'autolink') {
            const url = safeUrl(node.url);
            return url ? <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline underline-offset-2">{children}</a> : children;
        }
        if (node.type === 'root') return children;
        return children;
    });
}

export default function LongFormContentRenderer({ data }) {
    if (!isLexicalDocument(data)) return null;
    const state = parseLexicalState(data);
    return <div className="leading-8">{renderNodes(state.root.children, 'root')}</div>;
}
