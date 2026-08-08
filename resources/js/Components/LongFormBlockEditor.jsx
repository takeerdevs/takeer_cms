import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    $createParagraphNode,
    $createNodeSelection,
    $getNodeByKey,
    $getRoot,
    $getSelection,
    $isDecoratorNode,
    $isNodeSelection,
    $isParagraphNode,
    $isRangeSelection,
    $setSelection,
    COMMAND_PRIORITY_HIGH,
    COMMAND_PRIORITY_EDITOR,
    FORMAT_TEXT_COMMAND,
    KEY_ARROW_DOWN_COMMAND,
    KEY_ARROW_LEFT_COMMAND,
    KEY_ARROW_RIGHT_COMMAND,
    KEY_ARROW_UP_COMMAND,
    KEY_BACKSPACE_COMMAND,
    KEY_DELETE_COMMAND,
    KEY_ENTER_COMMAND,
    KEY_ESCAPE_COMMAND,
    SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import {
    INSERT_ORDERED_LIST_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND,
    ListItemNode,
    ListNode,
} from '@lexical/list';
import { $setBlocksType } from '@lexical/selection';
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $createTakeerCardNode, TakeerCardNode, TakeerCardProvider } from '@/Components/TakeerCardNode';
import { EMPTY_LEXICAL_STATE, parseLexicalState } from '@/lib/longFormContent';
import axios from 'axios';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';
import {
    AtSign,
    Bookmark,
    Bold,
    Code2,
    FileCode2,
    FileText,
    GalleryHorizontalEnd,
    Globe,
    Heading,
    ImagePlus,
    Italic,
    Link2,
    MessageSquareWarning,
    MoreHorizontal,
    MousePointerClick,
    Minus,
    Music2,
    Paperclip,
    PanelTop,
    Plus,
    PlaySquare,
    Quote as QuoteIcon,
    Square,
    SquareChevronDown,
    Sparkles,
    Star,
    Twitter,
    Underline,
    Video,
    Youtube,
} from 'lucide-react';

const theme = {
    paragraph: 'takeer-paragraph',
    quote: 'border-l-4 border-brand-300 pl-4 italic text-muted-foreground',
    heading: {
        h1: 'text-3xl font-black tracking-tight',
        h2: 'text-2xl font-black tracking-tight',
        h3: 'text-xl font-black tracking-tight',
        h4: 'text-lg font-black tracking-tight',
    },
    list: {
        ul: 'ml-5 list-disc space-y-1',
        ol: 'ml-5 list-decimal space-y-1',
        listitem: 'pl-1',
    },
    link: 'text-brand-600 underline underline-offset-2',
    text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'line-through',
        code: 'rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]',
    },
};

function ToolbarButton({ children, label, onClick, disabled = false, className = '' }) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40 ${className}`}
        >
            {children}
        </button>
    );
}

function formatBlock(editor, blockType) {
    editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        if (blockType === 'paragraph') {
            $setBlocksType(selection, () => $createParagraphNode());
        } else if (blockType === 'quote') {
            $setBlocksType(selection, () => $createQuoteNode());
        } else {
            $setBlocksType(selection, () => $createHeadingNode(blockType));
        }
    });
}

const CARD_MENU_SECTIONS = [
    {
        label: 'Primary',
        items: [
            { key: 'image', label: 'Image', description: 'Upload, or embed with /image [url]', Icon: ImagePlus, cardType: 'image' },
            { key: 'divider', label: 'Divider', description: 'Insert a dividing line', Icon: Minus, cardType: 'divider' },
            { key: 'button', label: 'Button', description: 'Add a button to your post', Icon: Square, cardType: 'button' },
            { key: 'bookmark', label: 'Bookmark', description: 'Embed a link as a visual bookmark', Icon: Bookmark, cardType: 'bookmark' },
            { key: 'gallery', label: 'Gallery', description: 'Create an image gallery', Icon: GalleryHorizontalEnd, cardType: 'gallery' },
            { key: 'email-cta', label: 'Call to action', description: 'Target free or paid members with a CTA', Icon: MousePointerClick, cardType: 'email_cta' },
            { key: 'callout', label: 'Callout', description: 'Info boxes that stand out', Icon: MessageSquareWarning, cardType: 'callout' },
            { key: 'header', label: 'Header', description: 'Add a bold section header', Icon: PanelTop, cardType: 'header' },
            { key: 'toggle', label: 'Toggle', description: 'Add collapsible content', Icon: SquareChevronDown, cardType: 'toggle' },
            { key: 'video', label: 'Video', description: 'Upload and play a video', Icon: Video, cardType: 'video' },
            { key: 'audio', label: 'Audio', description: 'Upload and play an audio file', Icon: Music2, cardType: 'audio' },
            { key: 'file', label: 'File', description: 'Upload a downloadable file', Icon: Paperclip, cardType: 'file' },
            { key: 'product', label: 'Product', description: 'Add a product recommendation', Icon: Star, cardType: 'product' },
            { key: 'html', label: 'HTML', description: 'Insert a raw HTML card', Icon: FileCode2, cardType: 'html' },
            { key: 'markdown', label: 'Markdown', description: 'Insert a Markdown editor card', Icon: FileText, cardType: 'markdown' },
            { key: 'gif', label: 'GIF', description: 'Search and embed GIFs', Icon: Sparkles, cardType: 'gif' },
        ],
    },
    {
        label: 'Embeds',
        items: [
            { key: 'youtube', label: 'YouTube', description: '/youtube [video url]', Icon: Youtube, cardType: 'embed', provider: 'YouTube' },
            { key: 'twitter', label: 'X (formerly Twitter)', description: '/twitter [tweet url]', Icon: Twitter, cardType: 'embed', provider: 'X' },
            { key: 'unsplash', label: 'Unsplash', description: '/unsplash [search-term or url]', Icon: ImagePlus, cardType: 'embed', provider: 'Unsplash' },
            { key: 'vimeo', label: 'Vimeo', description: '/vimeo [video url]', Icon: PlaySquare, cardType: 'embed', provider: 'Vimeo' },
            { key: 'codepen', label: 'CodePen', description: '/codepen [pen url]', Icon: Code2, cardType: 'embed', provider: 'CodePen' },
            { key: 'spotify', label: 'Spotify', description: '/spotify [track or playlist url]', Icon: Globe, cardType: 'embed', provider: 'Spotify' },
            { key: 'soundcloud', label: 'SoundCloud', description: '/soundcloud [track or playlist url]', Icon: Music2, cardType: 'embed', provider: 'SoundCloud' },
            { key: 'nft', label: 'NFT', description: '/nft [opensea url]', Icon: AtSign, cardType: 'embed', provider: 'NFT' },
            { key: 'embed', label: 'Other...', description: '/embed [url]', Icon: MoreHorizontal, cardType: 'embed', provider: 'Embed' },
        ],
    },
];

function clearSlashQuery(selection) {
    const anchor = selection.anchor;
    if (anchor.type !== 'text') return;

    const node = anchor.getNode();
    if (!node.getTextContent().startsWith('/')) return;

    selection.setTextNodeRange(node, 0, node, anchor.offset);
    selection.removeText();
}

function insertCard(editor, cardType, data = {}, { clearSlash = false, selectionSnapshot = null } = {}) {
    editor.update(() => {
        if ($isRangeSelection(selectionSnapshot)) {
            const anchorNode = $getNodeByKey(selectionSnapshot.anchor.key);
            const focusNode = $getNodeByKey(selectionSnapshot.focus.key);
            if (anchorNode && focusNode) {
                $setSelection(selectionSnapshot.clone());
            }
        }

        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        if (clearSlash) clearSlashQuery(selection);

        const card = $createTakeerCardNode(cardType, data);
        const selectedNode = selection.focus.getNode().getTopLevelElement() || selection.focus.getNode();
        const selectedIsParagraph = $isParagraphNode(selectedNode);
        const selectedIsEmpty = selectedNode.getTextContent() === '';

        selectedNode.insertAfter(card);
        if (selectedIsParagraph && selectedIsEmpty) {
            selectedNode.remove();
        }

        const nodeSelection = $createNodeSelection();
        nodeSelection.add(card.getKey());
        $setSelection(nodeSelection);

        // Keep a keyboard insertion point after a card inserted at the end of
        // the document, matching Ghost's card boundary behaviour.
        if (!card.getNextSibling()) {
            card.insertAfter($createParagraphNode());
        }
    });
    editor.getRootElement()?.focus({ preventScroll: true });
}

function executeCardCommand(editor, item, { clearSlash = false, selectionSnapshot = null } = {}) {
    const data = {
        _startEditing: true,
        provider: item.provider || '',
        title: '',
        text: '',
        url: '',
        content: '',
        alignment: 'center',
    };

    if (item.cardType === 'callout') Object.assign(data, { emoji: '💡', background: '#eaf6ff', showEmoji: true });
    if (item.cardType === 'button') Object.assign(data, { text: '', url: '', alignment: 'center' });
    if (item.cardType === 'gallery') Object.assign(data, { images: [], caption: '' });
    if (item.cardType === 'header') Object.assign(data, {alignment: 'center', layout: 'regular', subheading: '', background: '#000000', showButton: false, buttonColor: '#ffffff', buttonText: '', buttonUrl: ''});
    if (item.cardType === 'product') Object.assign(data, {description: '', image: '', showRating: true, showButton: true, buttonText: 'Learn more', buttonUrl: ''});
    if (item.cardType === 'email_cta') Object.assign(data, {
        alignment: 'left',
        body: '',
        buttonText: 'Learn more',
        buttonUrl: '',
        showButton: false,
        showSponsor: false,
        publicVisitors: true,
        webFreeMembers: true,
        emailFreeMembers: true,
    });

    return insertCard(editor, item.cardType, data, { clearSlash, selectionSnapshot });
}

function blockPosition(editor, containerRef) {
    let blockKey = null;
    editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
        const block = selection.anchor.getNode().getTopLevelElement();
        if (!$isParagraphNode(block) || block.getTextContent() !== '') return;
        blockKey = block.getKey();
    });

    if (!blockKey || !containerRef.current) return null;
    const blockElement = editor.getElementByKey(blockKey);
    if (!blockElement) return null;

    const shellRect = containerRef.current.getBoundingClientRect();
    const blockRect = blockElement.getBoundingClientRect();
    return {
        top: blockRect.top - shellRect.top + Math.min(blockRect.height / 2, 18) - 16,
        left: 24,
        menu: fitMenuToViewport(
            blockRect.top + Math.min(blockRect.height / 2, 18) - 16,
            shellRect.left + 60,
        ),
    };
}

function fitMenuToViewport(top, left) {
    const gutter = 16;
    const menuWidth = Math.min(348, window.innerWidth - gutter * 2);
    const menuHeight = Math.min(420, window.innerHeight - gutter * 2);
    return {
        top: Math.max(gutter, Math.min(top, window.innerHeight - menuHeight - gutter)),
        left: Math.max(gutter, Math.min(left, window.innerWidth - menuWidth - gutter)),
    };
}

function caretPosition(editor) {
    const rootElement = editor.getRootElement();
    const nativeSelection = window.getSelection();
    if (!rootElement || !nativeSelection || nativeSelection.rangeCount === 0) return null;

    const range = nativeSelection.getRangeAt(0);
    if (!rootElement.contains(range.commonAncestorContainer)) return null;
    const rangeRect = range.getBoundingClientRect();
    if (!rangeRect.width && !rangeRect.height) {
        const blockElement = range.startContainer.parentElement?.closest('[data-lexical-node]') || range.startContainer.parentElement?.closest('p');
        const blockRect = blockElement?.getBoundingClientRect();
        if (!blockRect) return null;
        return fitMenuToViewport(blockRect.bottom + 8, blockRect.left);
    }
    return fitMenuToViewport(rangeRect.bottom + 8, Math.max(16, rangeRect.left));
}

function FloatingFormatToolbarPlugin({ containerRef }) {
    const [editor] = useLexicalComposerContext();
    const [position, setPosition] = useState(null);

    useEffect(() => {
        let frame = null;
        const update = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const rootElement = editor.getRootElement();
                const nativeSelection = window.getSelection();
                if (!rootElement || !nativeSelection || nativeSelection.rangeCount === 0 || nativeSelection.isCollapsed) {
                    setPosition(null);
                    return;
                }

                const range = nativeSelection.getRangeAt(0);
                if (!rootElement.contains(range.commonAncestorContainer)) {
                    setPosition(null);
                    return;
                }

                const rangeRect = range.getBoundingClientRect();
                const shellRect = containerRef.current?.getBoundingClientRect();
                if (!shellRect || (!rangeRect.width && !rangeRect.height)) {
                    setPosition(null);
                    return;
                }

                const top = rangeRect.top - shellRect.top - 48 >= 8
                    ? rangeRect.top - shellRect.top - 48
                    : rangeRect.bottom - shellRect.top + 8;
                setPosition({ top, left: rangeRect.left - shellRect.left + rangeRect.width / 2 });
            });
        };

        const removeUpdate = editor.registerUpdateListener(update);
        const removeSelection = editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
            update();
            return false;
        }, COMMAND_PRIORITY_EDITOR);
        document.addEventListener('selectionchange', update);
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        update();

        return () => {
            removeUpdate();
            removeSelection();
            document.removeEventListener('selectionchange', update);
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [containerRef, editor]);

    if (!position) return null;

    return (
        <div
            className="absolute z-30 flex items-center gap-0.5 rounded-xl border border-slate-700 bg-slate-900 p-1 text-white shadow-2xl"
            style={{ top: position.top, left: position.left, transform: 'translateX(-50%)' }}
            onMouseDown={(event) => event.preventDefault()}
        >
            <ToolbarButton label="Bold" className="text-white hover:bg-white/15 hover:text-white" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}><Bold className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label="Italic" className="text-white hover:bg-white/15 hover:text-white" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}><Italic className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label="Underline" className="text-white hover:bg-white/15 hover:text-white" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}><Underline className="h-4 w-4" /></ToolbarButton>
            <span className="mx-1 h-5 w-px bg-white/20" />
            <ToolbarButton label="Heading 2" className="text-white hover:bg-white/15 hover:text-white" onClick={() => formatBlock(editor, 'h2')}>H2</ToolbarButton>
            <ToolbarButton label="Heading 3" className="text-white hover:bg-white/15 hover:text-white" onClick={() => formatBlock(editor, 'h3')}>H3</ToolbarButton>
            <ToolbarButton label="Quote" className="text-white hover:bg-white/15 hover:text-white" onClick={() => formatBlock(editor, 'quote')}><QuoteIcon className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton
                label="Add link"
                className="text-white hover:bg-white/15 hover:text-white"
                onClick={() => {
                    const url = window.prompt('Paste a link');
                    if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim());
                }}
            >
                <Link2 className="h-4 w-4" />
            </ToolbarButton>
        </div>
    );
}

async function uploadCardFileToNode({ editor, file, nodeKey, cardType, uploadUrl, uploadFields, onUploadingChange, copy }) {
    if (!file) return;

    onUploadingChange(true);
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'public');
        formData.append('folder', 'content');
        Object.entries(uploadFields || {}).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') formData.append(key, value);
        });

        const response = await axios.post(uploadUrl, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        const src = response.data?.url;
        if (!src) throw new Error('The upload response did not include a URL.');
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (!node || typeof node.getData !== 'function' || typeof node.setData !== 'function') return;
            const current = node.getData() || {};
            const next = {...current};
            if (cardType === 'gallery') {
                next.images = [...(current.images || []), src].slice(0, 9);
            } else if (cardType === 'email_cta') {
                next.image = src;
            } else {
                next.src = src;
                next.url = src;
                next.name = file.name || current.name || '';
                next.size = file.size || current.size || 0;
            }
            node.setData(next);
        });
    } catch (error) {
        toast.error(error.response?.data?.message || copy('Upload failed.', 'Imeshindikana kupakia.'));
    } finally {
        onUploadingChange(false);
    }
}

function selectDecoratorNode(editor, node) {
    const nodeSelection = $createNodeSelection();
    nodeSelection.add(node.getKey());
    $setSelection(nodeSelection);
    editor.getRootElement()?.focus({ preventScroll: true });
}

function removeSelectedCard(editor, cardNode, direction = 'forward') {
    const previousSibling = cardNode.getPreviousSibling();
    const nextSibling = cardNode.getNextSibling();
    const sibling = direction === 'backward' ? previousSibling : nextSibling;

    if (sibling) {
        if ($isDecoratorNode(sibling)) {
            selectDecoratorNode(editor, sibling);
        } else if (direction === 'backward' && typeof sibling.selectEnd === 'function') {
            sibling.selectEnd();
        } else if (typeof sibling.selectStart === 'function') {
            sibling.selectStart();
        }
    } else {
        const paragraph = $createParagraphNode();
        $getRoot().append(paragraph);
        paragraph.select();
    }

    cardNode.remove();
    editor.getRootElement()?.focus({ preventScroll: true });
}

function isCollapsedAtStart(selection) {
    return selection.isCollapsed() && selection.anchor.offset === 0 && selection.focus.offset === 0;
}

function isCollapsedAtEnd(selection, topLevelElement) {
    if (!selection.isCollapsed() || !topLevelElement) return false;

    const anchorNode = selection.anchor.getNode();
    if (selection.anchor.type === 'element') {
        return anchorNode === topLevelElement && selection.anchor.offset === topLevelElement.getChildrenSize();
    }

    return selection.anchor.offset === anchorNode.getTextContentSize() && anchorNode.getParent()?.getLastChild()?.is(anchorNode);
}

function CardBehaviourPlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const removeBackspace = editor.registerCommand(KEY_BACKSPACE_COMMAND, (event) => {
            // Let inline card inputs keep their own native caret/delete behavior.
            if (document.activeElement !== editor.getRootElement()) return false;

            const selection = $getSelection();
            if ($isNodeSelection(selection)) {
                const selectedNode = selection.getNodes()[0];
                if (!$isDecoratorNode(selectedNode)) return false;
                event?.preventDefault();
                removeSelectedCard(editor, selectedNode, 'backward');
                return true;
            }

            if (!$isRangeSelection(selection) || !isCollapsedAtStart(selection)) return false;

            const anchorNode = selection.anchor.getNode();
            const topLevelElement = anchorNode.getTopLevelElement();
            const previousSibling = topLevelElement?.getPreviousSibling();
            if (!$isParagraphNode(topLevelElement) || !$isDecoratorNode(previousSibling)) return false;

            // Ghost treats an empty paragraph after a card as a boundary. The
            // first backspace removes the empty line and selects the card.
            if (topLevelElement.isEmpty()) {
                event?.preventDefault();
                topLevelElement.remove();
                selectDecoratorNode(editor, previousSibling);
                return true;
            }

            // At the beginning of a real text block, remove the card before it
            // while leaving the current text selection/caret untouched.
            event?.preventDefault();
            previousSibling.remove();
            return true;
        }, COMMAND_PRIORITY_HIGH);

        const removeDelete = editor.registerCommand(KEY_DELETE_COMMAND, (event) => {
            if (document.activeElement !== editor.getRootElement()) return false;

            const selection = $getSelection();
            if ($isNodeSelection(selection)) {
                const selectedNode = selection.getNodes()[0];
                if (!$isDecoratorNode(selectedNode)) return false;
                event?.preventDefault();
                removeSelectedCard(editor, selectedNode, 'forward');
                return true;
            }

            if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

            const anchorNode = selection.anchor.getNode();
            const topLevelElement = anchorNode.getTopLevelElement();
            const nextSibling = topLevelElement?.getNextSibling();
            const emptyParagraph = $isParagraphNode(topLevelElement) && topLevelElement.isEmpty() && selection.anchor.offset === 0;

            if (emptyParagraph && $isDecoratorNode(nextSibling)) {
                event?.preventDefault();
                topLevelElement.remove();
                selectDecoratorNode(editor, nextSibling);
                return true;
            }

            if (isCollapsedAtEnd(selection, topLevelElement) && $isDecoratorNode(nextSibling)) {
                event?.preventDefault();
                nextSibling.remove();
                editor.getRootElement()?.focus({ preventScroll: true });
                return true;
            }

            return false;
        }, COMMAND_PRIORITY_HIGH);

        const removeArrowLeft = editor.registerCommand(KEY_ARROW_LEFT_COMMAND, (event) => {
            if (document.activeElement !== editor.getRootElement()) return false;
            const selection = $getSelection();
            if (!$isNodeSelection(selection)) return false;
            const currentNode = selection.getNodes()[0];
            const previousSibling = currentNode.getPreviousSibling() || currentNode.getTopLevelElement()?.getPreviousSibling();
            if (!$isDecoratorNode(previousSibling)) return false;
            event?.preventDefault();
            selectDecoratorNode(editor, previousSibling);
            return true;
        }, COMMAND_PRIORITY_HIGH);

        const removeArrowRight = editor.registerCommand(KEY_ARROW_RIGHT_COMMAND, (event) => {
            if (document.activeElement !== editor.getRootElement()) return false;
            const selection = $getSelection();
            if (!$isNodeSelection(selection)) return false;
            const selectedNodes = selection.getNodes();
            const currentNode = selectedNodes[selectedNodes.length - 1];
            const nextSibling = currentNode.getNextSibling() || currentNode.getTopLevelElement()?.getNextSibling();
            if (!$isDecoratorNode(nextSibling)) return false;
            event?.preventDefault();
            selectDecoratorNode(editor, nextSibling);
            return true;
        }, COMMAND_PRIORITY_HIGH);

        return () => {
            removeBackspace();
            removeDelete();
            removeArrowLeft();
            removeArrowRight();
        };
    }, [editor]);

    return null;
}

function filterCardMenu(query) {
    const normalized = String(query || '').trim().toLowerCase();
    return CARD_MENU_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => !normalized || `${item.key} ${item.label} ${item.description}`.toLowerCase().includes(normalized)),
    })).filter((section) => section.items.length > 0);
}

function CardMenuPanel({ menuSections, activeIndex, onSelect, onBeforeSelect, menuRef }) {
    let itemIndex = 0;

    return (
        <div
            ref={menuRef}
            className="not-kg-prose m-0 mb-3 max-h-[420px] w-[348px] max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white p-0 font-sans text-sm shadow-[0_18px_45px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-slate-950"
            data-kg-card-menu
            role="menu"
            onMouseDown={(event) => event.preventDefault()}
        >
            {menuSections.map((section) => (
                <section key={section.label} className="border-t border-slate-200 first:border-t-0 dark:border-slate-800" role="separator">
                    <div className="flex items-center px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {section.label}
                    </div>
                    <div className="px-2 pb-2" role="menu">
                        {section.items.map((item) => {
                            const currentIndex = itemIndex;
                            itemIndex += 1;
                            const Icon = item.Icon;
                            const isSelected = currentIndex === activeIndex;

                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    data-kg-cardmenu-idx={currentIndex}
                                    data-kg-card-menu-item={item.label}
                                    role="menuitem"
                                    className={`group flex w-full cursor-pointer flex-row items-center gap-3 rounded-md border border-transparent px-2 py-1.5 text-left text-slate-800 transition dark:text-slate-200 ${isSelected ? 'bg-slate-100 dark:bg-slate-900' : 'hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                                    onMouseDown={(event) => {
                                        onBeforeSelect?.();
                                        event.preventDefault();
                                    }}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        onSelect(item);
                                    }}
                                    >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-slate-700 dark:bg-transparent dark:text-slate-400">
                                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium leading-snug tracking-[0.02rem] text-slate-900 dark:text-slate-100">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}

function CardMenuPlugin({ containerRef }) {
    const [editor] = useLexicalComposerContext();
    const [plusPosition, setPlusPosition] = useState(null);
    const [menuMode, setMenuMode] = useState(null);
    const [query, setQuery] = useState('');
    const [menuPosition, setMenuPosition] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const menuRef = useRef(null);
    const menuSelectionRef = useRef(null);
    const menuSections = useMemo(() => filterCardMenu(query), [query]);
    const menuItems = useMemo(() => menuSections.flatMap((section) => section.items), [menuSections]);

    const captureMenuSelection = useCallback(() => {
        editor.getEditorState().read(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                menuSelectionRef.current = selection.clone();
            }
        });
    }, [editor]);

    const closeMenu = useCallback(() => {
        setMenuMode(null);
        setQuery('');
        setMenuPosition(null);
        setActiveIndex(0);
        menuSelectionRef.current = null;
    }, []);

    const updatePlusPosition = useCallback(() => {
        const nextPosition = blockPosition(editor, containerRef);
        setPlusPosition(nextPosition);
        if (menuMode === 'plus') {
            setMenuPosition(nextPosition?.menu || null);
            if (!nextPosition) closeMenu();
        } else if (menuMode === 'slash') {
            setMenuPosition(caretPosition(editor));
        }
    }, [closeMenu, containerRef, editor, menuMode]);

    useEffect(() => {
        let frame = null;
        const update = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(updatePlusPosition);
        };

        const removeUpdate = editor.registerUpdateListener(update);
        const removeSelection = editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
            update();
            return false;
        }, COMMAND_PRIORITY_EDITOR);
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        update();

        return () => {
            removeUpdate();
            removeSelection();
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [editor, updatePlusPosition]);

    useEffect(() => editor.registerUpdateListener(({ editorState }) => {
        if (editor.isComposing()) return;

        let nextQuery = null;
        editorState.read(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || !selection.isCollapsed() || selection.anchor.type !== 'text') return;

            const node = selection.anchor.getNode();
            const block = node.getTopLevelElement();
            const text = node.getTextContent().slice(0, selection.anchor.offset);
            if ($isParagraphNode(block) && text.startsWith('/')) {
                nextQuery = text.slice(1);
                menuSelectionRef.current = selection.clone();
            }
        });

        if (nextQuery === null) {
            if (menuMode === 'slash') closeMenu();
            return;
        }

        setMenuMode('slash');
        setQuery(nextQuery);
        setActiveIndex(0);
        requestAnimationFrame(() => setMenuPosition(caretPosition(editor) || plusPosition?.menu || null));
    }), [closeMenu, containerRef, editor, menuMode, plusPosition]);

    const selectItem = useCallback((item) => {
        const source = menuMode;
        if (!source) return;

        executeCardCommand(editor, item, {
            clearSlash: source === 'slash',
            selectionSnapshot: menuSelectionRef.current,
        });
        closeMenu();
    }, [closeMenu, editor, menuMode]);

    useEffect(() => {
        if (!menuMode || menuItems.length === 0) return undefined;

        const move = (direction) => {
            setActiveIndex((current) => (current + direction + menuItems.length) % menuItems.length);
        };
        const removeArrowDown = editor.registerCommand(KEY_ARROW_DOWN_COMMAND, (event) => {
            event?.preventDefault();
            move(1);
            return true;
        }, COMMAND_PRIORITY_HIGH);
        const removeArrowUp = editor.registerCommand(KEY_ARROW_UP_COMMAND, (event) => {
            event?.preventDefault();
            move(-1);
            return true;
        }, COMMAND_PRIORITY_HIGH);
        const removeArrowRight = editor.registerCommand(KEY_ARROW_RIGHT_COMMAND, (event) => {
            event?.preventDefault();
            move(1);
            return true;
        }, COMMAND_PRIORITY_HIGH);
        const removeArrowLeft = editor.registerCommand(KEY_ARROW_LEFT_COMMAND, (event) => {
            event?.preventDefault();
            move(-1);
            return true;
        }, COMMAND_PRIORITY_HIGH);
        const removeEnter = editor.registerCommand(KEY_ENTER_COMMAND, (event) => {
            event?.preventDefault();
            selectItem(menuItems[activeIndex]);
            return true;
        }, COMMAND_PRIORITY_HIGH);
        const removeEscape = editor.registerCommand(KEY_ESCAPE_COMMAND, (event) => {
            event?.preventDefault();
            closeMenu();
            return true;
        }, COMMAND_PRIORITY_HIGH);

        return () => {
            removeArrowDown();
            removeArrowUp();
            removeArrowRight();
            removeArrowLeft();
            removeEnter();
            removeEscape();
        };
    }, [activeIndex, closeMenu, editor, menuItems, menuMode, selectItem]);

    useEffect(() => {
        if (!menuMode) return undefined;

        const closeOnOutsideClick = (event) => {
            if (menuRef.current?.contains(event.target) || event.target.closest?.('[data-takeer-card-menu-trigger]')) return;
            closeMenu();
        };
        window.addEventListener('mousedown', closeOnOutsideClick);
        return () => window.removeEventListener('mousedown', closeOnOutsideClick);
    }, [closeMenu, menuMode]);

    useEffect(() => {
        if (!menuMode) return;
        menuRef.current?.querySelector(`[data-kg-cardmenu-idx="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, menuMode, menuItems]);

    const openPlusMenu = (event) => {
        event.preventDefault();
        if (!plusPosition) return;
        captureMenuSelection();
        setQuery('');
        setActiveIndex(0);
        setMenuPosition(plusPosition.menu);
        setMenuMode((current) => current === 'plus' ? null : 'plus');
    };

    const menuStyle = { top: menuPosition?.top || 0, left: menuPosition?.left || 0 };

    return (
        <>
            {plusPosition && menuMode !== 'slash' ? (
                <button
                    type="button"
                    aria-label="Add a card"
                    title="Add a card"
                    data-takeer-card-menu-trigger
                    className="absolute z-[10000000] inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:border-slate-800 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                    style={{ top: plusPosition.top, left: plusPosition.left, transform: 'translateX(-50%)' }}
                    onMouseDown={(event) => {
                        captureMenuSelection();
                        event.preventDefault();
                    }}
                    onClick={openPlusMenu}
                >
                    <Plus className="h-5 w-5" strokeWidth={1.8} />
                </button>
            ) : null}
            {menuMode && menuPosition && typeof document !== 'undefined' ? createPortal(
                <div className="fixed z-[2147483001]" style={menuStyle}>
                    <CardMenuPanel
                        menuSections={menuSections}
                        activeIndex={activeIndex}
                        onSelect={selectItem}
                        onBeforeSelect={captureMenuSelection}
                        menuRef={menuRef}
                    />
                </div>,
                document.body,
            ) : null}
        </>
    );
}

function EditorShell({ placeholder, onChange }) {
    const shellRef = useRef(null);

    return (
        <div ref={shellRef} className="relative overflow-visible rounded-2xl border bg-background">
            <div className="relative">
                <RichTextPlugin
                    contentEditable={<ContentEditable className="mx-auto min-h-[360px] max-w-3xl px-8 py-10 text-base leading-8 outline-none sm:px-12 [&>p]:my-5 [&>h1]:mb-5 [&>h1]:mt-10 [&>h2]:mb-4 [&>h2]:mt-9 [&>h3]:mb-3 [&>h3]:mt-8 [&>.takeer-card-node]:my-8" />}
                    placeholder={<div className="pointer-events-none absolute left-8 right-8 top-10 mx-auto max-w-3xl text-base text-muted-foreground/70 sm:left-12 sm:right-12">{placeholder}</div>}
                    ErrorBoundary={LexicalErrorBoundary}
                />
                <FloatingFormatToolbarPlugin containerRef={shellRef} />
                <CardMenuPlugin containerRef={shellRef} />
                <CardBehaviourPlugin />
            </div>
            <HistoryPlugin />
            <ListPlugin />
            <LinkPlugin />
            <OnChangePlugin onChange={onChange} ignoreSelectionChange />
        </div>
    );
}

export default function LongFormBlockEditor({
    value,
    onChange,
    placeholder = 'Start writing your long-form content...',
    uploadUrl = '/merchant/content/upload/media',
    uploadFields = {},
    bookmarkSearchUrl = '/merchant/posts/api',
}) {
    const { copy } = useLocale();
    const [uploadingImage, setUploadingImage] = useState(false);
    const uploadCardFile = useCallback(({editor, file, nodeKey, cardType}) => uploadCardFileToNode({
        editor,
        file,
        nodeKey,
        cardType,
        uploadUrl,
        uploadFields,
        onUploadingChange: setUploadingImage,
        copy,
    }), [copy, uploadFields, uploadUrl]);
    const initialState = useMemo(() => parseLexicalState(value), [value]);

    const initialConfig = useMemo(() => ({
        namespace: 'TakeerLongFormEditor',
        theme,
        editorState: JSON.stringify(initialState || EMPTY_LEXICAL_STATE),
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, TakeerCardNode],
        onError(error) {
            throw error;
        },
    }), [initialState]);

    return (
        <div className="space-y-2">
            <LexicalComposer initialConfig={initialConfig}>
                <TakeerCardProvider uploadFile={uploadCardFile} bookmarkSearchUrl={bookmarkSearchUrl}>
                    <EditorShell
                        placeholder={copy(placeholder, placeholder === 'Start writing your long-form content...' ? 'Anza kuandika content yako ndefu...' : placeholder)}
                        onChange={(editorState) => onChange?.(JSON.stringify(editorState.toJSON()))}
                    />
                </TakeerCardProvider>
            </LexicalComposer>
            {uploadingImage ? <p className="text-xs text-muted-foreground">{copy('Uploading image...', 'Inapakia picha...')}</p> : null}
            <p className="px-2 text-[11px] text-muted-foreground">Type “/” or use “+” to add a block</p>
        </div>
    );
}
