import React from 'react';
import {createPortal} from 'react-dom';
import axios from 'axios';
import MarkdownIt from 'markdown-it';
import {
    $applyNodeReplacement,
    $getNodeByKey,
    DecoratorNode,
} from 'lexical';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {useLexicalNodeSelection} from '@lexical/react/useLexicalNodeSelection';
import {
    Bold,
    Camera,
    Code2,
    FileCode2,
    FileUp,
    GalleryHorizontalEnd,
    Heading,
    HelpCircle,
    ImagePlus,
    Italic,
    Link2,
    List,
    ListOrdered,
    Music2,
    Paperclip,
    Pencil,
    Quote,
    SquareChevronDown,
    Underline,
    Video,
    X,
} from 'lucide-react';

const markdownRenderer = new MarkdownIt({
    breaks: false,
    html: false,
    linkify: true,
    typographer: false,
});

markdownRenderer.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
    tokens[index].attrSet('target', '_blank');
    tokens[index].attrSet('rel', 'noopener noreferrer');
    return renderer.renderToken(tokens, index, options);
};

const CARD_LABELS = {
    audio: 'Audio',
    bookmark: 'Bookmark',
    button: 'Button',
    callout: 'Callout',
    divider: 'Divider',
    email_cta: 'Call to action',
    embed: 'Embed',
    file: 'File',
    gallery: 'Gallery',
    gif: 'GIF',
    header: 'Header',
    html: 'HTML',
    image: 'Image',
    markdown: 'Markdown',
    nft: 'NFT',
    product: 'Product',
    toggle: 'Toggle',
    video: 'Video',
};

const UPLOAD_CARD_TYPES = ['image', 'gallery', 'video', 'audio', 'file'];
const PANEL_CARD_TYPES = [
    'audio',
    'bookmark',
    'button',
    'callout',
    'email_cta',
    'embed',
    'file',
    'gallery',
    'gif',
    'header',
    'html',
    'image',
    'markdown',
    'product',
    'toggle',
    'video',
];

const TakeerCardContext = React.createContext({uploadFile: null, uploadStates: {}, bookmarkSearchUrl: null});

export function TakeerCardProvider({children, uploadFile, uploadStates = {}, bookmarkSearchUrl}) {
    const [editor] = useLexicalComposerContext();
    const contextValue = React.useMemo(() => ({
        uploadFile: uploadFile ? (args) => uploadFile({...args, editor}) : null,
        uploadStates,
        bookmarkSearchUrl,
    }), [bookmarkSearchUrl, editor, uploadFile, uploadStates]);

    return (
        <TakeerCardContext.Provider value={contextValue}>
            {children}
        </TakeerCardContext.Provider>
    );
}

function updateCard(editor, nodeKey, data) {
    editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && typeof node.setData === 'function') {
            node.setData(data);
        }
    });
}

function focusPrimaryCardControl(cardElement) {
    const control = cardElement?.querySelector('[data-card-primary-control], textarea, input:not([type="color"]):not([type="file"]):not(.hidden), [contenteditable="true"]');
    if (!control) return;
    control.focus({preventScroll: true});
    if (typeof control.setSelectionRange === 'function') {
        const end = String(control.value || '').length;
        control.setSelectionRange(end, end);
    }
}

function useSettingsPosition(cardRef, panelRef, isOpen) {
    const [position, setPosition] = React.useState(null);

    React.useLayoutEffect(() => {
        if (!isOpen) {
            setPosition(null);
            return undefined;
        }

        const updatePosition = () => {
            const cardElement = cardRef.current;
            const panelElement = panelRef.current;
            if (!cardElement) return;

            const cardRect = cardElement.getBoundingClientRect();
            const panelWidth = panelElement?.offsetWidth || 320;
            const panelHeight = panelElement?.offsetHeight || 280;
            const spacing = 20;
            let left = cardRect.right + spacing;
            let top = cardRect.top + Math.max(0, (cardRect.height - panelHeight) / 2);

            if (left + panelWidth > window.innerWidth - spacing) {
                left = cardRect.left - panelWidth - spacing;
            }
            if (left < spacing) left = spacing;
            if (top + panelHeight > window.innerHeight - spacing) {
                top = window.innerHeight - panelHeight - spacing;
            }
            if (top < spacing) top = spacing;

            setPosition({left, top});
        };

        const frame = requestAnimationFrame(updatePosition);
        const resizeObserver = typeof ResizeObserver !== 'undefined' && panelRef.current
            ? new ResizeObserver(updatePosition)
            : null;
        resizeObserver?.observe(panelRef.current);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            cancelAnimationFrame(frame);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [cardRef, isOpen, panelRef]);

    return position;
}

function GhostInput({label, value, onChange, placeholder, type = 'text'}) {
    return (
        <label className="flex w-full flex-col gap-1.5">
            <span className="text-sm font-medium tracking-normal text-slate-900">{label}</span>
            <input
                type={type}
                value={value || ''}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="h-11 w-full rounded-lg border-0 bg-slate-100 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-300"
            />
        </label>
    );
}

function GhostTextarea({label, value, onChange, placeholder}) {
    return (
        <label className="flex w-full flex-col gap-1.5">
            <span className="text-sm font-medium tracking-normal text-slate-900">{label}</span>
            <textarea
                value={value || ''}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="min-h-24 w-full resize-y rounded-lg border-0 bg-slate-100 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-300"
            />
        </label>
    );
}

function GhostSelect({label, value, onChange, options}) {
    return (
        <label className="flex w-full flex-col gap-1.5">
            <span className="text-sm font-medium tracking-normal text-slate-900">{label}</span>
            <select
                data-card-control
                value={value || ''}
                onChange={(event) => onChange(event.target.value)}
                className="h-11 w-full rounded-lg border-0 bg-slate-100 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
            >
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </label>
    );
}

function GhostToggle({checked, onChange}) {
    return (
        <button
            type="button"
            data-card-control
            aria-pressed={checked}
            className={`relative h-6 w-11 rounded-full border transition-colors ${checked ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-slate-100'}`}
            onClick={() => onChange(!checked)}
        >
            <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    );
}

function parseColor(color) {
    const value = String(color || '').trim();
    const shortHex = value.match(/^#([0-9a-f]{3})$/i);
    const longHex = value.match(/^#([0-9a-f]{6})$/i);
    const rgb = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
    if (shortHex) return shortHex[1].split('').map((part) => parseInt(part + part, 16));
    if (longHex) return [0, 2, 4].map((offset) => parseInt(longHex[1].slice(offset, offset + 2), 16));
    if (rgb) return rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))));
    return [247, 247, 248];
}

function readableForeground(background) {
    const [red, green, blue] = parseColor(background).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
    return luminance > 0.42 ? '#111827' : '#ffffff';
}

function SettingRow({label, children, description}) {
    return (
        <div className="flex w-full items-center justify-between gap-3">
            <div className="min-w-0">
                <div className="text-sm font-medium tracking-normal text-slate-900">{label}</div>
                {description ? <p className="mt-1 text-xs leading-snug text-slate-500">{description}</p> : null}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

function ColorSwatch({color, selected, onClick}) {
    return (
        <span className={`relative block size-8 rounded-full p-0.5 ${selected ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`} style={{background: `conic-gradient(from 90deg, #ff005c, #ffd500, #00d084, #00a7ff, #7b2cff, #ff005c)`}}>
            <span className="block size-full rounded-full border-2 border-white" style={{backgroundColor: color}} />
            <input type="color" data-card-control aria-label={`Choose ${color}`} value={String(color).startsWith('#') ? color : '#ffffff'} onChange={(event) => onClick(event.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </span>
    );
}

function ColorSetting({label, value, onChange}) {
    return (
        <SettingRow label={label}>
            <div className="flex items-center gap-2">
                <ColorSwatch color={value || '#ffffff'} selected onClick={onChange} />
            </div>
        </SettingRow>
    );
}

function AlignmentSetting({value, onChange}) {
    return (
        <SettingRow label="Content alignment">
            <div className="flex overflow-hidden rounded-lg bg-slate-100 p-0.5">
                {['left', 'center'].map((alignment) => (
                    <button
                        key={alignment}
                        type="button"
                        data-card-control
                        className={`flex h-10 w-12 items-center justify-center rounded-md text-xl ${value === alignment ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-700'}`}
                        aria-label={`${alignment} alignment`}
                        onClick={() => onChange(alignment)}
                    >
                        {alignment === 'left' ? '☷' : '≡'}
                    </button>
                ))}
            </div>
        </SettingRow>
    );
}

function PanelTabs({activeTab, onChange}) {
    return (
        <div className="flex gap-6 border-b border-slate-200 px-6">
            {[
                ['content', 'Content'],
                ['design', 'Design'],
                ['visibility', 'Visibility'],
            ].map(([id, label]) => (
                <button
                    key={id}
                    type="button"
                    data-card-control
                    className={`-mb-px border-b-2 pb-3 pt-4 text-sm font-semibold ${activeTab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}
                    onClick={() => onChange(id)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function EmailCtaSettings({data, update, onUploadImage}) {
    const imageInputRef = React.useRef(null);
    const [activeTab, setActiveTab] = React.useState('content');

    return (
        <>
            <PanelTabs activeTab={activeTab} onChange={setActiveTab} />
            <div className="flex flex-col gap-4 p-6 pt-4">
                {activeTab === 'content' ? (
                    <>
                        <SettingRow label="Sponsor label"><GhostToggle checked={data.showSponsor !== false} onChange={(value) => update('showSponsor', value)} /></SettingRow>
                        <SettingRow label="Image"><><button type="button" data-card-control className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => imageInputRef.current?.click()}>Upload</button><input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => {onUploadImage?.(event.target.files?.[0]); event.target.value = '';}} /></></SettingRow>
                        <div className="my-1 border-t border-slate-200" />
                        <SettingRow label="Button"><GhostToggle checked={data.showButton !== false} onChange={(value) => update('showButton', value)} /></SettingRow>
                        {data.showButton !== false ? (
                            <>
                                <GhostInput label="Button text" value={data.buttonText} onChange={(value) => update('buttonText', value)} placeholder="Learn more" />
                                <GhostInput label="Button URL" value={data.buttonUrl} onChange={(value) => update('buttonUrl', value)} placeholder="https://yoursite.com/#/portal/signup/" type="url" />
                            </>
                        ) : null}
                    </>
                ) : null}
                {activeTab === 'design' ? (
                    <>
                        <SettingRow label="Layout">
                            <div className="flex overflow-hidden rounded-lg bg-slate-100 p-0.5">
                                {['left', 'center'].map((layout) => (
                                    <button key={layout} type="button" data-card-control className={`h-10 w-12 rounded-md text-lg ${data.alignment === layout ? 'bg-white shadow-sm' : ''}`} onClick={() => update('alignment', layout)}>{layout === 'left' ? '▤' : '▱'}</button>
                                ))}
                            </div>
                        </SettingRow>
                        <ColorSetting label="Background" value={data.background || '#f7f7f8'} onChange={(value) => update('background', value)} />
                        <ColorSetting label="Link color" value={data.linkColor || '#111111'} onChange={(value) => update('linkColor', value)} />
                        <ColorSetting label="Button Color" value={data.buttonColor || '#111111'} onChange={(value) => update('buttonColor', value)} />
                    </>
                ) : null}
                {activeTab === 'visibility' ? (
                    <>
                        <h4 className="text-sm font-semibold text-slate-700">Web</h4>
                        <SettingRow label="Public visitors"><GhostToggle checked={data.publicVisitors !== false} onChange={(value) => update('publicVisitors', value)} /></SettingRow>
                        <SettingRow label="Free members"><GhostToggle checked={data.webFreeMembers !== false} onChange={(value) => update('webFreeMembers', value)} /></SettingRow>
                        <div className="my-1 border-t border-slate-200" />
                        <h4 className="text-sm font-semibold text-slate-700">Email</h4>
                        <SettingRow label="Free members"><GhostToggle checked={data.emailFreeMembers !== false} onChange={(value) => update('emailFreeMembers', value)} /></SettingRow>
                    </>
                ) : null}
            </div>
        </>
    );
}

function CardSettingsPanel({cardType, data, onChange, panelRef, position, nodeKey}) {
    const {uploadFile, uploadStates} = React.useContext(TakeerCardContext);
    const mediaInputRef = React.useRef(null);
    const isUploading = uploadStates[nodeKey]?.status === 'uploading';
    const update = (key, value) => onChange({...data, [key]: value});
    const uploadMedia = async (event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        try {
            for (const file of files.slice(0, cardType === 'gallery' ? 9 : 1)) {
                await uploadFile?.({file, cardType, nodeKey});
            }
        } catch {
            // The shared uploader renders the card-level error and toast.
        }
    };

    if (typeof document === 'undefined') return null;

    if (cardType === 'email_cta') {
        return createPortal(
            <div
                ref={panelRef}
                className="not-kg-prose fixed z-[2147483000] m-0 max-h-[calc(100vh-32px)] w-[320px] overflow-y-auto rounded-lg border border-slate-200 bg-white font-sans shadow-[0_18px_45px_rgba(15,23,42,0.22)]"
                data-kg-settings-panel
                style={{left: position?.left || 0, top: position?.top || 0, visibility: position ? 'visible' : 'hidden'}}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
            >
                <EmailCtaSettings data={data} update={update} onUploadImage={(file) => uploadFile?.({file, cardType: 'email_cta', nodeKey})?.catch(() => {})} />
            </div>,
            document.body,
        );
    }

    let content = null;
    if (cardType === 'button') {
        content = <>
            <AlignmentSetting value={data.alignment || 'center'} onChange={(value) => update('alignment', value)} />
            <GhostInput label="Button text" value={data.text} onChange={(value) => update('text', value)} placeholder="Add button text" />
            <GhostInput label="Button URL" value={data.url} onChange={(value) => update('url', value)} placeholder="https://yoursite.com/#/portal/signup/" type="url" />
        </>;
    } else if (cardType === 'callout') {
        content = <>
            <SettingRow label="Emoji"><GhostToggle checked={data.showEmoji !== false} onChange={(value) => update('showEmoji', value)} /></SettingRow>
            <ColorSetting label="Background" value={data.background || '#eaf6ff'} onChange={(value) => update('background', value)} />
        </>;
    } else if (cardType === 'image') {
        content = <>
            <SettingRow label="Replace image"><button type="button" data-card-control className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => mediaInputRef.current?.click()}>Upload</button></SettingRow>
            <GhostSelect label="Image width" value={data.width || 'regular'} onChange={(value) => update('width', value)} options={[{value: 'regular', label: 'Regular'}, {value: 'wide', label: 'Wide'}, {value: 'full', label: 'Full'}]} />
            <GhostInput label="Image URL" value={data.src} onChange={(value) => update('src', value)} placeholder="https://example.com/image.jpg" type="url" />
            <GhostInput label="Image link" value={data.linkUrl} onChange={(value) => update('linkUrl', value)} placeholder="https://example.com" type="url" />
            <GhostInput label="Alt text" value={data.alt} onChange={(value) => update('alt', value)} placeholder="Describe this image" />
            <GhostInput label="Caption" value={data.caption} onChange={(value) => update('caption', value)} placeholder="Optional caption" />
        </>;
    } else if (cardType === 'gallery') {
        content = <>
            <SettingRow label="Images"><button type="button" data-card-control className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => mediaInputRef.current?.click()}>Add images</button></SettingRow>
            <GhostSelect label="Layout" value={data.layout || 'grid'} onChange={(value) => update('layout', value)} options={[{value: 'grid', label: 'Grid'}, {value: 'masonry', label: 'Masonry'}]} />
            <GhostInput label="Caption" value={data.caption} onChange={(value) => update('caption', value)} placeholder="Type caption for gallery (optional)" />
        </>;
    } else if (cardType === 'video') {
        content = <>
            <GhostSelect label="Video width" value={data.width || 'regular'} onChange={(value) => update('width', value)} options={[{value: 'regular', label: 'Regular'}, {value: 'wide', label: 'Wide'}, {value: 'full', label: 'Full'}]} />
            <SettingRow label="Loop"><GhostToggle checked={Boolean(data.loop)} onChange={(value) => update('loop', value)} /></SettingRow>
            <GhostInput label="Custom thumbnail" value={data.thumbnail} onChange={(value) => update('thumbnail', value)} placeholder="https://example.com/thumbnail.jpg" type="url" />
            <GhostInput label="Caption" value={data.caption} onChange={(value) => update('caption', value)} placeholder="Type caption for video (optional)" />
        </>;
    } else if (cardType === 'audio') {
        content = <>
            <GhostInput label="Title" value={data.title} onChange={(value) => update('title', value)} placeholder="Add a title..." />
            <GhostInput label="Caption" value={data.caption} onChange={(value) => update('caption', value)} placeholder="Type caption for audio (optional)" />
        </>;
    } else if (cardType === 'file') {
        content = <>
            <GhostInput label="Title" value={data.title} onChange={(value) => update('title', value)} placeholder="Add a title..." />
            <GhostTextarea label="Description" value={data.description} onChange={(value) => update('description', value)} placeholder="Add a description..." />
        </>;
    } else if (cardType === 'bookmark') {
        content = <>
            <div className="rounded-lg bg-slate-100 px-3 py-3 text-sm text-slate-600"><div className="font-semibold text-slate-900">{data.title || 'Business post'}</div><div className="mt-1 break-all text-xs">{data.url || 'Choose a post from this business'}</div></div>
            <GhostInput label="Caption" value={data.caption} onChange={(value) => update('caption', value)} placeholder="Optional caption" />
            <button type="button" data-card-control className="h-10 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => onChange({caption: data.caption || ''})}>Choose another post</button>
        </>;
    } else if (cardType === 'embed') {
        content = <>
            <GhostInput label="Provider" value={data.provider} onChange={(value) => update('provider', value)} placeholder="YouTube, Vimeo, Spotify..." />
            <GhostInput label="URL" value={data.url} onChange={(value) => update('url', value)} placeholder="https://example.com" type="url" />
            <GhostInput label="Title" value={data.title} onChange={(value) => update('title', value)} placeholder="Add a title..." />
            <GhostTextarea label="Description" value={data.description} onChange={(value) => update('description', value)} placeholder="Add a description..." />
            <GhostInput label="Caption" value={data.caption} onChange={(value) => update('caption', value)} placeholder="Optional caption" />
        </>;
    } else if (cardType === 'gif') {
        content = <>
            <GhostInput label="GIF URL" value={data.url} onChange={(value) => update('url', value)} placeholder="https://media.giphy.com/..." type="url" />
            <GhostInput label="Alt text" value={data.alt} onChange={(value) => update('alt', value)} placeholder="Describe this GIF" />
            <GhostInput label="Caption" value={data.caption} onChange={(value) => update('caption', value)} placeholder="Optional caption" />
            <GhostSelect label="GIF width" value={data.width || 'regular'} onChange={(value) => update('width', value)} options={[{value: 'regular', label: 'Regular'}, {value: 'wide', label: 'Wide'}, {value: 'full', label: 'Full'}]} />
        </>;
    } else if (cardType === 'toggle') {
        content = <>
            <GhostInput label="Toggle header" value={data.title} onChange={(value) => update('title', value)} placeholder="Toggle header" />
            <GhostTextarea label="Collapsible content" value={data.content} onChange={(value) => update('content', value)} placeholder="Collapsible content" />
        </>;
    } else if (cardType === 'header') {
        content = <>
            <SettingRow label="Layout">
                <div className="flex overflow-hidden rounded-lg bg-slate-100 p-0.5">
                    {[
                        ['regular', '▱'],
                        ['wide', '▬'],
                        ['full', '↔'],
                        ['split', '◫'],
                    ].map(([layout, icon]) => <button key={layout} type="button" data-card-control aria-label={`${layout} layout`} className={`flex h-9 w-10 items-center justify-center rounded-md text-base ${((data.layout || 'regular') === layout) ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`} onClick={() => update('layout', layout)}>{icon}</button>)}
                </div>
            </SettingRow>
            <AlignmentSetting value={data.alignment || 'left'} onChange={(value) => update('alignment', value)} />
            <ColorSetting label="Background" value={data.background || '#000000'} onChange={(value) => update('background', value)} />
            <SettingRow label="Button"><GhostToggle checked={Boolean(data.showButton)} onChange={(value) => update('showButton', value)} /></SettingRow>
            {data.showButton ? <><ColorSetting label="Button Color" value={data.buttonColor || '#ffffff'} onChange={(value) => update('buttonColor', value)} /><GhostInput label="Button text" value={data.buttonText} onChange={(value) => update('buttonText', value)} placeholder="Add button text" /><GhostInput label="Button URL" value={data.buttonUrl} onChange={(value) => update('buttonUrl', value)} placeholder="https://yoursite.com/#/portal/signup/" type="url" /></> : null}
        </>;
    } else if (cardType === 'product') {
        content = <>
            <GhostInput label="Product title" value={data.title} onChange={(value) => update('title', value)} placeholder="Product title" />
            <GhostTextarea label="Description" value={data.description} onChange={(value) => update('description', value)} placeholder="Description" />
            <GhostInput label="Image URL" value={data.image} onChange={(value) => update('image', value)} placeholder="https://example.com/product.jpg" type="url" />
            <SettingRow label="Rating"><GhostToggle checked={data.showRating !== false} onChange={(value) => update('showRating', value)} /></SettingRow>
            <SettingRow label="Button"><GhostToggle checked={data.showButton !== false} onChange={(value) => update('showButton', value)} /></SettingRow>
            {data.showButton !== false ? <><GhostInput label="Button text" value={data.buttonText} onChange={(value) => update('buttonText', value)} placeholder="Learn more" /><GhostInput label="Button URL" value={data.buttonUrl} onChange={(value) => update('buttonUrl', value)} placeholder="https://example.com" type="url" /></> : null}
        </>;
    } else if (cardType === 'markdown' || cardType === 'html') {
        content = <>
            <SettingRow label="Public visitors"><GhostToggle checked={data.publicVisitors !== false} onChange={(value) => update('publicVisitors', value)} /></SettingRow>
            <SettingRow label="Members"><GhostToggle checked={data.members !== false} onChange={(value) => update('members', value)} /></SettingRow>
        </>;
    }

    if (!content) return null;

    return createPortal(
        <div
            ref={panelRef}
            className="not-kg-prose fixed z-[2147483000] flex max-h-[calc(100vh-32px)] w-[320px] flex-col gap-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 font-sans shadow-[0_18px_45px_rgba(15,23,42,0.22)]"
            data-kg-settings-panel
            style={{left: position?.left || 0, top: position?.top || 0, visibility: position ? 'visible' : 'hidden'}}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            {content}
            {UPLOAD_CARD_TYPES.includes(cardType) ? <input ref={mediaInputRef} type="file" className="hidden" disabled={isUploading} accept={cardType === 'video' ? 'video/*' : cardType === 'audio' ? 'audio/*' : cardType === 'file' ? '*/*' : 'image/*'} multiple={cardType === 'gallery'} onChange={uploadMedia} /> : null}
        </div>,
        document.body,
    );
}

const MARKDOWN_HELP = [
    ['**text**', 'Bold', 'Ctrl/⌘ + B'],
    ['*text*', 'Emphasize', 'Ctrl/⌘ + I'],
    ['~~text~~', 'Strike-through', 'Ctrl/⌘ + Alt + U'],
    ['[title](https://)', 'Link', 'Ctrl/⌘ + K'],
    ['`code`', 'Inline code', 'Ctrl/⌘ + Alt + C'],
    ['![alt](https://)', 'Image', 'Ctrl/⌘ + Shift + I'],
    ['- item', 'List', 'Ctrl/⌘ + L'],
    ['1. item', 'Ordered list', 'Ctrl/⌘ + Alt + L'],
    ['> quote', 'Blockquote', 'Ctrl/⌘ + ’'],
    ['# Heading', 'H1', ''],
    ['## Heading', 'H2', 'Ctrl/⌘ + H'],
    ['### Heading', 'H3', 'Ctrl/⌘ + H (x2)'],
];

function MarkdownHelpDialog({onClose}) {
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div data-kg-card-modal className="fixed inset-0 z-[2147483640] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => event.stopPropagation()}>
            <div role="dialog" aria-modal="true" aria-labelledby="markdown-help-title" className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-8 font-sans text-slate-800 shadow-2xl">
                <div className="flex items-start justify-between gap-6">
                    <h2 id="markdown-help-title" className="text-2xl font-semibold">Markdown Help</h2>
                    <button type="button" data-card-control aria-label="Close Markdown help" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose}><X className="size-6" /></button>
                </div>
                <table className="mt-6 w-full border-collapse text-left text-sm">
                    <thead><tr className="border-b border-slate-200"><th className="p-3 font-semibold">Markdown</th><th className="p-3 font-semibold">Result</th><th className="p-3 font-semibold">Shortcut</th></tr></thead>
                    <tbody>{MARKDOWN_HELP.map(([syntax, result, shortcut]) => <tr key={syntax} className="border-b border-slate-200"><td className="p-3 font-mono">{syntax}</td><td className="p-3">{result}</td><td className="p-3">{shortcut}</td></tr>)}</tbody>
                </table>
            </div>
        </div>,
        document.body,
    );
}

function CodeToolbar({markdown, onCommand, onHelp}) {
    const items = [
        [Bold, 'Bold'],
        [Italic, 'Italic'],
        [Heading, 'Heading'],
        [Quote, 'Quote'],
        [List, 'Bulleted list'],
        [ListOrdered, 'Numbered list'],
        [Link2, 'Link'],
        [ImagePlus, 'Image'],
        [Camera, 'Embed'],
    ];

    return (
        <div className="flex items-center gap-4 border-t border-slate-200 px-6 py-3 text-slate-700">
            {items.map(([Icon, label]) => <button key={label} type="button" data-card-control aria-label={label} className="inline-flex items-center justify-center hover:text-slate-950" onMouseDown={(event) => event.preventDefault()} onClick={() => onCommand?.(label)}><Icon className="size-6" strokeWidth={2.5} /></button>)}
            <span className="ml-auto inline-flex items-center gap-4">
                {markdown ? <span className="text-xl font-medium">M↓</span> : <span className="text-lg">abc✓</span>}
                {markdown ? <button type="button" data-card-control aria-label="Markdown help" className="flex size-7 items-center justify-center rounded-full bg-slate-700 text-white hover:bg-slate-900" onClick={onHelp}><HelpCircle className="size-5" /></button> : null}
            </span>
        </div>
    );
}

function CodeCardEditor({cardType, data, onChange, isEditing}) {
    const markdown = cardType === 'markdown';
    const textareaRef = React.useRef(null);
    const [showHelp, setShowHelp] = React.useState(false);
    const content = data.content || '';

    if (!isEditing) {
        if (markdown) {
            const html = markdownRenderer.render(content);
            return <div className="relative min-h-12 whitespace-normal font-serif text-lg leading-8 text-slate-800"><div className="prose max-w-none" dangerouslySetInnerHTML={{__html: html}} /><div className="absolute inset-0 z-10" /></div>;
        }
        return <pre className="min-h-12 overflow-x-auto whitespace-pre-wrap bg-slate-950 p-6 font-mono text-sm leading-7 text-slate-100"><code>{content}</code></pre>;
    }

    const insertMarkdown = (prefix, suffix = prefix, placeholder = 'text', block = false) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = content.slice(start, end) || placeholder;
        const insertion = block ? `${prefix}${selected}${suffix}` : `${prefix}${selected}${suffix}`;
        onChange({...data, content: `${content.slice(0, start)}${insertion}${content.slice(end)}`});
        requestAnimationFrame(() => {
            textarea.focus({preventScroll: true});
            textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
        });
    };

    const runCommand = (label) => {
        const commands = {
            Bold: ['**', '**', 'bold text'],
            Italic: ['*', '*', 'emphasized text'],
            Heading: ['## ', '', 'Heading'],
            Quote: ['> ', '', 'Quote'],
            'Bulleted list': ['- ', '', 'List item'],
            'Numbered list': ['1. ', '', 'List item'],
            Link: ['[', '](https://)', 'link text'],
            Image: ['![', '](https://)', 'alt text'],
            Embed: ['\n', '\n', '<iframe title="Embed"></iframe>'],
        };
        const command = commands[label];
        if (command) insertMarkdown(...command);
    };

    return (
        <div className="relative min-h-[340px] bg-white">
            <div className="flex min-h-[290px]">
                <div className="w-12 shrink-0 select-none pt-5 text-center font-mono text-lg text-slate-300">{markdown ? 'M↓' : '<>'}</div>
                <textarea
                    ref={textareaRef}
                    data-card-control
                    data-card-primary-control
                    value={content}
                    onChange={(event) => onChange({...data, content: event.target.value})}
                    placeholder=""
                    spellCheck={!markdown}
                    className="min-h-[290px] flex-1 resize-none border-0 bg-transparent px-1 py-5 font-mono text-base leading-7 text-slate-800 outline-none"
                />
            </div>
            <CodeToolbar markdown={markdown} onCommand={runCommand} onHelp={() => setShowHelp(true)} />
            {showHelp ? <MarkdownHelpDialog onClose={() => {setShowHelp(false); requestAnimationFrame(() => textareaRef.current?.focus({preventScroll: true}));}} /> : null}
        </div>
    );
}

function GhostMediaPlaceholder({cardType, onSelect}) {
    const config = {
        image: {Icon: ImagePlus, text: 'Click to select an image', size: 'large'},
        gallery: {Icon: GalleryHorizontalEnd, text: 'Click to select up to 9 images', size: 'large'},
        video: {Icon: Video, text: 'Click to select a video', size: 'large'},
        audio: {Icon: Music2, text: 'Click to upload an audio file', size: 'small'},
        file: {Icon: FileUp, text: 'Click to upload a file', size: 'small'},
    }[cardType] || {Icon: ImagePlus, text: `Click to select ${CARD_LABELS[cardType]?.toLowerCase() || 'a file'}`, size: 'large'};
    const Icon = config.Icon;

    return (
        <button
            type="button"
            data-card-control
            data-card-open
            className={`group flex w-full cursor-pointer flex-col items-center justify-center border border-slate-200 bg-slate-50 text-slate-400 transition hover:text-slate-500 ${config.size === 'large' ? 'min-h-[360px] p-16' : 'min-h-[140px] p-8'}`}
            onClick={onSelect}
        >
            <Icon className={`${config.size === 'large' ? 'size-20' : 'size-12'} opacity-70 transition group-hover:scale-105`} strokeWidth={1.5} />
            <span className="mt-4 text-base font-normal">{config.text}</span>
        </button>
    );
}

function CardCaption({value, onChange, placeholder, isEditing}) {
    if (!isEditing) return value ? <figcaption className="w-full py-4 text-center text-base text-slate-400">{value}</figcaption> : null;
    return <input data-card-control className="w-full border-0 bg-transparent py-4 text-center text-base text-slate-400 outline-none placeholder:text-slate-400" value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

function MediaCard({cardType, data, onChange, nodeKey, isEditing}) {
    const {uploadFile, uploadStates} = React.useContext(TakeerCardContext);
    const inputRef = React.useRef(null);
    const uploadState = uploadStates[nodeKey] || null;
    const isUploading = uploadState?.status === 'uploading';
    const hasMedia = cardType === 'gallery' ? (data.images || []).length > 0 : Boolean(data.src || data.url);
    const updateWithFile = async (file) => {
        if (!file) return;
        if (uploadFile) {
            await uploadFile({file, cardType, nodeKey});
            return;
        }
        const src = URL.createObjectURL(file);
        if (cardType === 'gallery') {
            onChange({...data, images: [...(data.images || []), src]});
        } else {
            onChange({...data, src, url: src, name: file.name, size: file.size});
        }
    };

    const handleFiles = async (event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        try {
            for (const file of files.slice(0, cardType === 'gallery' ? 9 : 1)) {
                await updateWithFile(file);
            }
        } catch {
            // The uploader owns the visible error state and toast. Leave the
            // card in place so the author can retry immediately.
        }
    };

    const uploadFeedback = uploadState ? (
        <div
            className={`absolute inset-x-0 bottom-0 z-20 border-t px-4 py-3 backdrop-blur-md ${uploadState.status === 'error' ? 'border-rose-200 bg-rose-50/95 text-rose-800' : 'border-brand-200 bg-white/95 text-slate-700'}`}
            role={uploadState.status === 'error' ? 'alert' : 'status'}
            aria-live="polite"
        >
            <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                <span className="min-w-0 truncate">
                    {uploadState.status === 'error'
                        ? uploadState.error || 'Upload failed. Select the file to retry.'
                        : uploadState.status === 'complete'
                            ? `${uploadState.fileName || 'Attachment'} uploaded`
                            : `Uploading ${uploadState.fileName || 'attachment'}...`}
                </span>
                {uploadState.status !== 'error' ? <span className="shrink-0 tabular-nums">{uploadState.progress || 0}%</span> : null}
            </div>
            {uploadState.status !== 'error' ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                    <div className="h-full rounded-full bg-brand-600 transition-[width] duration-150" style={{width: `${uploadState.progress || 0}%`}} />
                </div>
            ) : null}
        </div>
    ) : null;

    if (!hasMedia) {
        if (!isEditing) return <div className="min-h-20 border border-slate-200 bg-slate-50" />;
        return (
            <div className="relative overflow-hidden">
                <GhostMediaPlaceholder cardType={cardType} onSelect={() => !isUploading && inputRef.current?.click()} />
                <input ref={inputRef} type="file" className="hidden" disabled={isUploading} accept={cardType === 'video' ? 'video/*' : cardType === 'audio' ? 'audio/*' : cardType === 'gallery' || cardType === 'image' ? 'image/*' : '*/*'} multiple={cardType === 'gallery'} onChange={handleFiles} />
                {uploadFeedback}
            </div>
        );
    }

    if (cardType === 'gallery') {
        return (
            <div className="relative overflow-hidden border border-slate-200 bg-slate-50">
                <div className="grid grid-cols-3 gap-1 p-1">{(data.images || []).map((src, index) => <img key={`${src}-${index}`} src={src} alt="" className="aspect-square w-full object-cover" />)}</div>
                <CardCaption isEditing={isEditing} value={data.caption} onChange={(value) => onChange({...data, caption: value})} placeholder="Type caption for gallery (optional)" />
                {uploadFeedback}
            </div>
        );
    }

    if (cardType === 'image') {
        return <div className="relative overflow-hidden border border-slate-200 bg-slate-50"><img src={data.src || data.url} alt={data.alt || ''} className="max-h-[520px] w-full object-contain" /><CardCaption isEditing={isEditing} value={data.caption} onChange={(value) => onChange({...data, caption: value})} placeholder="Type caption for image (optional)" />{uploadFeedback}</div>;
    }

    if (cardType === 'video') {
        return <div className="relative overflow-hidden border border-slate-200 bg-slate-50"><video controls={isEditing} loop={Boolean(data.loop)} src={data.src || data.url} className="max-h-[520px] w-full bg-black" /><CardCaption isEditing={isEditing} value={data.caption} onChange={(value) => onChange({...data, caption: value})} placeholder="Type caption for video (optional)" />{uploadFeedback}</div>;
    }

    if (cardType === 'audio') {
        return <div className="relative flex items-center gap-4 overflow-hidden rounded-md border border-slate-300 bg-white p-4"><Music2 className="size-8 text-slate-400" strokeWidth={1.5} /><div className="min-w-0 flex-1">{isEditing ? <input data-card-control className="w-full border-0 bg-transparent text-lg font-bold outline-none" value={data.title || ''} onChange={(event) => onChange({...data, title: event.target.value})} placeholder="Add a title..." /> : <div className="text-lg font-bold">{data.title || data.name || 'Audio'}</div>}<audio controls={isEditing} src={data.src || data.url} className="mt-2 w-full" /></div>{uploadFeedback}</div>;
    }

    return <div className="relative flex items-center justify-between overflow-hidden rounded-md border border-slate-300 bg-white p-4"><div className="min-w-0">{isEditing ? <><input data-card-control className="w-full border-0 bg-transparent text-lg font-bold outline-none" value={data.title || ''} onChange={(event) => onChange({...data, title: event.target.value})} placeholder="Add a title..." /><input data-card-control className="mt-1 w-full border-0 bg-transparent text-sm text-slate-500 outline-none" value={data.description || ''} onChange={(event) => onChange({...data, description: event.target.value})} placeholder="Add a description..." /></> : <><div className="text-lg font-bold">{data.title || data.name || 'File'}</div>{data.description ? <div className="mt-1 text-sm text-slate-500">{data.description}</div> : null}</>}<p className="mt-2 text-sm text-slate-600">{data.name || 'Uploaded file'}</p></div><Paperclip className="size-8 text-emerald-500" />{uploadFeedback}</div>;
}

function UrlInputCard({cardType, data, onChange, isEditing}) {
    const [draft, setDraft] = React.useState(data.url || '');
    const inputRef = React.useRef(null);
    React.useEffect(() => {
        if (isEditing && !data.url) inputRef.current?.focus();
    }, [data.url, isEditing]);

    const submit = () => {
        const url = draft.trim();
        if (!url) return;
        onChange({...data, url, title: data.title || (cardType === 'bookmark' ? 'Bookmark' : data.provider || 'Embed'), description: data.description || ''});
    };

    if (!data.url) {
        if (!isEditing) return <div className="min-h-16 rounded-md border border-slate-200 bg-slate-50" />;
        return <div className="relative"><input ref={inputRef} data-card-control data-card-primary-control value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {if (event.key === 'Enter') {event.preventDefault(); submit();}}} placeholder={cardType === 'bookmark' ? 'Paste URL or search posts and pages...' : `Paste ${data.provider || ''} URL...`} className="h-16 w-full rounded-md border border-slate-300 bg-white px-4 text-lg text-slate-700 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></div>;
    }

    return <BookmarkPreview cardType={cardType} data={data} onChange={onChange} isEditing={isEditing} />;
}

function BookmarkPostPicker({data, onChange, isEditing}) {
    const {bookmarkSearchUrl} = React.useContext(TakeerCardContext);
    const [query, setQuery] = React.useState('');
    const [posts, setPosts] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (!isEditing || !bookmarkSearchUrl || data.url) return undefined;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const separator = bookmarkSearchUrl.includes('?') ? '&' : '?';
                const response = await axios.get(`${bookmarkSearchUrl}${separator}q=${encodeURIComponent(query.trim())}`, {signal: controller.signal});
                setPosts(Array.isArray(response.data?.data) ? response.data.data : []);
            } catch (error) {
                if (error.code !== 'ERR_CANCELED') setPosts([]);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, query ? 250 : 0);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [bookmarkSearchUrl, data.url, isEditing, query]);

    if (data.url) return <BookmarkPreview cardType="bookmark" data={data} onChange={onChange} isEditing={isEditing} />;
    if (!isEditing) return <div className="min-h-16 rounded-md border border-slate-200 bg-slate-50" />;

    return (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <input data-card-control data-card-primary-control value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this business's posts..." className="h-14 w-full border-0 border-b border-slate-200 bg-white px-4 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-emerald-400" />
            <div className="max-h-72 overflow-y-auto p-2">
                {loading ? <p className="px-3 py-4 text-sm text-slate-400">Loading posts…</p> : null}
                {!loading && posts.length === 0 ? <p className="px-3 py-4 text-sm text-slate-400">No matching business posts.</p> : null}
                {posts.map((post) => (
                    <button
                        key={post.id}
                        type="button"
                        data-card-control
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-100"
                        onClick={() => onChange({
                            ...data,
                            postId: post.id,
                            url: `/p/${post.public_id || post.id}`,
                            title: post.title || post.caption || 'Business post',
                            description: post.caption || '',
                            thumbnail: post.cover_image || '',
                            provider: 'Takeer',
                            author: post.created_by?.name || 'Business',
                        })}
                    >
                        {post.cover_image ? <img src={post.cover_image} alt="" className="size-12 shrink-0 rounded-md object-cover" /> : <div className="size-12 shrink-0 rounded-md bg-slate-100" />}
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{post.title || post.caption || 'Untitled post'}</span><span className="mt-1 block truncate text-xs text-slate-500">{post.caption || post.post_type}</span></span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function BookmarkPreview({cardType, data, onChange, isEditing}) {
    return (
        <div className="relative overflow-hidden rounded-md border border-slate-300 bg-white">
            <div className="min-h-[170px] p-6 pr-44">
                <h3 className="text-xl font-semibold leading-snug text-slate-800">{data.title || (cardType === 'bookmark' ? 'Bookmark' : data.provider || 'Embed')}</h3>
                <p className="mt-2 line-clamp-3 text-lg leading-snug text-slate-500">{data.description || data.url}</p>
                <p className="mt-7 text-base font-medium text-slate-600">{data.provider || 'Takeer'} <span className="px-1">•</span> {data.author || 'Content'}</p>
            </div>
            {data.thumbnail ? <img src={data.thumbnail} alt="" className="absolute right-0 top-0 h-full w-40 object-cover" /> : null}
            {cardType === 'bookmark' ? <CardCaption isEditing={isEditing} value={data.caption} onChange={(value) => onChange({...data, caption: value})} placeholder="Type caption for bookmark (optional)" /> : null}
        </div>
    );
}

function CalloutCard({data, onChange, isEditing}) {
    const background = data.background || '#eaf6ff';
    const foreground = readableForeground(background);
    return (
        <div className="flex items-center gap-4 rounded-md border border-slate-200 px-7 py-5" style={{backgroundColor: background, color: foreground}}>
            {data.showEmoji !== false ? <span className="w-10 text-center text-2xl">{data.emoji || '💡'}</span> : null}
            {isEditing ? <input data-card-control data-card-primary-control className="min-w-0 flex-1 border-0 bg-transparent font-serif text-xl outline-none placeholder:text-current placeholder:opacity-50" style={{color: foreground}} value={data.text || ''} onChange={(event) => onChange({...data, text: event.target.value})} placeholder="Callout text..." /> : <div className="min-w-0 flex-1 font-serif text-xl">{data.text || ''}</div>}
        </div>
    );
}

function ToggleCard({data, onChange, isEditing}) {
    const [open, setOpen] = React.useState(true);
    return (
        <div className="rounded-md border border-slate-300 bg-white px-6 py-4">
            <div className="flex items-center gap-4">
                {isEditing ? <input data-card-control data-card-primary-control className="min-w-0 flex-1 border-0 bg-transparent text-3xl font-bold text-slate-700 outline-none placeholder:text-slate-400" value={data.title || ''} onChange={(event) => onChange({...data, title: event.target.value})} placeholder="Toggle header" /> : <div className="min-w-0 flex-1 text-3xl font-bold text-slate-700">{data.title || 'Toggle header'}</div>}
                <button type="button" data-card-control aria-label="Toggle content" className="text-slate-300" onClick={() => setOpen((current) => !current)}><SquareChevronDown className={`size-8 transition-transform ${open ? '' : '-rotate-90'}`} strokeWidth={1.5} /></button>
            </div>
            {open ? (isEditing ? <textarea data-card-control className="mt-5 min-h-20 w-full resize-none border-0 bg-transparent font-serif text-2xl text-slate-400 outline-none placeholder:text-slate-400" value={data.content || ''} onChange={(event) => onChange({...data, content: event.target.value})} placeholder="Collapsible content" /> : <div className="mt-5 font-serif text-2xl text-slate-400">{data.content || 'Collapsible content'}</div>) : null}
        </div>
    );
}

function EmailCtaCard({data, onChange, isEditing}) {
    const background = data.background || '#f7f7f8';
    const foreground = readableForeground(background);
    const buttonColor = data.buttonColor || '#111111';
    const showButton = data.showButton !== false && (isEditing || (Boolean(data.buttonText?.trim()) && Boolean(data.buttonUrl?.trim())));
    return (
        <div className="rounded-md border border-slate-200 px-12 py-8" style={{backgroundColor: background, color: foreground}}>
            {data.showSponsor !== false ? <div className="border-b border-current/20 pb-5 text-sm font-semibold tracking-wide opacity-60">SPONSORED</div> : null}
            {isEditing ? <input data-card-control data-card-primary-control className={`mt-8 w-full border-0 bg-transparent font-serif text-2xl outline-none placeholder:text-current placeholder:opacity-45 ${data.alignment === 'center' ? 'text-center' : 'text-left'}`} style={{color: foreground}} value={data.body || ''} onChange={(event) => onChange({...data, body: event.target.value})} placeholder="Write something worth clicking..." /> : (data.body ? <div className={`mt-8 whitespace-pre-wrap font-serif text-2xl ${data.alignment === 'center' ? 'text-center' : 'text-left'}`}>{data.body}</div> : null)}
            {showButton ? <div className={`mt-8 ${data.alignment === 'center' ? 'text-center' : 'text-left'}`}><button type="button" data-card-control={isEditing ? true : undefined} className="rounded-lg px-6 py-3 text-lg font-medium" style={{backgroundColor: buttonColor, color: readableForeground(buttonColor)}}>{data.buttonText || 'Add button text'}</button></div> : null}
        </div>
    );
}

function HeaderCard({data, onChange, isEditing}) {
    const alignment = data.alignment === 'center' ? 'text-center items-center' : 'text-left items-start';
    const background = data.background || '#000000';
    const foreground = readableForeground(background);
    const layout = ['regular', 'wide', 'full', 'split'].includes(data.layout) ? data.layout : 'regular';
    const showButton = Boolean(data.showButton) && (isEditing || (Boolean(data.buttonText?.trim()) && Boolean(data.buttonUrl?.trim())));
    const sizeClass = layout === 'full' ? 'min-h-[520px] px-12 py-24' : layout === 'wide' ? 'min-h-[400px] px-12 py-20' : layout === 'split' ? 'min-h-[360px] px-10 py-16' : 'min-h-[300px] px-10 py-14';
    return (
        <div className={`flex w-full flex-col justify-center gap-4 border border-slate-200 ${sizeClass} ${alignment}`} style={{backgroundColor: background, color: foreground}}>
            {isEditing ? <input data-card-control data-card-primary-control className="w-full border-0 bg-transparent text-4xl font-black outline-none placeholder:text-current placeholder:opacity-45" style={{color: foreground}} value={data.text || ''} onChange={(event) => onChange({...data, text: event.target.value})} placeholder={layout === 'split' ? 'Heading' : 'Enter heading text'} /> : (data.text ? <div className="w-full text-4xl font-black">{data.text}</div> : null)}
            {isEditing ? <input data-card-control className="w-full border-0 bg-transparent font-serif text-xl outline-none placeholder:text-current placeholder:opacity-45" style={{color: foreground, opacity: 0.78}} value={data.subheading || ''} onChange={(event) => onChange({...data, subheading: event.target.value})} placeholder={layout === 'split' ? 'Subheading text' : 'Enter subheading text'} /> : (data.subheading ? <div className="w-full font-serif text-xl opacity-75">{data.subheading}</div> : null)}
            {showButton ? <button type="button" data-card-control={isEditing ? true : undefined} className="mt-4 rounded-md px-6 py-3 text-base font-semibold" style={{backgroundColor: data.buttonColor || '#ffffff', color: readableForeground(data.buttonColor || '#ffffff')}}>{data.buttonText || 'Add button text'}</button> : null}
        </div>
    );
}

function GifCard({data, onChange, isEditing}) {
    if (!data.url) {
        return <div className="flex min-h-44 flex-col justify-center rounded-md border border-slate-200 bg-slate-50 px-8"><div className="text-lg font-semibold text-slate-900">GIF</div><div className="mt-2 text-sm text-slate-500">Paste a GIF URL in the settings panel</div></div>;
    }
        return <figure className="overflow-hidden rounded-md border border-slate-200 bg-slate-50"><img src={data.url} alt={data.alt || ''} className="max-h-[520px] w-full object-contain" /><CardCaption isEditing={isEditing} value={data.caption} onChange={(value) => onChange({...data, caption: value})} placeholder="Type caption for GIF (optional)" /></figure>;
}

function ProductCard({data}) {
    return (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            {data.image ? <img src={data.image} alt="" className="h-52 w-full object-cover" /> : null}
            <div className="p-6">
                <h3 className="text-2xl font-bold text-slate-900">{data.title || 'Product title'}</h3>
                {data.showRating !== false ? <div className="mt-2 tracking-widest text-amber-400">★★★★★</div> : null}
                <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-500">{data.description || 'Add a product description in the settings panel.'}</p>
                {data.showButton !== false ? <button type="button" data-card-control className="mt-5 rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white">{data.buttonText || 'Learn more'}</button> : null}
            </div>
        </div>
    );
}

function CardPreview({cardType, data, onChange, nodeKey, isEditing}) {
    if (cardType === 'divider') return <hr className="my-6 border-slate-300" />;
    if (cardType === 'image' || cardType === 'gallery' || cardType === 'video' || cardType === 'audio' || cardType === 'file') return <MediaCard cardType={cardType} data={data} onChange={onChange} nodeKey={nodeKey} isEditing={isEditing} />;
    if (cardType === 'bookmark') return <BookmarkPostPicker data={data} onChange={onChange} isEditing={isEditing} />;
    if (cardType === 'embed') return <UrlInputCard cardType={cardType} data={data} onChange={onChange} isEditing={isEditing} />;
    if (cardType === 'markdown' || cardType === 'html') return <CodeCardEditor cardType={cardType} data={data} onChange={onChange} isEditing={isEditing} />;
    if (cardType === 'callout') return <CalloutCard data={data} onChange={onChange} isEditing={isEditing} />;
    if (cardType === 'toggle') return <ToggleCard data={data} onChange={onChange} isEditing={isEditing} />;
    if (cardType === 'email_cta') return <EmailCtaCard data={data} onChange={onChange} isEditing={isEditing} />;
    if (cardType === 'gif') return <GifCard data={data} onChange={onChange} isEditing={isEditing} />;
    if (cardType === 'product') return <ProductCard data={data} />;
    if (cardType === 'button') {
        const showButton = isEditing || (Boolean(data.text?.trim()) && Boolean(data.url?.trim()));
        return <div className={`flex min-h-12 w-full ${data.alignment === 'left' ? 'justify-start' : 'justify-center'}`}>{showButton ? <button type="button" data-card-control={isEditing ? true : undefined} className="rounded-lg bg-pink-300 px-8 py-4 text-lg font-medium text-white">{data.text || 'Add button text'}</button> : null}</div>;
    }
    if (cardType === 'header') return <HeaderCard data={data} onChange={onChange} isEditing={isEditing} />;
    return <div className="rounded-md border border-slate-300 px-5 py-5"><div className="font-semibold">{data.title || CARD_LABELS[cardType] || 'Content card'}</div><div className="mt-2 text-sm text-slate-500">{data.content || 'Configure this card in the settings panel'}</div></div>;
}

function CardView({cardType, data, nodeKey}) {
    const [editor] = useLexicalComposerContext();
    const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
    const [isEditing, setIsEditing] = React.useState(false);
    const cardRef = React.useRef(null);
    const panelRef = React.useRef(null);
    const skipFirstCardClickRef = React.useRef(false);
    const cardData = data && typeof data === 'object' ? data : {};
    const hasMedia = cardType === 'gallery' ? (cardData.images || []).length > 0 : Boolean(cardData.src || cardData.url);
    const showPanel = isEditing && PANEL_CARD_TYPES.includes(cardType) && (!UPLOAD_CARD_TYPES.includes(cardType) || hasMedia);
    const position = useSettingsPosition(cardRef, panelRef, showPanel);
    const onChange = React.useCallback((nextData) => updateCard(editor, nodeKey, nextData), [editor, nodeKey]);

    React.useLayoutEffect(() => {
        if (!cardData._startEditing) return;
        const {_startEditing, ...persistedData} = cardData;
        updateCard(editor, nodeKey, persistedData);
        clearSelection();
        setSelected(true);
        setIsEditing(true);
    }, [cardData._startEditing, clearSelection, editor, nodeKey, setSelected]);

    React.useLayoutEffect(() => {
        if (!isEditing || !isSelected) return undefined;
        const frame = requestAnimationFrame(() => {
            if (!cardRef.current?.contains(document.activeElement)) {
                focusPrimaryCardControl(cardRef.current);
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [isEditing, isSelected]);

    React.useEffect(() => {
        if (!isSelected) setIsEditing(false);
    }, [isSelected]);

    React.useEffect(() => {
        const closeOnOutsideClick = (event) => {
            if (!isSelected) return;
            // Another card owns the next selection. Do not let this card's
            // document listener clear it after the target card handles mousedown.
            if (cardRef.current?.contains(event.target) || panelRef.current?.contains(event.target) || event.target.closest?.('[data-kg-card], [data-kg-card-modal]')) return;
            clearSelection();
            setIsEditing(false);
        };
        document.addEventListener('mousedown', closeOnOutsideClick);
        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, [clearSelection, editor, isSelected, nodeKey]);

    React.useEffect(() => {
        const closeOnEscape = (event) => {
            if (event.key !== 'Escape' || !isEditing) return;
            event.preventDefault();
            setIsEditing(false);
            clearSelection();
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [clearSelection, isEditing]);

    const handleCardMouseDown = (event) => {
        if (event.target.closest('[data-kg-settings-panel]')) return;
        if (event.target.closest('[data-kg-card-toolbar]')) return;

        if (!isSelected) {
            event.preventDefault();
            skipFirstCardClickRef.current = true;
            clearSelection();
            setSelected(true);
            setIsEditing(false);
            return;
        }

        const nativeControl = event.target.closest('[data-card-control], input, textarea, select, button, [contenteditable="true"]');
        if (isEditing && nativeControl) {
            return;
        }
        event.preventDefault();
        setIsEditing(true);
        requestAnimationFrame(() => focusPrimaryCardControl(cardRef.current));
    };

    const beginEditing = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsEditing(true);
        requestAnimationFrame(() => focusPrimaryCardControl(cardRef.current));
    };

    return (
        <>
            <div
                ref={cardRef}
                data-kg-card={cardType}
                data-kg-card-selected={isSelected}
                data-kg-card-editing={isEditing}
                className={`relative border border-transparent caret-slate-800 transition-shadow ${isSelected ? 'z-20 shadow-[0_0_0_2px_#22c55e]' : 'z-10 hover:shadow-[0_0_0_1px_#22c55e]'}`}
                onMouseDown={handleCardMouseDown}
                onClickCapture={(event) => {
                    if (!skipFirstCardClickRef.current) return;
                    skipFirstCardClickRef.current = false;
                    event.preventDefault();
                    event.stopPropagation();
                }}
            >
                {isSelected && !isEditing ? (
                    <div data-kg-card-toolbar className="absolute left-1/2 top-0 z-30 flex -translate-x-1/2 -translate-y-[calc(100%+10px)] items-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
                        <button type="button" aria-label="Edit card" title="Edit card" className="flex size-10 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 hover:text-slate-950" onMouseDown={beginEditing}>
                            <Pencil className="size-5" strokeWidth={1.8} />
                        </button>
                    </div>
                ) : null}
                <CardPreview cardType={cardType} data={cardData} onChange={onChange} nodeKey={nodeKey} isEditing={isEditing} />
            </div>
            {showPanel ? <CardSettingsPanel cardType={cardType} data={cardData} onChange={onChange} nodeKey={nodeKey} panelRef={panelRef} position={position} /> : null}
        </>
    );
}

export class TakeerCardNode extends DecoratorNode {
    static getType() {
        return 'takeer_card';
    }

    static clone(node) {
        return new TakeerCardNode(node.__cardType, node.__data, node.__key);
    }

    static importJSON(serializedNode) {
        return $createTakeerCardNode(serializedNode.cardType, serializedNode.data || {});
    }

    constructor(cardType = 'divider', data = {}, key) {
        super(key);
        this.__cardType = cardType;
        this.__data = data && typeof data === 'object' ? data : {};
    }

    exportJSON() {
        return {
            type: 'takeer_card',
            version: 1,
            cardType: this.__cardType,
            data: this.__data,
        };
    }

    createDOM() {
        const element = document.createElement('div');
        element.className = 'takeer-card-node';
        return element;
    }

    updateDOM() {
        return false;
    }

    isInline() {
        return false;
    }

    getCardType() {
        return this.getLatest().__cardType;
    }

    getData() {
        return this.getLatest().__data;
    }

    isEmpty() {
        const data = this.getData() || {};
        switch (this.getCardType()) {
        case 'divider':
            return false;
        case 'gallery':
            return !(data.images || []).length;
        case 'image':
        case 'video':
        case 'audio':
        case 'file':
            return !(data.src || data.url);
        case 'bookmark':
        case 'embed':
            return !data.url;
        case 'button':
            return !(data.text || data.url);
        case 'callout':
            return !data.text;
        case 'toggle':
            return !(data.title || data.content);
        case 'email_cta':
            return !(data.body || data.image || data.buttonUrl);
        case 'gif':
            return !data.url;
        case 'header':
            return !(data.text || data.subheading || data.buttonUrl);
        case 'product':
            return !(data.title || data.description || data.image || data.buttonUrl);
        case 'markdown':
        case 'html':
            return !data.content;
        default:
            return !(data.content || data.text || data.url);
        }
    }

    setData(data) {
        const writable = this.getWritable();
        writable.__data = data && typeof data === 'object' ? data : {};
    }

    decorate() {
        return <CardView cardType={this.getCardType()} data={this.getData()} nodeKey={this.getKey()} />;
    }
}

export function $createTakeerCardNode(cardType, data = {}) {
    return $applyNodeReplacement(new TakeerCardNode(cardType, data));
}

export function $isTakeerCardNode(node) {
    return node instanceof TakeerCardNode;
}
