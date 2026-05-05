import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import axios from 'axios';

export default function LikeButton({ postId, initialCount = 0, initialLiked = false, variant = 'horizontal' }) {
    const [liked, setLiked] = useState(initialLiked);
    const [count, setCount] = useState(initialCount);
    const [burst, setBurst] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        if (!window.Echo || !postId) return;

        const channel = window.Echo.channel('posts');
        const listener = (event) => {
            if (String(event.post_id) !== String(postId)) return;
            const nextCount = Number(event.like_count ?? event.likes_count);
            if (Number.isFinite(nextCount)) {
                setCount(nextCount);
            }
        };

        channel.listen('.post.engagement.updated', listener);

        return () => {
            channel.stopListening('.post.engagement.updated', listener);
        };
    }, [postId]);

    const toggle = async (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (isSyncing) return;

        const nextLiked = !liked;
        setLiked(nextLiked);
        setCount(c => nextLiked ? c + 1 : c - 1);
        if (nextLiked) { setBurst(true); setTimeout(() => setBurst(false), 700); }

        setIsSyncing(true);
        try {
            const res = await axios.post(`/api/posts/${postId}/like`);
            setLiked(res.data.liked);
            setCount(res.data.like_count);
        } catch (e) {
            setLiked(!nextLiked);
            setCount(c => nextLiked ? c - 1 : c + 1);
        } finally {
            setIsSyncing(false);
        }
    };

    const fmt = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n || '';

    if (variant === 'vertical') {
        return (
            <div className="relative flex flex-col items-center gap-1">
                {/* Burst particles */}
                <AnimatePresence>
                    {burst && [0, 1, 2, 3, 4, 5].map(i => {
                        const angle = (i / 6) * Math.PI * 2;
                        return (
                            <motion.div
                                key={i}
                                className="absolute w-2 h-2 rounded-full bg-red-500 pointer-events-none"
                                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                animate={{
                                    x: Math.cos(angle) * 28,
                                    y: Math.sin(angle) * 28,
                                    opacity: 0,
                                    scale: 0,
                                }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.55, ease: 'easeOut' }}
                            />
                        );
                    })}
                </AnimatePresence>

                <motion.button
                    onClick={toggle}
                    whileTap={{ scale: 0.75 }}
                    animate={liked ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="w-12 h-12 flex items-center justify-center rounded-full bg-black/25 backdrop-blur-lg border border-white/15 active:bg-white/20 transition-colors"
                    aria-label="Penda"
                >
                    <Heart
                        className={`h-7 w-7 drop-shadow-lg transition-colors duration-200 ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`}
                        strokeWidth={liked ? 0 : 1.5}
                    />
                </motion.button>
                <motion.span
                    key={count}
                    initial={{ y: -8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-xs text-white font-bold drop-shadow-md tabular-nums"
                >
                    {fmt(count)}
                </motion.span>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Burst particles */}
            <AnimatePresence>
                {burst && [0, 1, 2, 3, 4, 5].map(i => {
                    const a = (i / 6) * Math.PI * 2;
                    return (
                        <motion.div key={i}
                            className="absolute w-1.5 h-1.5 rounded-full bg-red-500 pointer-events-none left-1/2 top-1/2"
                            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                            animate={{ x: Math.cos(a) * 22, y: Math.sin(a) * 22, opacity: 0, scale: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    );
                })}
            </AnimatePresence>

            <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={toggle}
                className="flex items-center gap-1.5 py-2 px-3 rounded-xl hover:bg-accent transition-colors group"
            >
                <motion.div animate={liked ? { scale: [1, 1.4, 1] } : {}} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                    <Heart
                        className={`h-5 w-5 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground group-hover:text-foreground'}`}
                        strokeWidth={liked ? 0 : 1.5}
                    />
                </motion.div>
                <motion.span
                    key={count}
                    initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className={`text-sm font-semibold tabular-nums ${liked ? 'text-red-500' : 'text-muted-foreground'}`}
                >
                    {fmt(count)}
                </motion.span>
            </motion.button>
        </div>
    );
}
