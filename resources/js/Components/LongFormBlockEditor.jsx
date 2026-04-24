import React, { useEffect, useRef, useState } from 'react';
import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Delimiter from '@editorjs/delimiter';
import Checklist from '@editorjs/checklist';
import Embed from '@editorjs/embed';
import ImageTool from '@editorjs/image';
import axios from 'axios';
import { toast } from 'sonner';

function toEditorData(value) {
    if (!value) {
        return { blocks: [] };
    }

    try {
        const parsed = JSON.parse(value);
        if (parsed && Array.isArray(parsed.blocks)) {
            return parsed;
        }
    } catch {
        // Fallback below when existing records are plain text/html.
    }

    return {
        blocks: [
            {
                type: 'paragraph',
                data: { text: String(value) },
            },
        ],
    };
}

export default function LongFormBlockEditor({ value, onChange, placeholder = 'Start writing your long-form content...' }) {
    const holderIdRef = useRef(`editorjs-${Math.random().toString(36).slice(2)}`);
    const editorRef = useRef(null);
    const onChangeRef = useRef(onChange);
    const initialValueRef = useRef(value);
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        let mounted = true;

        async function initEditor() {
            if (editorRef.current) {
                await editorRef.current.isReady;
                editorRef.current.destroy();
                editorRef.current = null;
            }

            const editor = new EditorJS({
                holder: holderIdRef.current,
                placeholder,
                autofocus: false,
                data: toEditorData(initialValueRef.current),
                inlineToolbar: true,
                tools: {
                    header: {
                        class: Header,
                        inlineToolbar: ['link', 'bold', 'italic'],
                        config: { levels: [2, 3, 4], defaultLevel: 2 },
                    },
                    list: {
                        class: List,
                        inlineToolbar: true,
                    },
                    checklist: {
                        class: Checklist,
                        inlineToolbar: true,
                    },
                    quote: {
                        class: Quote,
                        inlineToolbar: true,
                    },
                    delimiter: Delimiter,
                    embed: {
                        class: Embed,
                        inlineToolbar: false,
                    },
                    image: {
                        class: ImageTool,
                        config: {
                            uploader: {
                                async uploadByFile(file) {
                                    setUploadingImage(true);
                                    try {
                                        const formData = new FormData();
                                        formData.append('file', file);
                                        formData.append('type', 'public');
                                        formData.append('folder', 'content');

                                        const res = await axios.post('/merchant/upload/media', formData, {
                                            headers: { 'Content-Type': 'multipart/form-data' },
                                        });

                                        return {
                                            success: 1,
                                            file: {
                                                url: res.data?.url,
                                            },
                                        };
                                    } catch (error) {
                                        toast.error(error.response?.data?.message || 'Image upload failed.');
                                        return { success: 0 };
                                    } finally {
                                        setUploadingImage(false);
                                    }
                                },
                            },
                        },
                    },
                },
                onChange: async () => {
                    if (!mounted || !editorRef.current) return;

                    const output = await editorRef.current.save();
                    onChangeRef.current?.(JSON.stringify(output));
                },
            });

            editorRef.current = editor;
        }

        initEditor();

        return () => {
            mounted = false;
            if (editorRef.current) {
                editorRef.current.destroy();
                editorRef.current = null;
            }
        };
    }, [placeholder]);

    return (
        <div className="space-y-2">
            <div className="rounded-2xl border bg-background">
                <div id={holderIdRef.current} className="px-4 py-4 min-h-[100px]" />
            </div>
            {uploadingImage ? <p className="text-xs text-muted-foreground">Uploading image...</p> : null}
        </div>
    );
}
