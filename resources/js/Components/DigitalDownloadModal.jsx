import React, { useState, useEffect } from 'react';
import { Download, X, FileText, Film, Music, Archive, Image, Package, Loader2, CheckCircle2, MessageSquare, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { trackPlatformEvent } from '@/lib/attribution';
import VideoPlayer from '@/Components/VideoPlayer';

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
    const [hlsUrl, setHlsUrl] = useState(null);
    const [streamStatus, setStreamStatus] = useState(null);
    const [deliveryType, setDeliveryType] = useState(null);
    const [streamKind, setStreamKind] = useState(null);
    const [digitalContentType, setDigitalContentType] = useState(null);
    const [digitalUsageLicense, setDigitalUsageLicense] = useState(null);
    const [digitalAccessInstructions, setDigitalAccessInstructions] = useState(null);
    const [softwareLicenseKey, setSoftwareLicenseKey] = useState(null);
    const [downloadMessage, setDownloadMessage] = useState(null);
    const [isCourse, setIsCourse] = useState(false);
    const [loading, setLoading] = useState(false);
    const [downloaded, setDownloaded] = useState(false);

    useEffect(() => {
        if (!isOpen || !orderId) return;
        setFileUrl(null);
        setFileSize(null);
        setHlsUrl(null);
        setStreamStatus(null);
        setDeliveryType(null);
        setStreamKind(null);
        setDigitalContentType(null);
        setDigitalUsageLicense(null);
        setDigitalAccessInstructions(null);
        setSoftwareLicenseKey(null);
        setIsCourse(false);
        setDownloaded(false);
        fetchDownloadUrl();
    }, [isOpen, orderId]);

    const fetchDownloadUrl = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/orders/${orderId}/download`);
            setFileUrl(res.data?.url || null);
            setFileSize(res.data?.size || null);
            setHlsUrl(res.data?.hls_url || null);
            setStreamStatus(res.data?.stream_status || null);
            setIsCourse(res.data?.is_course || false);
            setDeliveryType(res.data?.type || null);
            setStreamKind(res.data?.stream_kind || null);
            setDigitalContentType(res.data?.digital_content_type || null);
            setDigitalUsageLicense(res.data?.digital_usage_license || null);
            setDigitalAccessInstructions(res.data?.digital_access_instructions || null);
            setSoftwareLicenseKey(res.data?.software_license_key || null);
            setDownloadMessage(res.data?.message || null);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Imeshindwa kupata kiungo cha kupakua.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!fileUrl) return;
        trackPlatformEvent(
            deliveryType === 'stream'
                ? (streamKind === 'audio' ? 'audio_played' : 'video_played')
                : deliveryType === 'gallery'
                    ? 'gallery_viewed'
                    : deliveryType === 'live_event'
                        ? 'live_event_joined'
                        : 'download_clicked',
            {
                entity_type: 'product',
                entity_id: productId || null,
                source: 'digital_download_modal',
                metadata: {
                    order_id: orderId,
                    delivery_type: deliveryType,
                    stream_kind: streamKind,
                    digital_content_type: digitalContentType,
                    file_extension: meta.ext || null,
                },
            }
        );
        if (isStream && !isAudioStream) {
            return;
        }
        if (isCourse || deliveryType === 'stream' || deliveryType === 'gallery' || deliveryType === 'live_event') {
            window.location.href = fileUrl;
            return;
        }
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        setDownloaded(true);
        toast.success('Upakuaji umeanza!');
    };

    if (!isOpen) return null;

    const meta = getFileMeta(fileUrl);
    const isStream = deliveryType === 'stream';
    const isAudioStream = isStream && streamKind === 'audio';
    const isGallery = deliveryType === 'gallery';
    const isLiveEvent = deliveryType === 'live_event';
    const isCustomPending = deliveryType === 'custom_pending';
    const FileIcon = isCourse || isStream || isLiveEvent ? PlayCircle : isGallery ? Image : isCustomPending ? MessageSquare : meta.icon;
    const contentLabel = {
        template_asset: 'Template',
        creative_asset: 'Creative Asset',
        ebook: 'E-book',
        software: 'Software / Code',
        document: 'Document Pack',
        live_event: 'Live Event',
        custom_commission: 'Custom Work',
    }[digitalContentType] || null;
    const licenseLabel = {
        personal: 'Personal Use',
        commercial: 'Commercial Use',
        extended_commercial: 'Extended Commercial',
        exclusive: 'Exclusive',
        custom: 'Custom License',
    }[digitalUsageLicense] || null;

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
                <div className={`bg-gradient-to-br ${isCourse || isStream ? 'from-indigo-600 to-indigo-900' : isGallery ? 'from-blue-600 to-cyan-800' : meta.color} px-6 pt-8 pb-12 text-white relative overflow-hidden`}>
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
                            <p className="text-sm font-bold text-white/90 mt-1">{isStream ? (isAudioStream ? 'Premium Audio Stream' : 'Premium Video Stream') : isCourse ? 'Premium High-Ticket Course' : isGallery ? 'Premium Gallery Pack' : meta.label}{meta.ext && !isStream && !isGallery ? ` (.${meta.ext})` : ''}</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="-mt-8 mx-5 rounded-[2rem] bg-white border border-slate-100 shadow-xl p-6 space-y-5 relative z-10">
                    {/* File Info Row */}
                    {(fileSize || meta.ext || isCourse || isStream || isGallery) && (
                        <div className={`flex items-center gap-4 p-4 rounded-2xl ${isCourse || isStream ? 'bg-indigo-50' : isGallery ? 'bg-blue-50' : meta.bg}`}>
                            <div className={`h-12 w-12 rounded-2xl ${isCourse || isStream ? 'bg-indigo-50 text-indigo-700' : isGallery ? 'bg-blue-50 text-blue-700' : meta.bg + ' ' + meta.text} border border-current/10 flex items-center justify-center shrink-0`}>
                                <FileIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <p className={`text-xs font-black uppercase tracking-widest ${isCourse || isStream ? 'text-indigo-700' : isGallery ? 'text-blue-700' : meta.text}`}>{isStream ? 'Protected Streaming' : isCourse ? 'Structured Learning' : isGallery ? 'Unlocked Gallery' : meta.label}</p>
                                {isCourse || isStream || isGallery ? (
                                    <p className="text-sm font-bold text-slate-700 mt-0.5">{isStream ? (isAudioStream ? 'Sikiliza ndani ya Takeer' : 'Tazama ndani ya Takeer') : isGallery ? 'Tazama picha ndani ya Takeer' : 'Tayari kuanza masomo yako'}</p>
                                ) : fileSize && (
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
                        isStream && !isAudioStream ? (
                            <div className="space-y-3">
                                <div className="overflow-hidden rounded-2xl bg-black">
                                    <div className="aspect-video">
                                        <VideoPlayer
                                            src={fileUrl}
                                            hlsUrl={hlsUrl || undefined}
                                            className="h-full w-full bg-black"
                                            controls
                                            playsInline
                                            preload="metadata"
                                            onPlay={handleDownload}
                                        />
                                    </div>
                                </div>
                                {hlsUrl ? (
                                    <p className="text-center text-[10px] font-bold uppercase tracking-widest text-indigo-700">
                                        HLS protected stream
                                    </p>
                                ) : streamStatus && streamStatus !== 'ready' ? (
                                    <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800">
                                        HLS bado inaandaliwa. Video itaendelea kwa fallback stream kwa sasa.
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <button
                                onClick={handleDownload}
                                className={`w-full h-14 rounded-2xl bg-gradient-to-r ${isCourse || isStream ? 'from-indigo-600 to-indigo-900' : isGallery ? 'from-blue-600 to-cyan-800' : meta.color} text-white font-black uppercase tracking-widest text-sm shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] hover:brightness-105`}
                            >
                                {isCourse || isStream ? (
                                    <><PlayCircle className="h-5 w-5" /> {isStream ? (isAudioStream ? 'Sikiliza Audio' : 'Tazama Video') : 'Fungua Masomo'}</>
                                ) : isGallery ? (
                                    <><Image className="h-5 w-5" /> Fungua Gallery</>
                                ) : downloaded ? (
                                    <><CheckCircle2 className="h-5 w-5" /> Pakua Tena</>
                                ) : (
                                    <><Download className="h-5 w-5" /> Pakua Faili</>
                                )}
                            </button>
                        )
                    ) : isCustomPending ? (
                        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
                            <MessageSquare className="mx-auto h-7 w-7 text-amber-700" />
                            <p className="mt-2 text-sm font-black text-amber-900">Custom delivery is being prepared</p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                                {downloadMessage || 'Merchant bado anaandaa faili lako. Utalipata hapa likiwa tayari.'}
                            </p>
                        </div>
                    ) : (
                        <button
                            onClick={fetchDownloadUrl}
                            disabled={loading}
                            className="w-full h-14 rounded-2xl bg-brand-600 text-white font-black uppercase tracking-widest text-sm shadow-xl flex items-center justify-center gap-3"
                        >
                            <Download className="h-5 w-5" /> Jaribu Tena
                        </button>
                    )}

                    {(contentLabel || licenseLabel || digitalAccessInstructions) && (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                            <div className="flex flex-wrap gap-2">
                                {contentLabel && <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">{contentLabel}</span>}
                                {licenseLabel && <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">{licenseLabel}</span>}
                            </div>
                            {digitalAccessInstructions && (
                                <p className="mt-3 text-xs font-semibold leading-5 text-slate-600 whitespace-pre-line">{digitalAccessInstructions}</p>
                            )}
                        </div>
                    )}

                    {softwareLicenseKey?.key && (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">License Key</p>
                            <div className="mt-2 flex items-center gap-2">
                                <code className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-900 break-all">
                                    {softwareLicenseKey.key}
                                </code>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard?.writeText(softwareLicenseKey.key);
                                        toast.success('License key copied.');
                                    }}
                                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                                >
                                    Copy
                                </button>
                            </div>
                            {softwareLicenseKey.offline_license_url && (
                                <a
                                    href={softwareLicenseKey.offline_license_url}
                                    onClick={() => trackPlatformEvent('license_file_downloaded', {
                                        entity_type: 'product',
                                        entity_id: productId || null,
                                        source: 'digital_download_modal',
                                        metadata: {
                                            order_id: orderId,
                                            license_key_id: softwareLicenseKey.id || null,
                                        },
                                    })}
                                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800 border border-emerald-100"
                                >
                                    <Download className="h-4 w-4" />
                                    Offline license file
                                </a>
                            )}
                        </div>
                    )}

                    <p className="text-[10px] text-center leading-relaxed">
                        Faili lako litapatikana pia kwenye <strong>Orders</strong> zako wakati wote.
                    </p>
                </div>

                <div className="pb-8" />
            </div>
        </div>
    );
}
