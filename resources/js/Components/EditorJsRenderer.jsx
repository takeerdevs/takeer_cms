import React from 'react';

function parseEditorData(data) {
    if (!data) return { blocks: [] };

    if (typeof data === 'object' && Array.isArray(data.blocks)) {
        return data;
    }

    try {
        const parsed = JSON.parse(data);
        if (parsed && Array.isArray(parsed.blocks)) {
            return parsed;
        }
    } catch {
        return { blocks: [] };
    }

    return { blocks: [] };
}

function sanitizeInlineHtml(html) {
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

function renderListItems(items = []) {
    return items.map((item, index) => {
        if (typeof item === 'string') {
            return <li key={`li-${index}`} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(item) }} />;
        }

        const content = item?.content || '';
        const nested = Array.isArray(item?.items) ? item.items : [];

        return (
            <li key={`li-${index}`}>
                <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(content) }} />
                {nested.length > 0 && <ul className="mt-2 list-disc pl-5 space-y-1">{renderListItems(nested)}</ul>}
            </li>
        );
    });
}

export default function EditorJsRenderer({ data }) {
    const parsed = parseEditorData(data);

    return (
        <div className="space-y-5 leading-8">
            {parsed.blocks.map((block, index) => {
                const key = `${block.type || 'block'}-${index}`;
                const blockData = block.data || {};

                if (block.type === 'header') {
                    const level = Math.min(Math.max(Number(blockData.level || 2), 1), 4);
                    const className = level <= 2 ? 'text-2xl font-black mt-6' : 'text-xl font-black mt-5';

                    if (level === 1) return <h1 key={key} className={className} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(blockData.text || '') }} />;
                    if (level === 2) return <h2 key={key} className={className} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(blockData.text || '') }} />;
                    if (level === 3) return <h3 key={key} className={className} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(blockData.text || '') }} />;
                    return <h4 key={key} className={className} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(blockData.text || '') }} />;
                }

                if (block.type === 'paragraph') {
                    return <p key={key} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(blockData.text || '') }} />;
                }

                if (block.type === 'list') {
                    const style = blockData.style === 'ordered' ? 'list-decimal' : 'list-disc';
                    return (
                        <ul key={key} className={`${style} pl-5 space-y-2`}>
                            {renderListItems(blockData.items || [])}
                        </ul>
                    );
                }

                if (block.type === 'checklist') {
                    const items = Array.isArray(blockData.items) ? blockData.items : [];
                    return (
                        <ul key={key} className="space-y-2">
                            {items.map((item, itemIndex) => (
                                <li key={`${key}-check-${itemIndex}`} className="flex items-start gap-2">
                                    <input type="checkbox" checked={Boolean(item.checked)} readOnly className="mt-1" />
                                    <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(item.text || '') }} />
                                </li>
                            ))}
                        </ul>
                    );
                }

                if (block.type === 'quote') {
                    return (
                        <blockquote key={key} className="border-l-4 border-brand-300 pl-4 italic text-muted-foreground">
                            <div dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(blockData.text || '') }} />
                            {blockData.caption ? <cite className="mt-2 block text-xs not-italic text-muted-foreground">- {blockData.caption}</cite> : null}
                        </blockquote>
                    );
                }

                if (block.type === 'delimiter') {
                    return <hr key={key} className="border-border/70 my-6" />;
                }

                if (block.type === 'image') {
                    const imageUrl = blockData.file?.url || blockData.url;
                    if (!imageUrl) return null;

                    return (
                        <figure key={key} className="space-y-2">
                            <img src={imageUrl} alt={blockData.caption || 'Content image'} className="w-full rounded-2xl border object-cover" />
                            {blockData.caption ? <figcaption className="text-xs text-muted-foreground">{blockData.caption}</figcaption> : null}
                        </figure>
                    );
                }

                if (block.type === 'embed') {
                    const source = blockData.source || blockData.embed;
                    if (!source) return null;
                    return (
                        <a
                            key={key}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-muted/40"
                        >
                            {blockData.caption || source}
                        </a>
                    );
                }

                return null;
            })}
        </div>
    );
}

