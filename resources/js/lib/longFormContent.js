export const LONG_FORM_FORMAT = 'lexical';

export const EMPTY_LEXICAL_STATE = {
    root: {
        children: [
            {
                children: [],
                direction: null,
                format: '',
                indent: 0,
                type: 'paragraph',
                version: 1,
            },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
    },
};

export function parseLexicalState(value) {
    if (value && typeof value === 'object' && value.root?.type === 'root') {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && parsed.root?.type === 'root') {
                return parsed;
            }
        } catch {
            // Invalid editor state is intentionally treated as empty.
        }
    }

    return EMPTY_LEXICAL_STATE;
}

export function isLexicalDocument(value) {
    return Boolean(value && typeof value === 'object' && value.root?.type === 'root')
        || (typeof value === 'string' && (() => {
            try {
                const parsed = JSON.parse(value);
                return Boolean(parsed?.root?.type === 'root');
            } catch {
                return false;
            }
        })());
}

function textFromNode(node) {
    if (!node || typeof node !== 'object') return '';

    if (node.type === 'text') return node.text || '';
    if (node.type === 'linebreak') return '\n';
    if (node.type === 'takeer_card') {
        const data = node.data && typeof node.data === 'object' ? node.data : {};
        return [data.alt, data.caption, data.title, data.text, data.url].filter(Boolean).join(' ');
    }

    const children = Array.isArray(node.children) ? node.children : [];
    return children.map(textFromNode).join(node.type === 'listitem' ? '\n' : '');
}

export function lexicalToPlainText(value) {
    const state = parseLexicalState(value);
    return textFromNode(state.root).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
