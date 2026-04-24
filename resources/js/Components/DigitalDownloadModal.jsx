import React, { useState, useEffect } from 'react';
import { Download, X, FileText, Film, Music, Archive, Image, Package, Loader2, CheckCircle2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const FILE_TYPE_META = {
    pdf: { icon: FileText, label: 'PDF Document', color: 'from-red-600 to-red-900', bg: 'bg-red-50', text: 'text-red-700' },
    mp4: { icon: Film, label: 'Video File', color: 'from-indigo-600 to-indigo-900', bg: 'bg-indigo-50', text: 'text-indigo-700' },
    mp3: { icon: Music, label: 'Audio File', color: 'from-emerald-600 to-emerald-900', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    zip: { icon: Archive, label: 'Archive File', color: 'from-amber-600 to-orange-900', bg: 'bg-amber-50', text: 'text-amber-700' },
    rar: { icon: Archive, label: 'Archive File', color: 'from-amber-600 to-orange-900', bg: 'bg-amber-50', text: 'text-amber-700' },
    jpg: { icon: Image, label: 'Image File', color: 'from-blue-600 to-blue-900', bg: 'bg-blue-50', text: 'text-blue-700' },
    jpeg: { icon: Image, label: 'Image File', color: 'from-blue-600 to-blue-900', bg: 'bg-blue-50', text: 'text-blue-700' },
    png: { icon: Image, label: 'Image File', color: 'from-blue-600 to-blue-900', bg: 'bg-blue-50', text: 'text-blue-700' },
};

function getFileMeta(url) {
    if (!url) return { icon: Package, label: 'Digital File', color: 'from-brand-600 to-brand-900', bg: 'bg-brand-50', text: 'text-brand-600', ext: '' };
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
    const cleanExt = ext.length > 5 ? '' : ext;
    return { ext: cleanExt, ...(FILE_TYPE_META[cleanExt] || { icon: Package, label: 'Digital File', color: 'from-brand-600 to-brand-900', bg: 'bg-brand-50', text: 'text-brand-600' }) };
}

function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DigitalDownloadModal({ isOpen, onClose, orderId, productTitle, productId }) {
    const [fileUrl, setFileUrl] = useState(null);
    const [fileSize, setFileSize] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloaded, setDownloaded] = useState(false);
    const [sendingLink, setSendingLink] = useState(false);

    useEffect(() => {
        if (!isOpen || !orderId) return;
        setFileUrl(null);
        setFileSize(null);
        setDownloaded(false);
        fetchDownloadUrl();
    }, [isOpen, orderId]);

    const fetchDownloadUrl = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/orders/${orderId}/download`);
            setFileUrl(res.data?.url || null);
            setFileSize(res.data?.size || null);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Imeshindwa kupata kiungo cha kupakua.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!fileUrl) return;
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        setDownloaded(true);
        toast.success('Upakuaji umeanza!');
    };

    const handleSendLink = async () => {
        if (!orderId) return;
        setSendingLink(true);
        try {
            await axios.post(`/api/orders/${orderId}/send-download-link`);
            toast.success('Kiungo kimetumwa kwenye namba yako ya simu!');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Imeshindwa kutuma kiungo. Jaribu tena.');
        } finally {
            setSendingLink(false);
        }
    };

    if (!isOpen) return null;

    const meta = getFileMeta(fileUrl);
    const FileIcon = meta.icon;

    return (
        <div
            className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] bg-white overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header gradient */}
                <div className={`bg-gradient-to-br ${meta.color} px-6 pt-8 pb-12 text-white relative overflow-hidden`}>
                    <div className="absolute top-[-30%] right-[-10%] h-48 w-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }}
                        className="absolute top-5 right-5 h-10 w-10 rounded-full bg-black/20 backdrop-blur-xl flex items-center justify-center border border-white/20 hover:bg-black/40 transition-all z-50 group shadow-lg"
                    >
                        <X className="h-5 w-5 text-white group-active:scale-90 transition-transform" />
                    </button>
                    <div className="relative z-10 flex flex-col items-center text-center gap-3">
                        <div className="h-20 w-20 rounded-3xl bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30 shadow-lg">
                            <FileIcon className="h-10 w-10" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Malipo Yamekamilika</p>
                            <h2 className="text-2xl font-black tracking-tight mt-1 leading-tight text-white">{productTitle || 'Bidhaa Yako'}</h2>
                            <p className="text-sm font-bold text-white/90 mt-1">{meta.label}{meta.ext ? ` (.${meta.ext})` : ''}</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="-mt-8 mx-5 rounded-[2rem] bg-white border border-slate-100 shadow-xl p-6 space-y-5 relative z-10">
                    {/* File Info Row */}
                    {(fileSize || meta.ext) && (
                        <div className={`flex items-center gap-4 p-4 rounded-2xl ${meta.bg}`}>
                            <div className={`h-12 w-12 rounded-2xl ${meta.bg} border border-current/10 flex items-center justify-center ${meta.text} shrink-0`}>
                                <FileIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <p className={`text-xs font-black uppercase tracking-widest ${meta.text}`}>{meta.label}</p>
                                {fileSize && (
                                    <p className="text-sm font-bold text-slate-700 mt-0.5">{formatBytes(fileSize)}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                            <p className="text-sm font-bold text-slate-500">Inaandaa faili lako...</p>
                        </div>
                    ) : fileUrl ? (
                        <button
                            onClick={handleDownload}
                            className={`w-full h-14 rounded-2xl bg-gradient-to-r ${meta.color} text-white font-black uppercase tracking-widest text-sm shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] hover:brightness-105`}
                        >
                            {downloaded ? (
                                <><CheckCircle2 className="h-5 w-5" /> Pakua Tena</>
                            ) : (
                                <><Download className="h-5 w-5" /> Pakua Faili</>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={fetchDownloadUrl}
                            disabled={loading}
                            className="w-full h-14 rounded-2xl bg-brand-600 text-white font-black uppercase tracking-widest text-sm shadow-xl flex items-center justify-center gap-3"
                        >
                            <Download className="h-5 w-5" /> Jaribu Tena
                        </button>
                    )}

                    <button
                        onClick={handleSendLink}
                        disabled={sendingLink}
                        className="w-full h-12 rounded-2xl border-2 border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 transition-all"
                    >
                        {sendingLink ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <MessageSquare className="h-4 w-4" />
                        )}
                        Tuma Kiungo kwa Simu
                    </button>

                    <p className="text-[10px] text-center leading-relaxed">
                        Faili lako litapatikana pia kwenye <strong>Orders</strong> zako wakati wote.
                    </p>
                </div>

                <div className="pb-8" />
            </div>
        </div>
    );
}
