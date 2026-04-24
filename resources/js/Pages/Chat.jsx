import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { AlertTriangle, MapPin, Send, Image as ImageIcon, Camera, ShieldCheck, Loader2, Workflow, ShoppingBag, Tag, Truck, AlertCircle, Star, X, CheckCircle2, Info, CreditCard, History, ArrowLeft, Video, Search, Plus, Navigation, Zap, Clock, Store, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerTrigger,
    DrawerClose
} from '@/Components/ui/Drawer';
import { cn } from '@/lib/utils';
import ShopLocationsModal from '@/Components/ShopLocationsModal';
import AddressPickerModal from '@/Components/AddressPickerModal';

const MediaDisplay = ({ url, className }) => {
    if (!url) return null;
    const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes('/video/') || url.includes('type=video');

    if (isVideo) {
        return (
            <div className={cn("relative rounded-2xl overflow-hidden bg-slate-900 group", className)}>
                <video src={url} className="w-full h-full object-cover" controls />
                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-blue-600 text-[8px] font-black text-white rounded">VIDEO</div>
            </div>
        );
    }

    return (
        <div className={cn("relative rounded-2xl overflow-hidden bg-slate-100 group cursor-pointer", className)} onClick={() => window.open(url, '_blank')}>
            <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Chat attachment" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>
    );
};

export default function Chat({
    orderId,
    publicId,
    initialMessages = [],
    orderStatus,
    orderFlow = 'instant',
    actingAs = 'buyer',
    order: initialOrder
}) {
    const { auth, country } = usePage().props;
    const [messages, setMessages] = useState(initialMessages);
    const [order, setOrder] = useState(initialOrder);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const bottomRef = useRef(null);
    const mediaRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    // Action State
    const [activeAction, setActiveAction] = useState(null); // 'items', 'discount', 'shipping', 'proof', 'complaint', 'review', 'upsell', 'order_items', 'order_delivery'
    const [actionPayload, setActionPayload] = useState({});
    const [isShopModalOpen, setIsShopModalOpen] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showDiscountResetConfirm, setShowDiscountResetConfirm] = useState(false);

    // Shipping Management State
    const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
    const [shippingZones, setShippingZones] = useState([]);
    const [loadingZones, setLoadingZones] = useState(false);
    const [isSelfPickupChoice, setIsSelfPickupChoice] = useState(order?.delivery?.delivery_type === 'self_pickup');
    const [customerLat, setCustomerLat] = useState(parseFloat(order?.delivery?.latitude) || null);
    const [customerLng, setCustomerLng] = useState(parseFloat(order?.delivery?.longitude) || null);
    const [physicalAddress, setPhysicalAddress] = useState(order?.delivery?.physical_address || '');
    const [selectedZoneId, setSelectedZoneId] = useState(order?.delivery?.shipping_zone_id || '');
    const [selectedHotspot, setSelectedHotspot] = useState(null);

    useEffect(() => {
        if (activeAction === 'order_delivery' && order?.delivery) {
            setIsSelfPickupChoice(order.delivery.delivery_type === 'self_pickup');
            setCustomerLat(parseFloat(order.delivery.latitude) || null);
            setCustomerLng(parseFloat(order.delivery.longitude) || null);
            setPhysicalAddress(order.delivery.physical_address || '');
            setSelectedZoneId(order.delivery.shipping_zone_id || '');
        }
    }, [activeAction, order?.delivery?.id, order?.delivery?.delivery_type, order?.delivery?.physical_address]);

    const calculateHaversine = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const findBestShippingZone = (lat, lng, region, zones) => {
        if (!zones?.length) return null;

        // 1. Try Local based on distance
        const localZones = zones.filter(z => z.delivery_type === 'local_boda' && z.location);
        let bestLocalZone = null;
        let minActualDist = Infinity;

        localZones.forEach(zone => {
            const dist = calculateHaversine(lat, lng, Number(zone.location.latitude), Number(zone.location.longitude));
            if (dist <= Number(zone.max_distance_km)) {
                if (dist < minActualDist) {
                    minActualDist = dist;
                    bestLocalZone = zone;
                }
            }
        });

        if (bestLocalZone) return { zone: bestLocalZone, hotspot: null };

        // 2. Try Intercity Bus based on region
        if (region) {
            const busZone = zones.find(z =>
                z.delivery_type === 'intercity_bus' &&
                z.destination_region?.toLowerCase().includes(region.toLowerCase())
            );
            if (busZone) {
                let closestHs = null;
                if (busZone.hotspots?.length > 0) {
                    let minHsDist = Infinity;
                    busZone.hotspots.forEach(hs => {
                        const d = calculateHaversine(lat, lng, Number(hs.latitude), Number(hs.longitude));
                        if (d < minHsDist) {
                            minHsDist = d;
                            closestHs = hs;
                        }
                    });
                }
                return { zone: busZone, hotspot: closestHs };
            }
        }
        return null;
    };

    const handleAddressSaved = (data) => {
        setCustomerLat(data.lat);
        setCustomerLng(data.lng);
        setPhysicalAddress(data.address);
        
        const result = findBestShippingZone(data.lat, data.lng, data.region, shippingZones);
        if (result) {
            setSelectedZoneId(String(result.zone.id));
            setSelectedHotspot(result.hotspot);
            toast.success(`Tumekupatia gharama ya usafiri: TZS ${Number(result.zone.flat_rate_fee).toLocaleString()}`);
        } else {
            setSelectedZoneId('');
            setSelectedHotspot(null);
            toast.info("Eneo lako linahitaji muuzaji aweke gharama mwenyewe. Unaweza kuendelea.");
        }
    };

    // Upsell & Modal state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null);

    // Payment State
    const [isActionDrawerOpen, setIsActionDrawerOpen] = useState(false);
    const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('mobile'); // 'mobile', 'card'
    const [paymentPhone, setPaymentPhone] = useState(initialOrder?.account_phone || auth.user?.phone_number || '');
    const [isPaying, setIsPaying] = useState(false);

    const getDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return null;
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c).toFixed(1);
    };

    const findClosestLocation = () => {
        if (!order?.delivery?.latitude || !order?.merchant?.locations?.length) return null;
        const custLat = parseFloat(order.delivery.latitude);
        const custLon = parseFloat(order.delivery.longitude);

        let closest = null;
        let minDistance = Infinity;

        order.merchant.locations.forEach(loc => {
            const dist = parseFloat(getDistance(custLat, custLon, parseFloat(loc.latitude), parseFloat(loc.longitude)));
            if (dist < minDistance) {
                minDistance = dist;
                closest = { ...loc, distance: dist };
            }
        });
        return closest;
    };

    // Auto-scroll to latest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!window.Echo) return;

        const channel = window.Echo.private(`chat.order.${orderId}`);

        channel.listen('MessageSent', (e) => {
            // If we are not the sender, append to chat array
            if (e.message.sender_id !== auth.user.id) {
                setMessages(prev => [...prev, e.message]);
            }
        });

        // Optional typing indicators:
        // channel.listenForWhisper('typing', (e) => { ... })

        return () => window.Echo.leave(`chat.order.${orderId}`);
    }, [orderId, auth.user.id]);

    const sendMessage = async (e, mediaUrl = null) => {
        if (e) e.preventDefault();
        if ((!input.trim() && !mediaUrl) || isLoading) return;

        const body = input.trim() || (mediaUrl ? (actingAs === 'merchant' ? 'Picha/Video ya Bidhaa' : 'Picha/Video ya Uthibitisho') : '');
        setInput('');

        // Optimistic UI update
        const tempId = Date.now();
        const optimisticMsg = {
            id: tempId,
            sender_id: auth.user.id,
            body: body,
            media_url: mediaUrl,
            payload: { acting_as: actingAs },
            sender: { role: auth.user.role },
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch(`/api/chat/order/${orderId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: JSON.stringify({
                    body,
                    media_url: mediaUrl,
                    type: 'text',
                    acting_as: actingAs
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kutuma ujumbe.');

            // Replace temporary message with actual DB record and update order
            setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
            if (data.order) setOrder(data.order);

        } catch (error) {
            toast.error(error.message);
            // Revert optimistic if failed
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const handleMediaUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validation: size check (e.g. 50MB for chat)
        if (file.size > 50 * 1024 * 1024) {
            toast.error("Faili ni kubwa mno. Tafadhali tumia chini ya 50MB.");
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'public');
        formData.append('folder', `chat/${orderId}`);

        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch('/api/media/upload', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Imeshindwa kupakia media.');
            }
            
            const data = await res.json();
            sendMessage(null, data.url);

        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsUploading(false);
            if (mediaRef.current) mediaRef.current.value = '';
        }
    };

    const handleMerchantLockAction = async (actionType) => {
        setIsLoading(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const endpoint = actionType === 'extend_lock' ? 'extend-lock' : 'release-inventory';
            const res = await fetch(`/api/merchant/${order.merchant.username}/orders/${order.id}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                }
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Imeshindwa kukamilisha hatua hiyo.');
            }
            
            const data = await res.json();
            if (data.order) setOrder(data.order);
            toast.success(data.message);
            setActiveAction(null);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const getActiveComplaint = () => {
        if (!order?.dispute) return null;
        if (order.dispute.status === 'resolved' || order.dispute.status === 'closed') return null;
        return order.dispute;
    };

    const handleSearchProducts = async (q) => {
        setSearchQuery(q);
        // If query is empty, still fetch latest products
        setIsSearching(true);
        try {
            const res = await fetch(`/api/chat/order/${orderId}/search-products?q=${encodeURIComponent(q)}`, {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();
            // The API returns paginated data: data.data.data
            setSearchResults(data.data.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    };

    const getPriceRange = (product) => {
        if (!product.has_variants || !product.variants?.length) return `TZS ${Number(product.price).toLocaleString()}`;
        const prices = product.variants.map(v => Number(v.price));
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        if (min === max) return `TZS ${min.toLocaleString()}`;
        return `TZS ${min.toLocaleString()} - ${max.toLocaleString()}`;
    };


    const submitAction = async (actionType, payload) => {
        // Optimistic UI update
        const tempId = Date.now();
        const actionMsg = {
            id: tempId,
            sender_id: auth.user.id,
            type: 'action',
            body: payload.title || `Oda imebadilishwa: ${actionType}`,
            payload: { ...payload, action_type: actionType, acting_as: actingAs },
            sender: { role: auth.user.role, name: auth.user.name },
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, actionMsg]);
        setActiveAction(null);
        setActionPayload({});

        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch(`/api/chat/order/${orderId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: JSON.stringify({
                    body: actionMsg.body,
                    type: 'action',
                    acting_as: actingAs,
                    payload: actionMsg.payload
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kutuma mabadiliko.');

            if (data.order_deleted) {
                toast.success("Oda imefutwa kwa sababu haina vitu tena.");
                window.location.href = '/orders'; // Or library
                return;
            }

            // Replace temporary message with actual DB record and real order math
            setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
            if (data.order) setOrder(data.order);

            toast.success(`${actionMsg.body} imewekwa kikamilifu!`);

        } catch (error) {
            toast.error(error.message);
            // Revert optimistic if failed
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const groupedMessages = messages.reduce((acc, msg) => {
        const dateObj = new Date(msg.created_at);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        if (dateObj.toDateString() === today.toDateString()) {
            dateStr = 'Leo';
        } else if (dateObj.toDateString() === yesterday.toDateString()) {
            dateStr = 'Jana';
        }

        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(msg);
        return acc;
    }, {});

    return (
        <AppLayout>
            <Head title={`Chat Oda #${publicId?.substring(0, 8)} | Takeer`} />

            <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
                {/* Fixed Order Header */}
                <div className="sticky top-0 z-30 px-4 py-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-brand-100 dark:border-brand-900/50 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 shrink-0">
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
                                <ShoppingBag className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-sm font-black text-brand-900 dark:text-brand-100 uppercase tracking-tight">Oda #{publicId?.substring(0, 8)}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black py-0.5 px-2 bg-brand-50 text-brand-600 rounded-full border border-brand-100 uppercase tracking-tighter">
                                        {order?.delivery?.delivery_type === 'local_boda' ? 'Local' : (order?.delivery?.delivery_type?.replace('_', ' ') || 'Kukabidhiwa')}
                                    </span>
                                    <span className={cn(
                                        "text-[10px] font-black py-0.5 px-2 rounded-full uppercase tracking-tighter border",
                                        orderStatus === 'completed' || orderStatus === 'delivered' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                                    )}>
                                        {orderStatus}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end">
                            <p className="text-[9px] font-black text-brand-600/60 uppercase tracking-widest leading-none mb-1">Jumla ya Oda</p>
                            <p className="text-lg font-black text-brand-800 dark:text-brand-200 tracking-tighter leading-none">TZS {Number(order?.total_paid || 0).toLocaleString()}</p>
                            <div className="flex gap-2 text-[9px] font-bold text-slate-400 mt-1">
                                <span>Bidhaa: {Number(order?.unit_price || 0).toLocaleString()}</span>
                                {Number(order?.shipping_fee) > 0 && (
                                    <span className="text-emerald-500 font-black">+ Usafiri: {Number(order?.shipping_fee).toLocaleString()}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chat History */}
                <div className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center px-6 opacity-60">
                            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-sm font-medium">Safe-Chat kwa Oda #{publicId?.substring(0, 8)}</p>
                            <p className="text-xs text-muted-foreground mt-1">Ujumbe wote unawekwa kwenye kumbukumbu kwa usalama iwapo kutatokea mgogoro (Dispute).</p>
                        </div>
                    )}

                    <div className="max-w-3xl mx-auto w-full space-y-8">
                        {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
                            <div key={dateLabel} className="space-y-6">
                                <div className="flex justify-center my-8 relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200/60 dark:border-slate-800/60" /></div>
                                    <span className="relative px-4 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
                                        {dateLabel}
                                    </span>
                                </div>

                                {msgs.map((msg) => {
                                    const isSystem = msg.type === 'system';
                                    const isAction = msg.type === 'action';

                                    // Deterministic role binding based on acting_as
                                    const msgActingAs = msg.payload?.acting_as || (msg.sender_id === order.merchant?.user_id ? 'merchant' : 'buyer');
                                    const isMe = msgActingAs === actingAs;

                                    const getSenderName = () => {
                                        if (isMe) return 'Wewe';
                                        if (msgActingAs === 'merchant') return 'Muuzaji';
                                        if (order?.account_phone) {
                                            const p = order.account_phone;
                                            return p.substring(0, 4) + '***' + p.slice(-3);
                                        }
                                        return 'Mteja';
                                    };
                                    const renderedName = getSenderName();

                                    if (isSystem) {
                                        return (
                                            <div key={msg.id} className="flex justify-center my-2">
                                                <div className="text-[11px] font-bold text-center text-brand-700/80 dark:text-brand-300/80 bg-brand-50/80 dark:bg-brand-900/40 px-4 py-2 rounded-2xl max-w-[85%] leading-relaxed border border-brand-100/50 shadow-sm">
                                                    {msg.body}
                                                </div>
                                            </div>
                                        );
                                    }

                                    if (isAction) {
                                        const actionType = msg.payload?.action_type;
                                        const initials = isMe ? 'MI' : (msgActingAs === 'merchant' ? 'MZ' : 'MT');

                                        if (actionType === 'suggest_product') {
                                            const p = msg.payload?.product;
                                            return (
                                                <div key={msg.id} className={cn("flex w-full my-6", isMe ? "justify-end" : "justify-start")}>
                                                    <div className="flex flex-col max-w-[85%]">
                                                        <div className={cn("flex items-center gap-2 mb-2 opacity-60", isMe ? "justify-end" : "justify-start")}>
                                                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{renderedName} ANAPENDEKEZA BIDHAA</span>
                                                        </div>
                                                        <div className="relative group overflow-hidden rounded-[2.5rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/50 transition-all hover:scale-[1.02]">
                                                            {p.image && <img src={p.image} className="w-full h-48 object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt="" />}
                                                            <div className="p-5">
                                                                <h4 className="font-black text-brand-900 mb-1">{p.title}</h4>
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <span className="text-xl font-black text-brand-600">TZS {Number(p.price).toLocaleString()}</span>
                                                                </div>
                                                                {!isMe && (
                                                                    <Button
                                                                        onClick={() => submitAction('add_to_order', {
                                                                            product: {
                                                                                id: p.id,
                                                                                variant_id: p.variant_id,
                                                                                title: p.title, // already includes variant name if suggested from modal
                                                                                price: p.price,
                                                                                image: p.image,
                                                                                quantity: 1
                                                                            },
                                                                            title: `ONGEZA ${p.title.toUpperCase()}`
                                                                        })}
                                                                        className="w-full h-12 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black uppercase text-xs tracking-widest flex items-center gap-2"
                                                                    >
                                                                        <Plus className="h-4 w-4" /> WEKA KWENYE ODA
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={msg.id} className={cn("flex w-full my-6 animate-in zoom-in-95 duration-500", isMe ? "justify-end" : "justify-start")}>
                                                <div className="flex flex-col w-full max-w-[90%] md:max-w-[75%]">
                                                    {/* Action Header Label */}
                                                    <div className={cn("flex items-center gap-2 mb-2", isMe ? "justify-end" : "justify-start")}>
                                                        <span className={cn(
                                                            "text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full",
                                                            isMe ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            {renderedName}
                                                        </span>
                                                    </div>

                                                    <div className={cn(
                                                        "bg-white dark:bg-slate-900 border shadow-[0_8px_40px_rgb(0,0,0,0.03)] p-1.5 w-full relative group transition-all hover:shadow-[0_12px_50px_rgb(0,0,0,0.06)] overflow-hidden",
                                                        isMe ? "border-brand-100 rounded-[2.5rem] rounded-tr-xl bg-brand-50/5" : "border-slate-100 dark:border-slate-800 rounded-[2.5rem] rounded-tl-xl"
                                                    )}>
                                                        <div className={cn("flex items-start gap-4 p-4", isMe ? "flex-row-reverse" : "flex-row")}>
                                                            {/* User Avatar Circle */}
                                                            <div className={cn(
                                                                "h-12 w-12 rounded-[1.5rem] flex items-center justify-center text-sm font-black shadow-inner shrink-0",
                                                                msgActingAs === 'merchant' ? "bg-brand-600 text-white" : "bg-blue-600 text-white"
                                                            )}>
                                                                {initials}
                                                            </div>

                                                            <div className={cn("flex-1 min-w-0 mt-1", isMe ? "text-right" : "text-left")}>
                                                                <div className={cn("flex items-center gap-2 mb-1", isMe ? "justify-end" : "justify-start")}>
                                                                    <h4 className="text-xs font-black text-brand-900 dark:text-brand-100 uppercase tracking-tight">{msg.body}</h4>
                                                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                                </div>

                                                                {/* Content Renderers */}
                                                                <div className="mt-3">
                                                                    {actionType === 'discount' && (
                                                                        <div className="flex items-center justify-between py-3 px-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50">
                                                                            <div>
                                                                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-0.5">Punguzo (Discount)</p>
                                                                                <p className="text-lg font-black text-amber-900 dark:text-amber-100">- TZS {Number(msg.payload?.amount || 0).toLocaleString()}</p>
                                                                            </div>
                                                                            <Tag className="h-6 w-6 text-amber-400 opacity-50" />
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'shipping_cost' && (
                                                                        <div className="flex items-center justify-between py-3 px-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50">
                                                                            <div>
                                                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Gharama ya Usafiri</p>
                                                                                <p className="text-lg font-black text-emerald-900 dark:text-emerald-100">TZS {Number(msg.payload?.amount || 0).toLocaleString()}</p>
                                                                            </div>
                                                                            <Truck className="h-6 w-6 text-emerald-400 opacity-50" />
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'quantity' && (
                                                                        <div className="flex items-center justify-between py-3 px-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50">
                                                                            <div>
                                                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Idadi ya Vitu</p>
                                                                                <p className="text-lg font-black text-blue-900 dark:text-blue-100">{msg.payload?.quantity} Items</p>
                                                                            </div>
                                                                            <ShoppingBag className="h-6 w-6 text-blue-400 opacity-50" />
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'complaint' && (
                                                                        <div className="space-y-3">
                                                                            <div className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-100/50">
                                                                                <div className="flex items-center gap-2 mb-2">
                                                                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                                                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Maelezo ya Malalamiko</p>
                                                                                </div>
                                                                                <p className="text-sm font-bold text-red-900 dark:text-red-100 italic leading-relaxed">"{msg.payload?.reason}"</p>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 px-1">
                                                                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                                                                <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter">Inasubiri Utatuzi kutoka kwa Muuzaji</span>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'complaint_resolved' && (
                                                                        <div className="bg-emerald-500 rounded-3xl p-6 text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden">
                                                                            <div className="relative z-10">
                                                                                <div className="flex items-center gap-3 mb-3">
                                                                                    <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                                                                        <CheckCircle2 className="h-6 w-6" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Malalamiko Yamefungwa</p>
                                                                                        <h4 className="text-xl font-black tracking-tight">YAMETATULIWA</h4>
                                                                                    </div>
                                                                                </div>
                                                                                <p className="text-xs font-bold leading-relaxed opacity-90">Muuzaji amemark malalamiko haya kama yaliyotatuliwa baada ya kukubaliana na mteja.</p>
                                                                            </div>
                                                                            <div className="absolute -bottom-6 -right-6 opacity-10"><CheckCircle2 className="h-32 w-32" /></div>
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'complaint_appealed' && (
                                                                        <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
                                                                            <div className="relative z-10">
                                                                                <div className="flex items-center gap-3 mb-3">
                                                                                    <div className="h-10 w-10 rounded-2xl bg-red-600 flex items-center justify-center">
                                                                                        <ShieldCheck className="h-6 w-6" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Escalated to Admin</p>
                                                                                        <h4 className="text-xl font-black tracking-tight">RUFAA (APPEAL)</h4>
                                                                                    </div>
                                                                                </div>
                                                                                <p className="text-xs font-bold leading-relaxed text-slate-300">Muuzaji amekata rufaa. Timu ya Takeer itapitia malalamiko haya na kutoa uamuzi wa mwisho ndani ya saa 24.</p>
                                                                            </div>
                                                                            <div className="absolute -bottom-6 -right-6 opacity-10"><ShieldCheck className="h-32 w-32" /></div>
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'shipping_proof' && (
                                                                        <div className="space-y-4">
                                                                            {msg.media_url ? (
                                                                                <MediaDisplay url={msg.media_url} className="aspect-video w-full" />
                                                                            ) : (
                                                                                <div className="grid grid-cols-2 gap-3">
                                                                                    <div className="aspect-[4/3] rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-dashed border-slate-300 shadow-inner">
                                                                                        <ImageIcon className="h-6 w-6 text-slate-400" />
                                                                                    </div>
                                                                                    <div className="aspect-[4/3] rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg relative">
                                                                                        <Video className="h-6 w-6 text-white/50" />
                                                                                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-blue-600 text-[8px] font-black text-white rounded">HD</div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            <p className="text-[10px] font-bold text-slate-400 px-1 uppercase tracking-tight flex items-center gap-2 italic">
                                                                                <Info className="h-3 w-3" /> Ushahidi wa upakiaji na waybill umehifadhiwa.
                                                                            </p>
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'review' && (
                                                                        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50 rounded-2xl p-4">
                                                                            <div className="flex items-center gap-1 mb-2">
                                                                                {[...Array(msg.payload?.stars || 5)].map((_, i) => (
                                                                                    <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
                                                                                ))}
                                                                            </div>
                                                                            <p className="text-sm font-bold text-amber-900 dark:text-amber-100 italic leading-relaxed">"{msg.payload?.comment || 'Hakuna maoni ya ziada.'}"</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Timestamp Overlay */}
                                                        <div className="absolute top-4 right-6 text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={msg.id} className={cn("flex w-full mb-3 items-end gap-2", isMe ? "justify-end" : "justify-start")}>
                                            {!isMe && (
                                                <div className={cn(
                                                    "h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mb-1",
                                                    msgActingAs === 'merchant' ? "bg-brand-600 text-white" : "bg-blue-600 text-white"
                                                )}>
                                                    {msgActingAs === 'merchant' ? 'MZ' : 'MT'}
                                                </div>
                                            )}
                                            <div className={cn("max-w-[75%] md:max-w-[65%] flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
                                                <span className="text-[9px] font-semibold text-slate-400 px-1">{renderedName}</span>
                                                <div className={cn(
                                                    "rounded-2xl px-4 py-3 shadow-sm relative",
                                                    isMe ? "bg-brand-600 text-white rounded-br-sm" : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-100 dark:border-slate-800"
                                                )}>
                                                    {msg.media_url && <MediaDisplay url={msg.media_url} className="mb-3 aspect-auto max-h-64 rounded-xl overflow-hidden" />}
                                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                                                    <div className={cn("flex items-center justify-end gap-1 mt-1", isMe ? "text-white/50" : "text-slate-400")}>
                                                        <span className="text-[9px]">
                                                            {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            {isMe && (
                                                <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-[10px] font-black shrink-0 mb-1 text-white">
                                                    {actingAs === 'merchant' ? 'MZ' : 'MT'}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    <div ref={bottomRef} className="h-4" />
                </div>

                {/* Payment Action Button */}
                {actingAs === 'buyer' && order?.payment_status === 'pending' && (
                    <div className="px-4 pb-2 animate-in slide-in-from-bottom-4 duration-500">
                        {(order?.delivery?.delivery_type === 'self_pickup' || order?.shipping_fee !== null || order?.delivery?.shipping_zone_id) ? (
                            <Button 
                                onClick={() => setIsPaymentDrawerOpen(true)}
                                className="w-full h-16 rounded-[2rem] bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-brand-600/40 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 border-4 border-white dark:border-slate-900"
                            >
                                <Zap className="h-5 w-5 fill-white" />
                                Lipia Oda (TZS {Number(order?.total_paid).toLocaleString()})
                            </Button>
                        ) : (
                            <div className="p-4 rounded-[2rem] bg-amber-50/50 border border-amber-100 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <p className="text-[10px] font-bold text-amber-900 uppercase leading-relaxed">
                                    Subiri muuzaji aweke gharama ya usafiri au chagua pickup ili uweze kulipia.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Input Area */}
                <div className="shrink-0 bg-white dark:bg-slate-950 border-t border-brand-100 dark:border-brand-900/40 p-4">
                    <form onSubmit={sendMessage} className="flex items-center gap-2">
                        <Drawer open={isActionDrawerOpen} onOpenChange={setIsActionDrawerOpen}>
                            <DrawerTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" onClick={() => setIsActionDrawerOpen(true)} className="shrink-0 h-12 w-12 rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100">
                                    <Plus className="h-6 w-6" />
                                </Button>
                            </DrawerTrigger>
                            <DrawerContent className="rounded-t-[3rem] bg-white dark:bg-slate-950 border-t-2 border-brand-100 dark:border-brand-900/50">
                                <div className="mx-auto w-full max-w-lg flex flex-col h-[70vh]">
                                    {activeAction === null ? (
                                        <>
                                            <DrawerHeader className="text-left pb-2 pt-6 shrink-0">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <DrawerTitle className="text-2xl font-black tracking-tight text-brand-900">Njia Za Mkato</DrawerTitle>
                                                        <DrawerDescription className="font-bold text-brand-600/60 uppercase text-[10px] tracking-widest mt-0.5">Salama & Haraka kwa Oda #{publicId?.substring(0, 8)}</DrawerDescription>
                                                    </div>
                                                    <DrawerClose asChild>
                                                        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-accent/50"><X className="h-5 w-5 text-muted-foreground" /></Button>
                                                    </DrawerClose>
                                                </div>
                                            </DrawerHeader>
                                            <div className="p-4 grid grid-cols-2 gap-3 pb-12 overflow-y-auto">
                                                {(actingAs === 'merchant' ? [
                                                    { id: 'shipping_cost', label: 'Shipping Cost', icon: Truck, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100', desc: 'Weka gharama hapa', disabled: order?.delivery?.delivery_type === 'pickup' },
                                                    { id: 'discount', label: 'Discount', icon: Tag, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100', desc: 'Punguza bei ya oda' },
                                                    { id: 'extend_lock', label: 'Ongeza Muda', icon: Clock, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100', desc: 'Ongeza lock ya stock kwa dk 30', disabled: order?.payment_status !== 'pending' },
                                                    { id: 'release_stock', label: 'Achia Stock', icon: X, color: 'bg-slate-50 text-slate-600', border: 'border-slate-100', desc: 'Sitisha na rudisha stock', disabled: order?.payment_status !== 'pending' },
                                                    { id: 'upsell', label: 'Pendekeza Bidhaa', icon: Plus, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100', desc: 'Uza zaidi hapa' },
                                                    { id: 'shipping_proof', label: 'Waybill & Video', icon: ShieldCheck, color: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-100', desc: 'Ushahidi wa safari' },
                                                ] : [
                                                    { id: 'shop_locations', label: 'Shop Locations', icon: MapPin, color: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-100', desc: 'Ona duka lilipo' },
                                                    { id: 'order_delivery', label: 'Usafirishaji', icon: Truck, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100', desc: 'Badili delivery vs pickup' },
                                                    { id: 'order_items', label: 'Vitu vya Oda', icon: ShoppingBag, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100', desc: 'Ona na badili vitu' },
                                                    { id: 'upsell', label: 'Bidhaa Zaidi', icon: Plus, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100', desc: 'Vitu vingine vya duka hili' },
                                                    { id: 'complaint', label: 'Complaint Centre', icon: AlertCircle, color: 'bg-red-50 text-red-600', border: 'border-red-100', desc: 'Toa malalamiko' },
                                                    { id: 'review', label: 'Review', icon: Star, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100', desc: 'Toa maoni yako' },
                                                ]).map((action) => {
                                                    const Icon = action.icon;
                                                    const isDisabled = action.disabled;
                                                    return (
                                                        <button
                                                            key={action.id}
                                                            disabled={isDisabled}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (action.id === 'shop_locations') {
                                                                    setIsShopModalOpen(true);
                                                                    setIsActionDrawerOpen(false);
                                                                } else if (action.id === 'extend_lock' || action.id === 'release_stock') {
                                                                    handleMerchantLockAction(action.id);
                                                                    setIsActionDrawerOpen(false);
                                                                } else {
                                                                    setActiveAction(action.id);
                                                                    setActionPayload({
                                                                        title: action.label,
                                                                        amount: action.id === 'discount' ? 5000 : action.id === 'shipping_cost' ? 7000 : 0,
                                                                        quantity: order?.quantity || 1
                                                                    });
                                                                    if (action.id === 'upsell') handleSearchProducts('');
                                                                    if (action.id === 'order_delivery') {
                                                                        const profileId = order?.product?.shipping_profile_id;
                                                                        if (profileId) {
                                                                            setLoadingZones(true);
                                                                            fetch(`/api/merchant/shipping-profiles/${profileId}/zones`, { headers: { Accept: 'application/json' } })
                                                                                .then(res => res.json())
                                                                                .then(json => {
                                                                                    if (json.data) setShippingZones(json.data);
                                                                                })
                                                                                .finally(() => setLoadingZones(false));
                                                                        }
                                                                    }
                                                                }
                                                            }}
                                                            className={cn(
                                                                "group relative flex flex-col items-start p-4 rounded-3xl border transition-all duration-300 text-left bg-white/50 hover:bg-white hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md overflow-hidden",
                                                                action.border,
                                                                isDisabled && "opacity-50 grayscale cursor-not-allowed"
                                                            )}
                                                        >
                                                            {isDisabled && (
                                                                <div className="absolute inset-0 bg-slate-50/40 flex items-center justify-center backdrop-blur-[1px]">
                                                                    <span className="bg-slate-900 text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase">PICKUP ONLY</span>
                                                                </div>
                                                            )}
                                                            <div className={cn("p-3 rounded-2xl mb-3 transition-transform group-hover:scale-110", action.color)}><Icon className="h-6 w-6" /></div>
                                                            <span className="font-black text-sm text-brand-900 tracking-tight leading-tight mb-1">{action.label}</span>
                                                            <span className="text-[10px] font-bold text-muted-foreground line-clamp-2">{action.desc}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-6 flex flex-col min-h-[400px] animate-in slide-in-from-right-4 duration-300">
                                            <div className="flex items-center justify-between mb-8">
                                                <div className="flex items-center gap-3">
                                                    <Button variant="ghost" size="icon" onClick={() => setActiveAction(null)} className="rounded-full h-10 w-10 bg-accent/50 hover:bg-accent"><ArrowLeft className="h-5 w-5 text-brand-900" /></Button>
                                                    <div>
                                                        <h3 className="text-xl font-black text-brand-900 dark:text-brand-100 flex items-center gap-2">{actionPayload.title}</h3>
                                                    </div>
                                                </div>
                                                <DrawerClose asChild><Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-accent/20"><X className="h-4 w-4 text-muted-foreground" /></Button></DrawerClose>
                                            </div>

                                            <div className="flex-1 space-y-6 overflow-y-auto pr-1">
                                                {activeAction === 'order_delivery' && actingAs === 'buyer' && (
                                                    <div className="space-y-6">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <button 
                                                                onClick={() => setIsSelfPickupChoice(true)}
                                                                className={cn(
                                                                    "p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2",
                                                                    isSelfPickupChoice ? "border-brand-600 bg-brand-50" : "border-slate-100 bg-slate-50 opacity-60"
                                                                )}
                                                            >
                                                                <Store className={cn("h-8 w-8", isSelfPickupChoice ? "text-brand-600" : "text-slate-400")} />
                                                                <span className={cn("font-black text-[10px] uppercase tracking-widest", isSelfPickupChoice ? "text-brand-600" : "text-slate-500")}>Kuchukua</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => setIsSelfPickupChoice(false)}
                                                                className={cn(
                                                                    "p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2",
                                                                    !isSelfPickupChoice ? "border-brand-600 bg-brand-50" : "border-slate-100 bg-slate-50 opacity-60"
                                                                )}
                                                            >
                                                                <Truck className={cn("h-8 w-8", !isSelfPickupChoice ? "text-brand-600" : "text-slate-400")} />
                                                                <span className={cn("font-black text-[10px] uppercase tracking-widest", !isSelfPickupChoice ? "text-brand-600" : "text-slate-500")}>Kuletewa</span>
                                                            </button>
                                                        </div>

                                                        {isSelfPickupChoice ? (
                                                            <div className="p-6 rounded-[2.5rem] bg-indigo-50 border border-indigo-100 space-y-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                                        <MapPin className="h-5 w-5" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-black text-indigo-900 uppercase text-[11px] tracking-widest">Maeneo ya Kuchukua</h4>
                                                                        <p className="text-[10px] font-bold text-indigo-600/70">Oda yako itachukuliwa dukan mwa muuzaji</p>
                                                                    </div>
                                                                </div>
                                                                <Button 
                                                                    onClick={() => setIsShopModalOpen(true)}
                                                                    variant="outline" 
                                                                    className="w-full h-12 rounded-2xl border-indigo-200 text-indigo-700 font-bold text-[11px] uppercase tracking-widest bg-white hover:bg-indigo-50"
                                                                >
                                                                    Ona Maduka ya Muuzaji
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                <div className="p-6 rounded-[2.5rem] bg-emerald-50 border border-emerald-100 space-y-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                                            <Navigation className="h-5 w-5" />
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="font-black text-emerald-900 uppercase text-[11px] tracking-widest">Eneo la Kufikisha</h4>
                                                                            <p className="text-[10px] font-bold text-emerald-600/70">Chagua eneo ili tujuwe gharama ya usafiri</p>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <button 
                                                                        onClick={() => setIsAddressPickerOpen(true)}
                                                                        className="w-full p-4 rounded-2xl bg-white border border-emerald-200 text-left hover:border-emerald-400 transition-colors group"
                                                                    >
                                                                        {(physicalAddress || order?.delivery?.physical_address) ? (
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-xs font-bold text-emerald-900 line-clamp-1">{physicalAddress || order?.delivery?.physical_address}</span>
                                                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 ml-2" />
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-xs font-bold text-emerald-600/50 uppercase tracking-widest">Chagua kwenye Ramani (Zone Matching)</span>
                                                                                <ChevronRight className="h-4 w-4 text-emerald-300 group-hover:translate-x-1 transition-transform" />
                                                                            </div>
                                                                        )}
                                                                    </button>

                                                                    <div className="space-y-2">
                                                                        <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1">Address ya Kufikisha (Manual)</label>
                                                                        <textarea 
                                                                            value={physicalAddress || order?.delivery?.physical_address || ''}
                                                                            onChange={e => setPhysicalAddress(e.target.value)}
                                                                            placeholder="Mfano: Mtaa wa Uhuru, Jengo la China Plaza, Room 402..."
                                                                            className="w-full min-h-[80px] p-4 rounded-2xl bg-white border border-emerald-100 focus:border-emerald-400 outline-none text-xs font-bold text-emerald-900 resize-none transition-colors"
                                                                        />
                                                                        <p className="text-[9px] font-bold text-emerald-600/60 leading-relaxed italic px-1">
                                                                            * Tumia sehemu hii kuweka maelezo ya ziada au address ya wakala (freight agent).
                                                                        </p>
                                                                    </div>

                                                                    {selectedZoneId && (
                                                                        <div className="pt-2 flex items-center justify-between border-t border-emerald-100">
                                                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Gharama ya Usafiri</span>
                                                                            <span className="text-sm font-black text-emerald-900">
                                                                                TZS {Number(shippingZones.find(z => String(z.id) === String(selectedZoneId))?.flat_rate_fee || 0).toLocaleString()}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <Button 
                                                            onClick={() => {
                                                                const activeZone = shippingZones.find(z => String(z.id) === String(selectedZoneId));
                                                                submitAction('update_delivery', {
                                                                    delivery_type: isSelfPickupChoice ? 'self_pickup' : 'shipping',
                                                                    delivery_zone_id: isSelfPickupChoice ? null : selectedZoneId,
                                                                    shipping_fee: isSelfPickupChoice ? 0 : (activeZone?.flat_rate_fee || 0),
                                                                    physical_address: physicalAddress || order?.delivery?.physical_address,
                                                                    latitude: customerLat || order?.delivery?.latitude,
                                                                    longitude: customerLng || order?.delivery?.longitude,
                                                                    shipping_hotspot_id: selectedHotspot?.id,
                                                                    title: isSelfPickupChoice ? 'NIMECHAGUA PICKUP' : `NIMECHAGUA DELIVERY: ${physicalAddress || order?.delivery?.physical_address}`
                                                                });
                                                            }}
                                                            disabled={!isSelfPickupChoice && !selectedZoneId && !physicalAddress && !order?.delivery?.physical_address}
                                                            className="w-full h-16 rounded-[2rem] bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-brand-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                                        >
                                                            Thibitisha Usafirishaji
                                                        </Button>
                                                    </div>
                                                )}

                                                {activeAction === 'shipping_cost' && actingAs === 'merchant' && (
                                                    <div className="p-4 rounded-2xl bg-brand-50 border border-brand-100 space-y-3">
                                                        <p className="text-[10px] font-black uppercase text-brand-600 tracking-widest flex items-center gap-2"><MapPin className="h-3 w-3" /> Taarifa za Usafirishaji</p>
                                                        <div className="space-y-1">
                                                            <p className="text-xs font-black text-brand-900">{order?.delivery?.physical_address || (order?.delivery?.latitude ? `${order.delivery.latitude}, ${order.delivery.longitude}` : 'Address Haijawekwa')}</p>
                                                            {(() => {
                                                                const closest = findClosestLocation();
                                                                return closest ? (
                                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                                                        <Navigation className="h-3 w-3" />
                                                                        <span>{closest.distance}km kutoka duka lako la {closest.name}</span>
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                        {order?.delivery?.latitude && (
                                                            <a href={`https://www.google.com/maps/search/?api=1&query=${order.delivery.latitude},${order.delivery.longitude}`} target="_blank" className="block text-center py-2 bg-white rounded-xl border border-brand-200 text-[10px] font-black text-brand-700 hover:bg-brand-50 transition-colors">FUNGUA RAMANI (MAPS)</a>
                                                        )}
                                                    </div>
                                                )}

                                                {activeAction === 'discount' && (
                                                    <div className="space-y-6">
                                                        {Number(order.discount_amount) > 0 && (
                                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <p className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-2 tracking-widest">Punguzo la Sasa</p>
                                                                {showDiscountResetConfirm ? (
                                                                    <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-100 flex items-center justify-between gap-4 animate-in zoom-in-95 duration-200">
                                                                        <p className="text-[10px] font-black text-red-900 uppercase">Futa punguzo hili?</p>
                                                                        <div className="flex gap-2">
                                                                            <Button onClick={() => { submitAction('discount', { mode: 'reset', title: 'FUTA PUNGUZO' }); setShowDiscountResetConfirm(false); }} className="h-8 px-4 rounded-xl bg-red-600 text-white font-black text-[10px] uppercase">NDIYO</Button>
                                                                            <Button onClick={() => setShowDiscountResetConfirm(false)} variant="ghost" className="h-8 px-4 rounded-xl font-black text-[10px] uppercase">RUDI</Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-5 rounded-[2rem] bg-amber-50 border border-amber-100 flex items-center justify-between shadow-sm group">
                                                                        <div>
                                                                            <p className="text-xl font-black text-amber-600">TZS {Number(order.discount_amount || 0).toLocaleString()}</p>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => setShowDiscountResetConfirm(true)}
                                                                            className="h-10 w-10 rounded-xl bg-white border border-amber-200 text-amber-400 flex items-center justify-center hover:bg-red-500 hover:border-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
                                                                        >
                                                                            <X className="h-5 w-5" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="space-y-3">
                                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Ongeza Punguzo</label>
                                                            <div className="relative group">
                                                                <Input
                                                                    type="number"
                                                                    value={actionPayload.amount || ''}
                                                                    onChange={e => setActionPayload(p => ({ ...p, amount: Number(e.target.value) }))}
                                                                    className="h-16 rounded-2xl text-2xl font-black bg-slate-50 border-2 border-transparent transition-all focus:bg-white focus:border-amber-200 outline-none pl-6 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    placeholder="0.00"
                                                                />
                                                                <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300 pointer-events-none group-focus-within:text-amber-300 transition-colors">TZS</div>
                                                            </div>
                                                        </div>

                                                        <div className="pt-4">
                                                            <Button
                                                                onClick={() => {
                                                                    submitAction('discount', { ...actionPayload, mode: 'add', title: `WEKA PUNGUZO TZS ${Number(actionPayload.amount).toLocaleString()}` });
                                                                    setActionPayload({ ...actionPayload, amount: '' });
                                                                }}
                                                                disabled={!actionPayload.amount || actionPayload.amount <= 0}
                                                                className="w-full h-16 rounded-[2rem] bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-brand-600/30 transition-all active:scale-[0.98]"
                                                            >
                                                                WEKA PUNGUZO
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeAction === 'shipping_cost' && (
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Ushaji wa TZS Gani?</label>
                                                        <div className="relative group">
                                                            <Input type="number" value={actionPayload.amount} onChange={e => setActionPayload(p => ({ ...p, amount: Number(e.target.value) }))} className="h-16 rounded-2xl text-2xl font-black bg-slate-50 border-2 border-transparent transition-all focus:bg-white focus:border-brand-200 outline-none pl-6 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
                                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300 pointer-events-none group-focus-within:text-brand-200 transition-colors">TZS</div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeAction === 'quantity' && (
                                                    <div className="space-y-4">
                                                        <div className="p-6 rounded-3xl bg-blue-50/50 border border-blue-100 flex flex-col items-center gap-4">
                                                            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Idadi ya {order?.product?.title || 'Bidhaa'}</p>
                                                            <div className="flex items-center gap-6">
                                                                <button onClick={() => setActionPayload(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))} className="h-12 w-12 rounded-2xl bg-white border-2 border-blue-100 text-blue-600 flex items-center justify-center text-2xl font-black active:scale-90 transition-transform shadow-sm">-</button>
                                                                <span className="text-4xl font-black text-brand-900">{actionPayload.quantity}</span>
                                                                <button onClick={() => setActionPayload(p => ({ ...p, quantity: p.quantity + 1 }))} className="h-12 w-12 rounded-2xl bg-white border-2 border-blue-100 text-blue-600 flex items-center justify-center text-2xl font-black active:scale-90 transition-transform shadow-sm">+</button>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-center text-slate-400 px-4 italic leading-relaxed">Unapobadilisha idadi, jumla ya gharama ya oda itabadilika kulingana na bei ya bidhaa hii.</p>
                                                    </div>
                                                )}

                                                {activeAction === 'complaint' && (
                                                    <div className="space-y-6">
                                                        {getActiveComplaint() ? (
                                                            <div className="space-y-6">
                                                                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-brand-100 dark:border-brand-900/50">
                                                                    <div className="flex items-center gap-3 mb-4">
                                                                        <div className="h-10 w-10 rounded-2xl bg-red-500 flex items-center justify-center text-white">
                                                                            <AlertTriangle className="h-6 w-6" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hali ya Malalamiko</p>
                                                                            <h4 className="text-lg font-black text-brand-900 dark:text-brand-100 uppercase tracking-tight">INAPELELEZWA</h4>
                                                                        </div>
                                                                    </div>

                                                                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-brand-50 dark:border-brand-900/40">
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Maelezo Yako</p>
                                                                        <p className="text-sm font-bold text-brand-900 dark:text-brand-100 leading-relaxed italic">"{getActiveComplaint().payload?.reason}"</p>
                                                                    </div>

                                                                    {actingAs === 'merchant' && (
                                                                        <div className="grid grid-cols-2 gap-3 mt-6">
                                                                            <Button onClick={() => submitAction('complaint_resolved', { title: 'MALALAMIKO YAMETATULIWA' })} className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20">SETI RESOLVED</Button>
                                                                            <Button onClick={() => submitAction('complaint_appealed', { title: 'RUFAA IMEKATWA (APPEAL)' })} variant="outline" className="h-14 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 font-black uppercase tracking-widest text-[10px]">KATA RUFAA</Button>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <p className="text-[10px] font-bold text-center text-slate-400 px-6 leading-relaxed uppercase italic">
                                                                    {actingAs === 'buyer'
                                                                        ? "Tayari una malalamiko ya oda hii yanayofanyiwa kazi. Huwezi kufungua mapya mpaka yaliyopo yatatuliwe."
                                                                        : "Kama muuzaji, unaweza kumaliza mgogoro huu kwa kukubaliana na mteja au kukata rufaa kwa platform."}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            actingAs === 'buyer' ? (
                                                                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                                                                    <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-xs font-bold leading-relaxed space-y-2">
                                                                        <p className="font-black uppercase text-[10px] tracking-widest text-red-600 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> TANBIHI MUHIMU</p>
                                                                        <p>Malalamiko yatatumwa moja kwa moja kwenye platform ya Takeer kwa ajili ya utatuzi.</p>
                                                                        <p className="italic underline">Tuma malalamiko ikiwa bidhaa uliyopokea sio yenyewe au kuna dalili zozote za utapeli.</p>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Maelezo Kamili</label>
                                                                        <textarea className="w-full h-32 rounded-2xl bg-slate-50 border-2 border-transparent p-4 text-sm font-bold placeholder:opacity-50 resize-none outline-none focus:bg-white focus:border-red-200 focus:ring-4 ring-red-500/5 transition-all" placeholder="Elezea kwa kifupi kilichotokea..." onChange={e => setActionPayload(p => ({ ...p, reason: e.target.value }))} />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="p-12 flex flex-col items-center text-center space-y-4">
                                                                    <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center">
                                                                        <ShieldCheck className="h-10 w-10 text-slate-200" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Hakuna Malalamiko</h4>
                                                                        <p className="text-[11px] font-bold text-slate-300 mt-1 uppercase">Mteja hajafungua mgogoro wowote kuhusu oda hii.</p>
                                                                    </div>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                )}

                                                {activeAction === 'upsell' && (
                                                    <div className="space-y-6">
                                                        <div className="relative group mx-4">
                                                            <Input
                                                                type="text"
                                                                placeholder="Tafuta bidhaa za duka hili..."
                                                                className="h-14 rounded-[1.25rem] pl-12 bg-white border-2 border-slate-100 focus:border-brand-300 outline-none transition-all shadow-sm font-bold"
                                                                value={searchQuery}
                                                                onChange={(e) => handleSearchProducts(e.target.value)}
                                                            />
                                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
                                                            {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-brand-500" />}
                                                        </div>

                                                        {/* Horizontal Scroll List */}
                                                        <div className="flex gap-4 overflow-x-auto pb-4 px-4 no-scrollbar scroll-smooth">
                                                            {searchResults.length > 0 ? searchResults.map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => {
                                                                        setSelectedProduct(p);
                                                                        setSelectedVariant(p.has_variants && p.variants?.length ? p.variants[0] : null);
                                                                    }}
                                                                    className="flex flex-col w-44 shrink-0 p-3 rounded-[2.5rem] bg-white border border-slate-100 hover:border-brand-200 transition-all shadow-sm hover:shadow-md group text-left"
                                                                >
                                                                    <div className="h-36 w-full rounded-[2rem] bg-slate-50 flex-shrink-0 overflow-hidden mb-3">
                                                                        <img src={p.image_url || p.url} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                                                                    </div>
                                                                    <div className="px-1 min-w-0">
                                                                        <h4 className="font-black text-brand-900 text-xs truncate mb-1">{p.title}</h4>
                                                                        <span className="text-[10px] font-black text-brand-600 block">{getPriceRange(p)}</span>
                                                                    </div>
                                                                </button>
                                                            )) : searchQuery && !isSearching ? (
                                                                <div className="w-full py-12 flex flex-col items-center justify-center opacity-40">
                                                                    <Search className="h-12 w-12 mb-4" />
                                                                    <p className="font-black uppercase text-xs tracking-widest">Hakuna matokeo</p>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                )}

                                                {activeAction === 'order_items' && (
                                                    <div className="space-y-8 px-4 pb-12">
                                                        <div className="flex flex-col gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                                            {[
                                                                { id: order.product_id, variant_id: order.variant_id, title: order.product?.title, price: order.unit_price, quantity: order.quantity, image: order.product?.image_url || order.product?.url, isMain: true },
                                                                ...(order.extra_items || [])
                                                            ].map((item, idx) => (
                                                                <div key={`${item.id}-${item.variant_id || idx}`} className="flex items-center gap-4 p-5 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm group">
                                                                    <div className="h-16 w-16 rounded-2xl bg-slate-50 flex-shrink-0 overflow-hidden">
                                                                        <img src={item.image} className="h-full w-full object-cover" alt="" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="font-black text-brand-900 text-sm truncate uppercase tracking-tighter">{item.title}</h4>
                                                                        <div className="flex items-center justify-between mt-2">
                                                                            <span className="text-xs font-bold text-brand-600">TZS {Number(item.price).toLocaleString()}</span>
                                                                            {order.payment_status !== 'paid' ? (
                                                                                <div className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-slate-50 border border-slate-100">
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            if (item.quantity > 1) {
                                                                                                submitAction('update_item_quantity', { id: item.id, variant_id: item.variant_id, quantity: item.quantity - 1, title: `PUNGUZA ${item.title.toUpperCase()}` });
                                                                                            } else {
                                                                                                submitAction('remove_item', { id: item.id, variant_id: item.variant_id, title: `ONDOA ${item.title.toUpperCase()}` });
                                                                                            }
                                                                                        }}
                                                                                        className="text-slate-400 hover:text-brand-600 transition-colors"
                                                                                    >
                                                                                        <X className="h-3.5 w-3.5" />
                                                                                    </button>
                                                                                    <span className="text-xs font-black text-brand-900">{item.quantity}</span>
                                                                                    <button
                                                                                        onClick={() => submitAction('update_item_quantity', { id: item.id, variant_id: item.variant_id, quantity: item.quantity + 1, title: `ONGEZA ${item.title.toUpperCase()}` })}
                                                                                        className="text-slate-400 hover:text-brand-600 transition-colors"
                                                                                    >
                                                                                        <Plus className="h-3.5 w-3.5" />
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-xs font-black text-slate-400">Qty: {item.quantity}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Summary Section */}
                                                        <div className="p-6 rounded-[2.5rem] bg-slate-50 border border-slate-200/50 space-y-4 shadow-inner">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subtotal</span>
                                                                <span className="text-xs font-black text-brand-900">TZS {Number(order.total_paid - (order.shipping_fee || 0) + (Number(order.discount_amount) || 0)).toLocaleString()}</span>
                                                            </div>
                                                            {Number(order.shipping_fee) > 0 && (
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <Truck className="h-3 w-3 text-emerald-500" />
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Usafirishaji</span>
                                                                    </div>
                                                                    <span className="text-xs font-black text-emerald-600">+ TZS {Number(order.shipping_fee).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            {Number(order.discount_amount) > 0 && (
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <Tag className="h-3 w-3 text-amber-500" />
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Punguzo</span>
                                                                    </div>
                                                                    <span className="text-xs font-black text-amber-600">- TZS {Number(order.discount_amount).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            <div className="h-px bg-slate-200" />
                                                            <div className="flex items-center justify-between pt-2">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-brand-400">Jumla Kamili</span>
                                                                <span className="text-2xl font-black text-brand-900">TZS {Number(order.total_paid).toLocaleString()}</span>
                                                            </div>
                                                        </div>

                                                        {order.payment_status !== 'paid' && actingAs === 'buyer' && (
                                                            <div className="text-center">
                                                                {showCancelConfirm ? (
                                                                    <div className="p-6 rounded-[2rem] bg-red-50 border-2 border-red-100 animate-in zoom-in-95 duration-200">
                                                                        <p className="text-xs font-black text-red-900 mb-4">Je, una uhakika unataka kughairi oda hii? Haiwezi kufunguliwa tena.</p>
                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            <Button onClick={() => submitAction('cancel_order', { title: 'GHAIRI ODA' })} variant="destructive" className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]">NDIYO, GHAIRI</Button>
                                                                            <Button onClick={() => setShowCancelConfirm(false)} variant="ghost" className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]">HAPANA, RUDI</Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setShowCancelConfirm(true)}
                                                                        className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors underline underline-offset-4"
                                                                    >
                                                                        GHAIRI ODA HII
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {activeAction === 'review' && (
                                                    <div className="space-y-6">
                                                        {orderStatus !== 'delivered' && orderStatus !== 'completed' ? (
                                                            <div className="p-8 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
                                                                <X className="h-10 w-10 text-slate-300 mb-4" />
                                                                <p className="text-sm font-black text-slate-500 uppercase tracking-tight mb-2">Hauwezi kutoa maoni sasa</p>
                                                                <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase">Tafadhali subiri mpaka upokee bidhaa yako ndipo utoe maoni kuhusu huduma hii.</p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex flex-col items-center justify-center p-6 bg-amber-50/50 rounded-3xl border border-amber-100 group">
                                                                    <p className="text-[10px] font-black uppercase text-amber-600 mb-4 tracking-widest">Gusa nyota ili upige kura</p>
                                                                    <div className="flex items-center gap-2">
                                                                        {[1, 2, 3, 4, 5].map(s => (
                                                                            <button key={s} onClick={() => setActionPayload(p => ({ ...p, stars: s }))} className="p-1 transition-transform hover:scale-125 active:scale-90"><Star className={cn("h-10 w-10 transition-colors", s <= (actionPayload.stars || 5) ? "fill-amber-500 text-amber-500" : "text-amber-200")} /></button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Maoni Yako</label>
                                                                    <textarea className="w-full h-24 rounded-2xl bg-slate-50 border-2 border-transparent p-4 text-sm font-bold placeholder:opacity-50 resize-none outline-none focus:bg-white focus:border-amber-200 focus:ring-4 ring-amber-500/5 transition-all" placeholder="Toa maoni yako hapa..." onChange={e => setActionPayload(p => ({ ...p, comment: e.target.value }))} />
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {activeAction === 'shipping_proof' && (
                                                    <div className="space-y-4">
                                                        <p className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Vitu vya Kupakia</p>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <button 
                                                                onClick={() => mediaRef.current?.click()}
                                                                className="group flex flex-col items-center justify-center gap-3 h-40 border-2 border-dashed border-brand-200 rounded-3xl bg-brand-50/30 hover:bg-white hover:border-brand-500 transition-all"
                                                            >
                                                                <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 group-hover:scale-110 transition-transform"><ImageIcon className="h-6 w-6" /></div>
                                                                <span className="text-[10px] font-black uppercase text-brand-900 tracking-tighter">Waybill Receipt</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => mediaRef.current?.click()}
                                                                className="group flex flex-col items-center justify-center gap-3 h-40 border-2 border-dashed border-brand-200 rounded-3xl bg-brand-50/30 hover:bg-white hover:border-brand-500 transition-all"
                                                            >
                                                                <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 group-hover:scale-110 transition-transform"><Video className="h-6 w-6" /></div>
                                                                <span className="text-[10px] font-black uppercase text-brand-900 tracking-tighter">Packing Video</span>
                                                            </button>
                                                        </div>
                                                        <p className="text-[9px] font-bold text-center text-slate-400 uppercase">Hii video itasaidia kama mteja akifungua mgogoro (Dispute)</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-6 pb-6 mt-auto">
                                                {activeAction !== 'upsell' && activeAction !== 'order_items' && activeAction !== 'discount' && activeAction !== 'order_delivery' && (
                                                    <Button
                                                        className="w-full h-16 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-brand-600/30 transition-all active:scale-[0.98]"
                                                        disabled={
                                                            (activeAction === 'review' && (orderStatus !== 'delivered' && orderStatus !== 'completed')) ||
                                                            (activeAction === 'complaint' && (getActiveComplaint() || (actingAs === 'merchant')))
                                                        }
                                                        onClick={() => submitAction(activeAction, { ...actionPayload, title: `SETI ${activeAction.toUpperCase()}`, userName: auth.user.name })}
                                                    >
                                                        SETI {activeAction.toUpperCase()}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </DrawerContent>
                        </Drawer>

                        <div className="relative flex-1">
                            <Input type="text" placeholder="Andika ujumbe wako hapa..." value={input} onChange={(e) => setInput(e.target.value)} className="h-12 pl-4 pr-10 rounded-full border-brand-100 focus-visible:ring-brand-500 shadow-sm" />
                            <input 
                                type="file" 
                                ref={mediaRef} 
                                className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none w-0 h-0" 
                                accept="image/*,video/*" 
                                onChange={handleMediaUpload} 
                            />
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => mediaRef.current?.click()}
                                disabled={isUploading}
                                title="Ambatanisha picha au video"
                                className="absolute right-1 top-1 h-10 w-10 text-brand-400 hover:text-brand-600 hover:bg-transparent"
                            >
                                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-5 w-5" />}
                            </Button>
                        </div>

                        <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="shrink-0 h-12 w-12 rounded-full bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-600/20">
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        </Button>
                    </form>
                </div>

                <ShopLocationsModal 
                    isOpen={isShopModalOpen} 
                    onOpenChange={setIsShopModalOpen} 
                    locations={order?.merchant?.locations || []}
                    productName={order?.product?.title}
                />

                <AddressPickerModal 
                    isOpen={isAddressPickerOpen}
                    onOpenChange={setIsAddressPickerOpen}
                    onSave={handleAddressSaved}
                    initialLat={customerLat}
                    initialLng={customerLng}
                />

                {/* Product Chat Detail Modal */}
                <Drawer open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
                    <DrawerContent className="max-h-[85vh] rounded-t-[3rem]">
                        <div className="mx-auto w-full max-w-lg">
                            <div className="overflow-y-auto no-scrollbar pb-12">
                                {/* Image Gallery Simulation */}
                                <div className="p-4">
                                    <div className="aspect-square rounded-[3rem] bg-slate-50 overflow-hidden relative group">
                                        <img src={selectedProduct?.image_url || selectedProduct?.url} className="w-full h-full object-cover" alt="" />
                                        <button onClick={() => setSelectedProduct(null)} className="absolute top-6 right-6 h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white/40 transition-all shadow-xl"><X className="h-6 w-6" /></button>
                                    </div>
                                </div>

                                <div className="px-8 space-y-6">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400 mb-2">Maelezo ya Bidhaa</p>
                                        <h2 className="text-2xl font-black text-brand-900 tracking-tight leading-tight mb-2">{selectedProduct?.title}</h2>
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl font-black text-brand-600">{getPriceRange(selectedProduct || {})}</span>
                                            {selectedProduct?.compare_at_price && (
                                                <span className="text-sm font-bold text-slate-300 line-through">TZS {Number(selectedProduct.compare_at_price).toLocaleString()}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Variants Selection */}
                                    {selectedProduct?.has_variants && selectedProduct?.variants?.length > 0 && (
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chagua Aina (Variants)</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedProduct.variants.map(v => (
                                                    <button
                                                        key={v.id}
                                                        onClick={() => setSelectedVariant(v)}
                                                        className={cn(
                                                            "px-4 py-3 rounded-2xl border-2 transition-all font-black text-xs uppercase tracking-widest",
                                                            selectedVariant?.id === v.id ? "border-brand-600 bg-brand-50 text-brand-600" : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                                                        )}
                                                    >
                                                        {v.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Button */}
                                    <div className="pt-4 pb-8 sticky bottom-0 bg-white shadow-[0_-20px_20px_-10px_rgba(255,255,255,0.8)]">
                                        <Button
                                            onClick={() => {
                                                const p = {
                                                    id: selectedProduct.id,
                                                    variant_id: selectedVariant?.id,
                                                    title: selectedVariant ? `${selectedProduct.title} (${selectedVariant.name})` : selectedProduct.title,
                                                    price: selectedVariant ? selectedVariant.price : selectedProduct.price,
                                                    image: selectedProduct.image_url || selectedProduct.url,
                                                    quantity: 1,
                                                    variant_name: selectedVariant?.name
                                                };
                                                submitAction(actingAs === 'merchant' ? 'suggest_product' : 'add_to_order', {
                                                    product: p,
                                                    title: actingAs === 'merchant' ? `SUGGEST ${p.title}` : `ADD ${p.title}`
                                                });
                                                setSelectedProduct(null);
                                            }}
                                            className="w-full h-16 rounded-[2rem] bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-brand-600/30 flex items-center justify-center gap-3"
                                        >
                                            {actingAs === 'merchant' ? (
                                                <><Plus className="h-5 w-5" /> PENDEKEZA KWA MTEJA</>
                                            ) : (
                                                <><ShoppingBag className="h-5 w-5" /> ONGEZA KWENYE ODA</>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DrawerContent>
                </Drawer>
            {/* Payment Drawer */}
            <Drawer open={isPaymentDrawerOpen} onOpenChange={setIsPaymentDrawerOpen}>
                <DrawerContent className="w-full sm:max-w-xl mx-auto p-0 border-t border-brand-100/50 dark:border-brand-900/50 bg-white dark:bg-slate-950">
                    <div className="bg-gradient-to-br from-brand-600 to-brand-900 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-[-20%] right-[-10%] h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="h-20 w-20 rounded-3xl bg-white/20 backdrop-blur-xl flex items-center justify-center mb-4 border border-white/30 shadow-lg">
                                <Zap className="h-10 w-10 fill-white" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-1">Mchakato wa Malipo</p>
                            <h2 className="text-4xl font-black tracking-tight mb-2">TZS {Number(order?.total_paid).toLocaleString()}</h2>
                            <div className="px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheck className="h-3 w-3" /> Malipo Salama (Escrow)
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-8 pb-12">
                        {/* Custom Tabs */}
                        <div className="grid grid-cols-2 gap-3 p-1.5 rounded-[2rem] bg-slate-50 border border-slate-100">
                            <button 
                                onClick={() => setPaymentMethod('mobile')}
                                className={cn(
                                    "flex items-center justify-center gap-3 py-4 rounded-[1.50rem] font-black text-[11px] uppercase tracking-widest transition-all",
                                    paymentMethod === 'mobile' ? "bg-white shadow-lg text-brand-600" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <Zap className={cn("h-4 w-4", paymentMethod === 'mobile' ? "fill-brand-600" : "fill-slate-400")} />
                                Lipa kwa Simu
                            </button>
                            <button 
                                onClick={() => setPaymentMethod('card')}
                                className={cn(
                                    "flex items-center justify-center gap-3 py-4 rounded-[1.50rem] font-black text-[11px] uppercase tracking-widest transition-all",
                                    paymentMethod === 'card' ? "bg-white shadow-lg text-brand-600" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <CreditCard className="h-4 w-4" />
                                Lipa kwa Kadi
                            </button>
                        </div>

                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {paymentMethod === 'mobile' ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Namba ya Simu ya Malipo</label>
                                        <div className="relative group">
                                            <Input 
                                                value={paymentPhone}
                                                onChange={e => setPaymentPhone(e.target.value)}
                                                className="h-20 rounded-3xl text-3xl font-black bg-slate-50 border-2 border-transparent focus:border-brand-300 outline-none pl-8 shadow-inner"
                                                placeholder="0XXX XXXXXX"
                                            />
                                            <div className="absolute right-8 top-1/2 -translate-y-1/2 font-black text-slate-300 pointer-events-none group-focus-within:text-brand-300 transition-colors uppercase tracking-widest text-xs">Simu</div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic px-2">
                                        Hakikisha simu iko karibu. Utapokea ombi la kuweka PIN ili kukamilisha malipo.
                                    </p>
                                </div>
                            ) : (
                                <div className="aspect-video bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-8 gap-4">
                                    <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                                        <CreditCard className="h-8 w-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-black text-slate-400 uppercase tracking-widest text-sm">Card Payments Coming Soon</h4>
                                        <p className="text-[10px] font-bold text-slate-400 leading-relaxed max-w-[200px]">Tunakamilisha ushirikiano na benki ili kukuwezesha kulipa kwa kadi.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Button 
                            onClick={async () => {
                                if (paymentMethod === 'card') {
                                    toast.info('Tafadhali tumia malipo ya simu kwa sasa.');
                                    return;
                                }
                                setIsPaying(true);
                                try {
                                    await submitAction('initiate_payment', { 
                                        payment_number: paymentPhone, 
                                        title: `Malipo yameanzishwa — TZS ${Number(order?.total_paid).toLocaleString()}` 
                                    });
                                    // Optimistically mark order as paid in the UI
                                    setOrder(prev => prev ? { ...prev, payment_status: 'paid' } : prev);
                                    toast.success(`Malipo ya TZS ${Number(order?.total_paid).toLocaleString()} yamekamilika!`);
                                } finally {
                                    setIsPaying(false);
                                    setIsPaymentDrawerOpen(false);
                                }
                            }}
                            disabled={isPaying || (paymentMethod === 'mobile' && !paymentPhone)}
                            className="w-full h-20 rounded-[2.5rem] bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-brand-600/40 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            {isPaying ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <>
                                    <ShieldCheck className="h-5 w-5" />
                                    Kamilisha Malipo
                                </>
                            )}
                        </Button>
                    </div>
                </DrawerContent>
            </Drawer>
            </div>
        </AppLayout>
    );
}
