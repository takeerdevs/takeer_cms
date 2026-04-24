import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Heart, MessageCircle, CornerDownRight } from 'lucide-react';

// Stub comments — in production replace with API fetch by postId
const STUB_COMMENTS = [
    { id: 1, author: 'Amina K.', avatar: 'A', text: 'Naipenda sana hii bidhaa! 🔥', time: '2m', likes: 14, replies: [] },
    {
        id: 2, author: 'Juma Hassan', avatar: 'J', text: 'Bei gani rafiki? Nipeleke inbox.', time: '5m', likes: 3,
        replies: [{ id: 21, author: '@muuzaji', avatar: 'M', text: 'TZS 35,000 tu! DM niTuma.', time: '4m', likes: 7 }]
    },
    { id: 3, author: 'Fatma S.', avatar: 'F', text: 'Ahhh yangu yangu yangu 😍😍', time: '12m', likes: 22, replies: [] },
    { id: 4, author: 'Khamis B.', avatar: 'K', text: 'Hizi zinapatikana Dar es Salaam?', time: '20m', likes: 1, replies: [] },
    { id: 5, author: 'Zuhura M.', avatar: 'Z', text: 'Post nyingine za hizi please! 👏', time: '1h', likes: 9, replies: [] },
];

function CommentBubble({ comment, isReply = false }) {
    const [liked, setLiked] = useState(false);
    const [count, setCount] = useState(comment.likes);
    const [showReplies, setShowReplies] = useState(false);

    return (
        <div className={`flex gap-3 ${isReply ? 'pl-10' : ''}`}>
            {/* Avatar */}
            <div className={`${isReply ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'} shrink-0 rounded-full bg-brand-100 dark:bg-brand-900/40 border border-border flex items-center justify-center font-bold text-brand-700`}>
                {comment.avatar}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-xs font-bold text-foreground">{comment.author}</span>
                    <span className="text-[10px] text-muted-foreground">{comment.time}</span>
                </div>
                <p className="text-sm text-foreground leading-snug">{comment.text}</p>
                <div className="flex items-center gap-4 mt-1.5">
                    <button
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => { setLiked(l => !l); setCount(c => liked ? c - 1 : c + 1); }}
                    >
                        <Heart className={`h-3.5 w-3.5 ${liked ? 'fill-red-500 text-red-500' : ''}`} strokeWidth={1.5} />
                        {count > 0 && <span>{count}</span>}
                    </button>
                    {!isReply && (
                        <button
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                            onClick={() => setShowReplies(s => !s)}
                        >
                            <CornerDownRight className="h-3 w-3" />
                            Jibu {comment.replies?.length > 0 && `(${comment.replies.length})`}
                        </button>
                    )}
                </div>
                {/* Replies */}
                <AnimatePresence>
                    {showReplies && comment.replies?.map(reply => (
                        <motion.div
                            key={reply.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3"
                        >
                            <CommentBubble comment={reply} isReply />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default function CommentsModal({ post, isOpen, onClose }) {
    const [text, setText] = useState('');
    const [comments, setComments] = useState(STUB_COMMENTS);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 400);
        }
    }, [isOpen]);

    const handleSend = () => {
        if (!text.trim()) return;
        const newComment = {
            id: Date.now(),
            author: 'Wewe',
            avatar: 'W',
            text: text.trim(),
            time: 'Sasa',
            likes: 0,
            replies: [],
        };
        setComments(c => [newComment, ...c]);
        setText('');
        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Sheet */}
                    <motion.div
                        key="sheet"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 32, stiffness: 380 }}
                        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-background rounded-t-3xl shadow-2xl border-t border-border overflow-hidden"
                        style={{ maxHeight: '75dvh' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-1 shrink-0">
                            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="h-5 w-5 text-foreground" />
                                <h2 className="text-base font-bold">{comments.length} Maoni</h2>
                            </div>
                            <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-accent transition-colors">
                                <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Comment list */}
                        <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5 overscroll-contain">
                            {comments.map(c => <CommentBubble key={c.id} comment={c} />)}
                        </div>

                        {/* Input */}
                        <div className="shrink-0 px-4 py-3 border-t bg-background/90 backdrop-blur-sm flex items-center gap-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                            <div className="h-9 w-9 rounded-full bg-brand-100 border border-border flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">W</div>
                            <div className="flex-1 flex items-center gap-2 bg-muted rounded-2xl px-4 py-2 border border-border">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Andika maoni yako..."
                                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                />
                                <motion.button
                                    whileTap={{ scale: 0.85 }}
                                    onClick={handleSend}
                                    disabled={!text.trim()}
                                    className="text-brand-600 disabled:opacity-30 transition-opacity"
                                >
                                    <Send className="h-5 w-5" strokeWidth={2} />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
