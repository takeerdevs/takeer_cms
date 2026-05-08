import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Trash2, Link as LinkIcon, AlertTriangle, X } from 'lucide-react';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { toast } from 'sonner';

const REPORT_REASONS = [
    { value: 'misleading', label: 'Misleading or scam' },
    { value: 'copyright', label: 'Copyright or stolen work' },
    { value: 'harassment', label: 'Harassment or abuse' },
    { value: 'spam', label: 'Spam' },
    { value: 'adult_content', label: 'Adult Content' },
    { value: 'political_content', label: 'Political Content' },
    { value: 'other', label: 'Other' },
];

export default function PostManagementMenu({ post, isOwner, canReport = false }) {
    if (post?.is_deleted) {
        return null;
    }

    const [isOpen, setIsOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState('misleading');
    const [reportNotes, setReportNotes] = useState('');
    const [isReporting, setIsReporting] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleDelete = async () => {
        if (!window.confirm('Una uhakika unataka kufuta chapisho hili? Hatua hii haiwezi kurudiwa.')) return;

        setIsDeleting(true);
        try {
            const merchantSlug = post.merchant?.slug || post.merchant_profile?.username;
            const deleteUrl = merchantSlug ? `/merchant/${merchantSlug}/posts/${post.id}` : `/merchant/posts/${post.id}`;
            await axios.delete(deleteUrl);
            setIsOpen(false);
            // If we are on the detail page, go back to feed
            if (window.location.pathname.startsWith('/p/')) {
                router.visit('/feed');
            } else {
                // On feed, just refresh current state
                router.reload({ only: ['initialFeed'] });
            }
        } catch (error) {
            console.error('Failed to delete post:', error);
            alert('Imeshindikana kufuta chapisho. Tafadhali jaribu tena.');
        } finally {
            setIsDeleting(false);
        }
    };

    const copyLink = () => {
        const postRouteKey = post.public_id ?? post.id;
        const url = `${window.location.origin}/p/${postRouteKey}`;
        navigator.clipboard.writeText(url);
        setIsOpen(false);
        toast.success('Link copied to clipboard!');
    };

    const openReportModal = () => {
        setIsOpen(false);
        setShowReportModal(true);
    };

    const submitReport = async () => {
        const merchantId = post.merchant_id || post.merchant?.id;
        if (!merchantId) {
            toast.error('Merchant taarifa haijapatikana.');
            return;
        }

        setIsReporting(true);
        try {
            await axios.post('/api/content/report', {
                merchant_id: merchantId,
                item_type: 'post',
                item_id: post.id,
                reason: reportReason,
                report_context: 'feed_post',
                notes: reportNotes.trim() || null,
            });
            setShowReportModal(false);
            setReportReason('misleading');
            setReportNotes('');
            toast.success('Report submitted.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kutuma report.');
        } finally {
            setIsReporting(false);
        }
    };

    return (
        <>
            <div className="relative" ref={menuRef}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors ml-1"
                >
                    <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-2xl shadow-xl z-[60] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="py-1">
                                <button
                                    onClick={copyLink}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors text-foreground"
                                >
                                    <LinkIcon className="h-4 w-4" />
                                    Nakili Link
                                </button>

                                {canReport && !isOwner && (
                                    <button
                                        onClick={openReportModal}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors text-foreground"
                                    >
                                        <AlertTriangle className="h-4 w-4" />
                                        Report Content
                                    </button>
                                )}

                                {isOwner && (
                                    <>
                                        <div className="h-px bg-border/50 my-1" />

                                        <button
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            {isDeleting ? 'Inafuta...' : 'Futa'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {showReportModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-4"
                        onClick={() => setShowReportModal(false)}
                    >
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 20, opacity: 0 }}
                            className="w-full max-w-md rounded-3xl border border-border bg-background shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                                <h3 className="font-black text-sm uppercase tracking-wider">Report Content</h3>
                                <button
                                    type="button"
                                    onClick={() => setShowReportModal(false)}
                                    className="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Reason</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {REPORT_REASONS.map((reason) => (
                                            <button
                                                key={reason.value}
                                                type="button"
                                                onClick={() => setReportReason(reason.value)}
                                                className={`w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors ${reportReason === reason.value ? 'bg-brand-100 border-brand-300' : 'border-border hover:bg-accent'}`}
                                            >
                                                {reason.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Notes (Optional)</p>
                                    <textarea
                                        value={reportNotes}
                                        onChange={(e) => setReportNotes(e.target.value)}
                                        className="w-full min-h-[96px] rounded-xl border border-border px-3 py-2 text-sm"
                                        placeholder="Tell us more..."
                                        maxLength={2000}
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowReportModal(false)}
                                        className="h-10 px-4 rounded-xl border border-border text-sm font-bold hover:bg-accent"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={submitReport}
                                        disabled={isReporting}
                                        className="h-10 px-4 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-60"
                                    >
                                        {isReporting ? 'Submitting...' : 'Submit Report'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
