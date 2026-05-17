import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Link } from '@inertiajs/react';
import {
    Package, Plus, Search, Loader2,
    CheckCircle2, Clock, Archive, ShoppingBag,
    Image as ImageIcon, FileText, Calendar, ChevronLeft, ChevronRight, MessageSquare,
    Phone, Mail, MapPin, X, Copy, CalendarDays, ListChecks, Settings2, ExternalLink, Trash2
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { productPriceLabel, productStockLabel } from '@/lib/productUnits';
import { useMerchantPermissions } from '@/lib/merchantPermissions';

export default function MerchantProducts({ merchantUsername, typeScope = 'all', merchantTimezone = 'Africa/Dar_es_Salaam' }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, published, draft, archived
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [serviceRequests, setServiceRequests] = useState([]);
    const [calendarRequests, setCalendarRequests] = useState([]);
    const [serviceRequestsLoading, setServiceRequestsLoading] = useState(false);
    const [calendarRequestsLoading, setCalendarRequestsLoading] = useState(false);
    const [serviceRequestStatus, setServiceRequestStatus] = useState('pending');
    const [serviceManagerView, setServiceManagerView] = useState('inbox');
    const [calendarDate, setCalendarDate] = useState(() => new Date());
    const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
    const [selectedServiceRequest, setSelectedServiceRequest] = useState(null);
    const [requestAction, setRequestAction] = useState({ status: 'contacted', quoted_amount: '', scheduled_at: '' });
    const [requestUpdating, setRequestUpdating] = useState(false);
    const [notificationPreparing, setNotificationPreparing] = useState(false);
    const [scheduling, setScheduling] = useState(null);
    const [schedulingSaving, setSchedulingSaving] = useState(false);
    const [availabilityRules, setAvailabilityRules] = useState([]);
    const [availabilityTimezone, setAvailabilityTimezone] = useState(merchantTimezone);
    const [availabilityProductId, setAvailabilityProductId] = useState('');
    const [serviceSessions, setServiceSessions] = useState([]);
    const [deletingProductId, setDeletingProductId] = useState(null);
    const normalizedTypeScope = ['physical', 'digital', 'service'].includes(typeScope) ? typeScope : 'all';
    const { can, canAny } = useMerchantPermissions(merchantUsername);
    const resourceForScope = normalizedTypeScope === 'digital'
        ? 'digital_products'
        : (normalizedTypeScope === 'service' ? 'services' : 'products');
    const canCreate = canAny([`${resourceForScope}.create`, 'products.create', 'digital_products.create', 'services.create']);
    const canUpdate = canAny([`${resourceForScope}.update`, 'products.update', 'digital_products.update', 'services.update']);
    const canDelete = canAny([`${resourceForScope}.delete`, 'products.delete', 'digital_products.delete', 'services.delete']);
    const canSchedule = can('services.schedule');
    const weekdayOptions = [
        { value: 1, short: 'Mon', label: 'Monday' },
        { value: 2, short: 'Tue', label: 'Tuesday' },
        { value: 3, short: 'Wed', label: 'Wednesday' },
        { value: 4, short: 'Thu', label: 'Thursday' },
        { value: 5, short: 'Fri', label: 'Friday' },
        { value: 6, short: 'Sat', label: 'Saturday' },
        { value: 7, short: 'Sun', label: 'Sunday' },
    ];
    const selectedAvailabilityProduct = products.find((product) => String(product.id) === String(availabilityProductId));
    const availabilityMode = selectedAvailabilityProduct?.service_scheduling_type || 'recurring';

    useEffect(() => {
        fetchProducts();
    }, [filter, page, merchantUsername, normalizedTypeScope]);

    useEffect(() => {
        if (normalizedTypeScope === 'service') {
            fetchServiceRequests();
            fetchScheduling();
        }
    }, [merchantUsername, normalizedTypeScope, serviceRequestStatus]);

    useEffect(() => {
        if (normalizedTypeScope === 'service') {
            fetchCalendarRequests();
        }
    }, [merchantUsername, normalizedTypeScope, calendarDate]);

    useEffect(() => {
        setPage(1);
    }, [filter, normalizedTypeScope]);

    useEffect(() => {
        if (normalizedTypeScope !== 'service' || serviceManagerView !== 'availability') return;

        if (availabilityProductId && availabilityMode === 'fixed_sessions') {
            fetchServiceSessions(availabilityProductId);
            return;
        }

        fetchScheduling(availabilityProductId);
    }, [availabilityProductId, serviceManagerView, normalizedTypeScope, availabilityMode]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter !== 'all') params.set('status', filter);
            if (normalizedTypeScope !== 'all') params.set('type', normalizedTypeScope);
            params.set('page', String(page));
            const response = await axios.get(`/merchant/${merchantUsername}/products/api${params.toString() ? `?${params.toString()}` : ''}`);
            setProducts(response.data.data || []);
            setMeta(response.data.meta || { current_page: 1, last_page: 1, total: 0 });
        } catch (error) {
            console.error('Failed to fetch products:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteProduct = async (product) => {
        if (deletingProductId) return;
        const confirmed = window.confirm(
            product.status === 'draft'
                ? 'Unataka kufuta draft hii kabisa?'
                : 'Unataka kufuta bidhaa hii? Bidhaa yenye oda haiwezi kufutwa.'
        );
        if (!confirmed) return;

        setDeletingProductId(product.id);
        try {
            const response = await axios.delete(`/merchant/${merchantUsername}/products/${product.id}`);
            toast.success(response.data?.message || 'Bidhaa imeondolewa.');
            setProducts((prev) => prev.filter((item) => item.id !== product.id));
            setMeta((prev) => ({ ...prev, total: Math.max(0, Number(prev.total || 0) - 1) }));
            if (products.length === 1 && page > 1) {
                setPage((prev) => Math.max(1, prev - 1));
            } else {
                fetchProducts();
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kufuta bidhaa.');
        } finally {
            setDeletingProductId(null);
        }
    };

    const fetchServiceRequests = async () => {
        setServiceRequestsLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('status', serviceRequestStatus);
            params.set('per_page', '20');
            const response = await axios.get(`/merchant/${merchantUsername}/service-requests/api?${params.toString()}`);
            setServiceRequests(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch service requests:', error);
        } finally {
            setServiceRequestsLoading(false);
        }
    };

    const monthRange = (date) => {
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
        const start = new Date(monthStart);
        start.setDate(monthStart.getDate() - monthStart.getDay());
        start.setHours(0, 0, 0, 0);
        const end = new Date(monthEnd);
        end.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));
        end.setHours(23, 59, 59, 999);
        const toDateTime = (value) => {
            const offset = value.getTimezoneOffset();
            const local = new Date(value.getTime() - offset * 60000);
            return local.toISOString().slice(0, 19).replace('T', ' ');
        };

        return { start, end, startParam: toDateTime(start), endParam: toDateTime(end) };
    };

    const fetchCalendarRequests = async () => {
        setCalendarRequestsLoading(true);
        try {
            const range = monthRange(calendarDate);
            const params = new URLSearchParams();
            params.set('status', 'all');
            params.set('per_page', '100');
            params.set('scheduled_only', '1');
            params.set('sort', 'scheduled');
            params.set('scheduled_from', range.startParam);
            params.set('scheduled_to', range.endParam);
            const response = await axios.get(`/merchant/${merchantUsername}/service-requests/api?${params.toString()}`);
            setCalendarRequests(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch service calendar requests:', error);
        } finally {
            setCalendarRequestsLoading(false);
        }
    };

    const fetchScheduling = async (productId = availabilityProductId) => {
        try {
            const params = new URLSearchParams();
            if (productId) params.set('product_id', productId);
            const response = await axios.get(`/merchant/${merchantUsername}/service-scheduling/api${params.toString() ? `?${params.toString()}` : ''}`);
            applySchedulingResponse(response.data || null);
        } catch (error) {
            console.error('Failed to fetch service scheduling:', error);
        }
    };

    const fetchServiceSessions = async (productId = availabilityProductId) => {
        if (!productId) {
            setServiceSessions([]);
            return;
        }

        try {
            const response = await axios.get(`/merchant/${merchantUsername}/service-sessions/api?product_id=${productId}`);
            setServiceSessions(normalizeSessions(response.data?.sessions || []));
        } catch (error) {
            console.error('Failed to fetch service sessions:', error);
        }
    };

    const defaultAvailabilityRules = () => [1, 2, 3, 4, 5].map((weekday) => ({
        weekday,
        start_time: '09:00',
        end_time: '17:00',
        slot_interval_minutes: 60,
        buffer_minutes: 0,
        capacity_type: 'limited',
        capacity: 1,
        is_active: true,
    }));

    const normalizeAvailabilityRules = (rules = []) => (
        rules.length > 0 ? rules : defaultAvailabilityRules()
    ).map((rule, index) => ({
        local_id: rule.id || `local-${Date.now()}-${index}`,
        weekday: Number(rule.weekday || 1),
        start_time: String(rule.start_time || '09:00').slice(0, 5),
        end_time: String(rule.end_time || '17:00').slice(0, 5),
        slot_interval_minutes: Number(rule.slot_interval_minutes || 60),
        buffer_minutes: Number(rule.buffer_minutes || 0),
        capacity_type: rule.capacity_type || rule.metadata?.capacity_type || 'limited',
        capacity: Number(rule.capacity || 1),
        is_active: rule.is_active !== false,
    }));

    const applySchedulingResponse = (data) => {
        setScheduling(data);
        const rules = data?.availability_rules || [];
        const timezone = rules[0]?.timezone || data?.integration?.settings?.timezone || merchantTimezone;
        setAvailabilityTimezone(timezone);
        setAvailabilityRules(normalizeAvailabilityRules(rules));
    };

    const saveScheduling = async (rules = availabilityRules) => {
        if (schedulingSaving) return;
        setSchedulingSaving(true);
        try {
            const cleanedRules = rules
                .filter((rule) => rule.start_time && rule.end_time && rule.start_time < rule.end_time)
                .map((rule) => ({
                    weekday: Number(rule.weekday),
                    start_time: rule.start_time,
                    end_time: rule.end_time,
                    slot_interval_minutes: Number(rule.slot_interval_minutes || 60),
                    buffer_minutes: Number(rule.buffer_minutes || 0),
                    capacity_type: rule.capacity_type || 'limited',
                    capacity: Number(rule.capacity || 1),
                    is_active: Boolean(rule.is_active),
                }));

            if (cleanedRules.length === 0) {
                toast.error('Add at least one valid availability rule.');
                return;
            }

            const response = await axios.put(`/merchant/${merchantUsername}/service-scheduling/api`, {
                product_id: availabilityProductId ? Number(availabilityProductId) : null,
                timezone: availabilityTimezone,
                rules: cleanedRules,
            });
            toast.success(response.data?.message || 'Scheduling settings saved.');
            applySchedulingResponse(response.data || null);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to save scheduling settings.');
        } finally {
            setSchedulingSaving(false);
        }
    };

    const saveDefaultScheduling = async () => {
        const rules = normalizeAvailabilityRules(defaultAvailabilityRules());
        setAvailabilityRules(rules);
        await saveScheduling(rules);
    };

    const addAvailabilityRule = () => {
        setAvailabilityRules((prev) => ([
            ...prev,
            {
                local_id: `local-${Date.now()}`,
                weekday: 1,
                start_time: '09:00',
                end_time: '17:00',
                slot_interval_minutes: 60,
                buffer_minutes: 0,
                capacity_type: 'limited',
                capacity: 1,
                is_active: true,
            },
        ]));
    };

    const updateAvailabilityRule = (index, updates) => {
        setAvailabilityRules((prev) => prev.map((rule, ruleIndex) => (
            ruleIndex === index ? { ...rule, ...updates } : rule
        )));
    };

    const removeAvailabilityRule = (index) => {
        setAvailabilityRules((prev) => prev.filter((_, ruleIndex) => ruleIndex !== index));
    };

    const normalizeSessions = (sessions = []) => (
        sessions.length > 0 ? sessions : []
    ).map((session, index) => ({
        local_id: session.id || `session-${Date.now()}-${index}`,
        title: session.title || '',
        starts_at: session.starts_at ? session.starts_at.slice(0, 16) : '',
        ends_at: session.ends_at ? session.ends_at.slice(0, 16) : '',
        location_text: session.location_text || '',
        capacity: session.capacity ?? '',
        price_override: session.price_override ?? '',
        registration_deadline: session.registration_deadline ? session.registration_deadline.slice(0, 16) : '',
        status: session.status || 'open',
    }));

    const addServiceSession = () => {
        setServiceSessions((prev) => ([
            ...prev,
            {
                local_id: `session-${Date.now()}`,
                title: '',
                starts_at: '',
                ends_at: '',
                location_text: '',
                capacity: '',
                price_override: '',
                registration_deadline: '',
                status: 'open',
            },
        ]));
    };

    const updateServiceSession = (index, updates) => {
        setServiceSessions((prev) => prev.map((session, sessionIndex) => (
            sessionIndex === index ? { ...session, ...updates } : session
        )));
    };

    const removeServiceSession = (index) => {
        setServiceSessions((prev) => prev.filter((_, sessionIndex) => sessionIndex !== index));
    };

    const saveServiceSessions = async () => {
        if (schedulingSaving || !availabilityProductId) return;
        setSchedulingSaving(true);
        try {
            const sessions = serviceSessions
                .filter((session) => session.starts_at)
                .map((session) => ({
                    title: session.title || null,
                    starts_at: session.starts_at,
                    ends_at: session.ends_at || null,
                    timezone: availabilityTimezone,
                    location_text: session.location_text || null,
                    capacity: session.capacity === '' ? null : Number(session.capacity),
                    price_override: session.price_override === '' ? null : Number(session.price_override),
                    registration_deadline: session.registration_deadline || null,
                    status: session.status || 'open',
                }));

            if (sessions.length === 0) {
                toast.error('Add at least one session with a start date.');
                return;
            }

            const response = await axios.put(`/merchant/${merchantUsername}/service-sessions/api`, {
                product_id: Number(availabilityProductId),
                sessions,
            });
            toast.success(response.data?.message || 'Service sessions saved.');
            setServiceSessions(normalizeSessions(response.data?.sessions || []));
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to save sessions.');
        } finally {
            setSchedulingSaving(false);
        }
    };

    const openServiceRequest = (request) => {
        setSelectedServiceRequest(request);
        setRequestAction({
            status: request.status === 'pending' ? 'contacted' : request.status,
            quoted_amount: request.quoted_amount ?? '',
            scheduled_at: request.scheduled_at ? request.scheduled_at.slice(0, 16) : '',
        });
    };

    const updateServiceRequest = async (overrides = {}) => {
        if (!selectedServiceRequest || requestUpdating) return;
        setRequestUpdating(true);
        try {
            const payload = {
                status: overrides.status || requestAction.status,
                quoted_amount: requestAction.quoted_amount === '' ? null : Number(requestAction.quoted_amount),
                scheduled_at: requestAction.scheduled_at || null,
                generate_payment_link: Boolean(requestAction.quoted_amount),
            };
            const response = await axios.patch(
                `/merchant/${merchantUsername}/service-requests/${selectedServiceRequest.id}/status`,
                payload
            );
            toast.success(response.data?.message || 'Request updated.');
            setSelectedServiceRequest(response.data?.data || null);
            await fetchServiceRequests();
            await fetchCalendarRequests();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to update service request.');
        } finally {
            setRequestUpdating(false);
        }
    };

    const markServiceDelivered = async () => {
        if (!selectedServiceRequest || requestUpdating) return;
        setRequestUpdating(true);
        try {
            const response = await axios.post(
                `/merchant/${merchantUsername}/service-requests/${selectedServiceRequest.id}/mark-delivered`
            );
            toast.success(response.data?.message || 'Service marked delivered.');
            setSelectedServiceRequest(response.data?.data || selectedServiceRequest);
            await fetchServiceRequests();
            await fetchCalendarRequests();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to mark service delivered.');
        } finally {
            setRequestUpdating(false);
        }
    };

    const copyPaymentLink = async (url) => {
        try {
            await navigator.clipboard.writeText(url);
            toast.success('Payment link copied.');
        } catch (error) {
            toast.error('Could not copy payment link.');
        }
    };

    const copyPreparedMessage = async (message) => {
        try {
            await navigator.clipboard.writeText(message);
            toast.success('Message copied.');
        } catch (error) {
            toast.error('Could not copy message.');
        }
    };

    const prepareServiceRequestNotifications = async (channels = ['sms', 'whatsapp']) => {
        if (!selectedServiceRequest || notificationPreparing) return;
        setNotificationPreparing(true);
        try {
            const response = await axios.post(
                `/merchant/${merchantUsername}/service-requests/${selectedServiceRequest.id}/prepare-notification`,
                { channels }
            );
            toast.success(response.data?.message || 'Notification payloads are ready.');
            setSelectedServiceRequest(response.data?.service_request || selectedServiceRequest);
            await fetchServiceRequests();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to prepare notifications.');
        } finally {
            setNotificationPreparing(false);
        }
    };

    const prepareCalendarEvent = async () => {
        if (!selectedServiceRequest || requestUpdating) return;
        setRequestUpdating(true);
        try {
            const response = await axios.post(
                `/merchant/${merchantUsername}/service-requests/${selectedServiceRequest.id}/prepare-calendar-event`
            );
            toast.success(response.data?.message || 'Calendar event payload is ready.');
            setSelectedServiceRequest(response.data?.data || selectedServiceRequest);
            await fetchServiceRequests();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to prepare calendar event.');
        } finally {
            setRequestUpdating(false);
        }
    };

    const statusBadge = (status) => {
        switch (status) {
            case 'published':
                return <span className="flex items-center gap-1 text-[10px] font-bold bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" /> IMEWEKWA</span>;
            case 'draft':
                return <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full"><Clock className="h-3 w-3" /> RASIMU</span>;
            case 'archived':
                return <span className="flex items-center gap-1 text-[10px] font-bold bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full"><Archive className="h-3 w-3" /> IMEZUIWA</span>;
            default:
                return null;
        }
    };

    const typeIcon = (type) => {
        switch (type) {
            case 'physical': return <ImageIcon className="h-3.5 w-3.5" />;
            case 'digital': return <FileText className="h-3.5 w-3.5" />;
            case 'service': return <Calendar className="h-3.5 w-3.5" />;
            default: return <Package className="h-3.5 w-3.5" />;
        }
    };
    const facetValue = (entry) => {
        if (entry?.value_text !== null && entry?.value_text !== undefined && entry?.value_text !== '') return entry.value_text;
        if (entry?.value_number !== null && entry?.value_number !== undefined && entry?.value_number !== '') {
            const unit = entry?.value_json && typeof entry.value_json === 'object' ? entry.value_json.unit : null;
            return unit ? `${entry.value_number} ${unit}` : entry.value_number;
        }
        if (entry?.value_boolean !== null && entry?.value_boolean !== undefined) return entry.value_boolean ? 'Yes' : 'No';
        if (Array.isArray(entry?.value_json)) return entry.value_json.join(', ');
        if (entry?.value_json && typeof entry.value_json === 'object' && entry.value_json.unit) return `Unit: ${entry.value_json.unit}`;
        return '-';
    };
    const serviceModeLabel = (product) => ({
        showcase_only: 'Showcase',
        request_quote: 'Request quote',
        book_appointment: product.service_scheduling_type === 'fixed_sessions' ? 'Fixed sessions' : 'Appointment',
        pay_now: 'Pay / reserve',
        external_booking: 'External link',
    }[product.service_mode] || 'Service');
    const priceLabel = (product) => {
        if (product.type !== 'service') return productPriceLabel(product);
        if (product.service_price_display === 'hidden') return 'No public price';
        if (product.service_price_display === 'quote_only' || product.service_mode === 'request_quote') return 'Quote only';
        if (product.service_price_display === 'starts_from') return `From TZS ${parseFloat(product.price).toLocaleString()}`;
        if (product.service_price_display === 'hourly') return `TZS ${parseFloat(product.price).toLocaleString()}/hr`;
        if (product.service_price_display === 'daily') return `TZS ${parseFloat(product.price).toLocaleString()}/day`;
        if (product.service_price_display === 'nightly') return `TZS ${parseFloat(product.price).toLocaleString()}/night`;
        if (product.service_price_display === 'weekly') return `TZS ${parseFloat(product.price).toLocaleString()}/week`;
        if (product.service_price_display === 'monthly') return `TZS ${parseFloat(product.price).toLocaleString()}/month`;
        if (product.service_price_display === 'yearly') return `TZS ${parseFloat(product.price).toLocaleString()}/year`;
        if (product.service_price_display === 'per_person') return `TZS ${parseFloat(product.price).toLocaleString()}/person`;
        if (product.service_price_display === 'per_visit') return `TZS ${parseFloat(product.price).toLocaleString()}/visit`;
        if (product.service_price_display === 'per_session') return `TZS ${parseFloat(product.price).toLocaleString()}/session`;
        if (product.service_price_display === 'per_project') return `TZS ${parseFloat(product.price).toLocaleString()}/project`;
        if (product.service_price_display === 'package') return `TZS ${parseFloat(product.price).toLocaleString()} package`;
        return `TZS ${parseFloat(product.price).toLocaleString()}`;
    };
    const serviceRequestTypeLabel = (type) => ({
        quote_request: 'Quote request',
        appointment_request: 'Appointment',
        contact_request: 'Contact',
    }[type] || 'Request');
    const serviceRequestStatusClass = (status) => ({
        pending: 'bg-amber-100 text-amber-700',
        contacted: 'bg-sky-100 text-sky-700',
        quoted: 'bg-indigo-100 text-indigo-700',
        confirmed: 'bg-emerald-100 text-emerald-700',
        completed: 'bg-green-100 text-green-700',
        cancelled: 'bg-red-100 text-red-700',
    }[status] || 'bg-muted text-muted-foreground');

    const dateKey = (value) => {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const offset = date.getTimezoneOffset();
        const local = new Date(date.getTime() - offset * 60000);
        return local.toISOString().slice(0, 10);
    };
    const formatMonth = (date) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const formatTimeRange = (request) => {
        if (!request.scheduled_at) return 'Unscheduled';
        const start = new Date(request.scheduled_at);
        const end = request.scheduled_ends_at ? new Date(request.scheduled_ends_at) : null;
        const startLabel = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endLabel = end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
        return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
    };
    const calendarDays = (() => {
        const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
        const monthEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
        const gridStart = new Date(monthStart);
        gridStart.setDate(monthStart.getDate() - monthStart.getDay());
        const gridEnd = new Date(monthEnd);
        gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

        const days = [];
        const cursor = new Date(gridStart);
        while (cursor <= gridEnd) {
            const day = new Date(cursor);
            const key = dateKey(day);
            days.push({
                date: day,
                key,
                inMonth: day.getMonth() === calendarDate.getMonth(),
                isToday: key === dateKey(new Date()),
                requests: calendarRequests.filter((request) => dateKey(request.scheduled_at) === key),
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        return days;
    })();
    const nextCalendarBookings = calendarRequests
        .filter((request) => request.scheduled_at && new Date(request.scheduled_at) >= new Date(new Date().setHours(0, 0, 0, 0)))
        .slice(0, 8);
    const selectedCalendarRequests = selectedCalendarDay
        ? calendarRequests.filter((request) => dateKey(request.scheduled_at) === selectedCalendarDay)
        : [];
    const selectedCalendarLabel = selectedCalendarDay
        ? new Date(`${selectedCalendarDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : '';
    const selectedCalendarGroups = Object.values(selectedCalendarRequests.reduce((groups, request) => {
        const key = `${request.product?.id || 'service'}-${request.scheduled_at || 'unscheduled'}`;
        if (!groups[key]) {
            groups[key] = {
                key,
                productTitle: request.product?.title || 'Service booking',
                timeLabel: formatTimeRange(request),
                statusCounts: {},
                requests: [],
            };
        }
        groups[key].requests.push(request);
        groups[key].statusCounts[request.status] = (groups[key].statusCounts[request.status] || 0) + 1;
        return groups;
    }, {})).sort((a, b) => {
        const first = a.requests[0]?.scheduled_at || '';
        const second = b.requests[0]?.scheduled_at || '';
        return first.localeCompare(second);
    });
    const serviceManagerTabs = [
        { key: 'inbox', label: 'Inbox', icon: ListChecks },
        { key: 'calendar', label: 'Calendar', icon: CalendarDays },
        { key: 'availability', label: 'Availability', icon: Settings2 },
    ].filter((tab) => tab.key !== 'availability' || canSchedule);

    const filteredProducts = products.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const productCardTarget = (product) => (
        product.status === 'draft' && canUpdate
            ? `/merchant/${merchantUsername}/upload?edit=${product.id}`
            : `/merchant/${merchantUsername}/products/${product.id}`
    );

    const pageMeta = (() => {
        if (normalizedTypeScope === 'digital') {
            return {
                title: 'Digital Downloads',
                subtitle: 'Simamia faili za kidigitali na link za kupakua.',
                createLabel: 'Ongeza Download',
                createType: 'digital',
                icon: FileText,
            };
        }
        if (normalizedTypeScope === 'service') {
            return {
                title: 'Services & Bookings',
                subtitle: 'Simamia huduma, namba za mawasiliano, na booking links.',
                createLabel: 'Ongeza Service',
                createType: 'service',
                icon: Calendar,
            };
        }
        if (normalizedTypeScope === 'physical') {
            return {
                title: 'Physical Products',
                subtitle: 'Simamia bidhaa za stoo na mauzo ya usafirishaji.',
                createLabel: 'Ongeza Product',
                createType: 'physical',
                icon: ShoppingBag,
            };
        }
        return {
            title: 'Bidhaa Zangu',
            subtitle: 'Simamia hesabu na maelezo ya bidhaa zako zote.',
            createLabel: 'Ongeza Bidhaa',
            createType: null,
            icon: Package,
        };
    })();

    return (
        <AppLayout>
            <Head title={`${pageMeta.title} | Takeer`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">{pageMeta.title}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {pageMeta.subtitle}
                        </p>
                    </div>
                    {canCreate && (
                        <Button
                            onClick={() => router.visit(`/merchant/${merchantUsername}/upload${pageMeta.createType ? `?type=${pageMeta.createType}` : ''}`)}
                            className="bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl h-12 px-6 shadow-lg shadow-brand-600/20"
                        >
                            <Plus className="mr-2 h-5 w-5" /> {pageMeta.createLabel}
                        </Button>
                    )}
                </div>

                {normalizedTypeScope === 'service' && (
                    <div className="rounded-2xl border bg-white p-2">
                        <div className="grid grid-cols-3 gap-1">
                            {serviceManagerTabs.map(({ key, label, icon: Icon }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setServiceManagerView(key)}
                                    className={`min-h-12 rounded-xl px-2 text-xs font-black transition-colors flex flex-col sm:flex-row items-center justify-center gap-1.5 ${serviceManagerView === key
                                        ? 'bg-brand-600 text-white shadow-sm'
                                        : 'text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Filters & Search */}
                {normalizedTypeScope === 'service' && serviceManagerView === 'inbox' && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div>
                                <h2 className="font-black flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-amber-600" /> Service Request Inbox
                                </h2>
                                <p className="text-xs text-amber-800/80 mt-0.5">Quote, appointment, and contact requests from buyers.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    className="h-9 rounded-xl border border-amber-200 bg-white px-3 text-xs font-bold"
                                    value={serviceRequestStatus}
                                    onChange={(e) => setServiceRequestStatus(e.target.value)}
                                >
                                    <option value="pending">Pending</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="quoted">Quoted</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="all">All</option>
                                </select>
                                <Button variant="outline" size="sm" className="rounded-xl" onClick={fetchServiceRequests}>
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        {serviceRequestsLoading ? (
                            <p className="text-sm font-semibold text-amber-800">Loading requests...</p>
                        ) : serviceRequests.length === 0 ? (
                            <p className="text-sm font-semibold text-amber-800">No pending service requests yet.</p>
                        ) : (
                            <div className="grid gap-2">
                                {serviceRequests.map((request) => (
                                    <button
                                        type="button"
                                        key={request.id}
                                        onClick={() => openServiceRequest(request)}
                                        className="rounded-xl border border-amber-100 bg-white px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:border-amber-300 transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-black truncate">{request.product?.title || 'Service request'}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {request.customer_name} {request.customer_phone ? `• ${request.customer_phone}` : ''} {request.preferred_date ? `• ${request.preferred_date}` : ''}
                                            </p>
                                            {request.message && <p className="text-xs text-amber-800 mt-1 line-clamp-1">{request.message}</p>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-max rounded-full bg-amber-100 text-amber-700 px-2 py-1 text-[10px] font-black uppercase tracking-widest">
                                                {serviceRequestTypeLabel(request.request_type)}
                                            </span>
                                            <span className={`w-max rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${serviceRequestStatusClass(request.status)}`}>
                                                {request.status}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {normalizedTypeScope === 'service' && serviceManagerView === 'calendar' && (
                    <div className="rounded-2xl border bg-white p-4 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div>
                                <h2 className="font-black flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4 text-brand-600" /> Takeer Booking Calendar
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Confirmed or scheduled Takeer bookings for this month. Connect <Link href="/merchant/settings" className="font-bold text-brand-600">Google Calendar</Link> to sync on top of this.
                                </p>
                            </div>
                            <div className="grid grid-cols-[auto_1fr_auto] sm:flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="h-9 rounded-xl border px-3 flex items-center justify-center text-xs font-black min-w-36">
                                    {formatMonth(calendarDate)}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {calendarRequestsLoading ? (
                            <div className="py-12 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading booking calendar...
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                        <div key={day} className="py-1">{day}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarDays.map((day) => (
                                        <button
                                            key={day.key}
                                            type="button"
                                            onClick={() => setSelectedCalendarDay(day.key)}
                                            className={`min-h-20 rounded-xl border p-1.5 text-left transition-colors ${day.inMonth ? 'bg-background' : 'bg-muted/30 text-muted-foreground'} ${day.isToday ? 'border-brand-500' : 'border-border'} ${day.requests.length ? 'hover:border-brand-400' : ''}`}
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${day.isToday ? 'bg-brand-600 text-white' : ''}`}>
                                                    {day.date.getDate()}
                                                </span>
                                                {day.requests.length > 0 && (
                                                    <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-black text-brand-700">
                                                        {day.requests.length}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 space-y-1">
                                                {day.requests.slice(0, 2).map((request) => (
                                                    <div key={request.id} className={`rounded-md px-1.5 py-1 text-[10px] font-bold leading-tight ${serviceRequestStatusClass(request.status)}`}>
                                                        <span className="block truncate">{formatTimeRange(request)}</span>
                                                        <span className="block truncate">{request.customer_name}</span>
                                                    </div>
                                                ))}
                                                {day.requests.length > 2 && (
                                                    <div className="text-[10px] font-black text-muted-foreground px-1">
                                                        +{day.requests.length - 2} more
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="rounded-2xl border bg-muted/20 p-3">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <h3 className="text-sm font-black">Upcoming bookings</h3>
                                        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={fetchCalendarRequests}>
                                            Refresh
                                        </Button>
                                    </div>
                                    {nextCalendarBookings.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No scheduled bookings in this month yet.</p>
                                    ) : (
                                        <div className="grid gap-2">
                                            {nextCalendarBookings.map((request) => (
                                                <button
                                                    type="button"
                                                    key={request.id}
                                                    onClick={() => openServiceRequest(request)}
                                                    className="rounded-xl border bg-white px-3 py-2 text-left hover:border-brand-300 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black truncate">{request.product?.title || 'Service booking'}</p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {new Date(request.scheduled_at).toLocaleDateString()} · {formatTimeRange(request)} · {request.customer_name}
                                                            </p>
                                                        </div>
                                                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${serviceRequestStatusClass(request.status)}`}>
                                                            {request.status}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {normalizedTypeScope === 'service' && serviceManagerView === 'availability' && canSchedule && (
                    <div className="rounded-2xl border bg-white p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div>
                                <h2 className="font-black flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-brand-600" /> Availability & Scheduling
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Google Calendar is {scheduling?.integration?.status || 'pending'}. These slots are already used by Takeer booking requests.
                                </p>
                                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                                    <p><span className="font-bold text-foreground">Slot</span> is how long each booking window is.</p>
                                    <p><span className="font-bold text-foreground">Buffer</span> is rest/travel time after each booking.</p>
                                    <p><span className="font-bold text-foreground">Limit</span> controls whether bookings are capped.</p>
                                    <p><span className="font-bold text-foreground">Capacity</span> is how many bookings can share one slot.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl min-h-10"
                                    onClick={saveDefaultScheduling}
                                    disabled={schedulingSaving}
                                >
                                    Weekdays
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl min-h-10"
                                    onClick={addAvailabilityRule}
                                    disabled={schedulingSaving}
                                >
                                    <Plus className="h-4 w-4 mr-1" /> Add
                                </Button>
                            </div>
                        </div>

                        <div className="mt-4 space-y-4">
                            <label className="block space-y-1.5">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Service</span>
                                <select
                                    className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                    value={availabilityProductId}
                                    onChange={(e) => setAvailabilityProductId(e.target.value)}
                                >
                                    <option value="">Default for services without their own schedule</option>
                                    {products.filter((product) => product.type === 'service').map((product) => (
                                        <option key={product.id} value={String(product.id)}>
                                            {product.title} - {product.service_scheduling_type === 'fixed_sessions' ? 'Fixed sessions' : product.service_scheduling_type === 'external' ? 'External booking' : product.service_scheduling_type === 'none' ? 'No scheduling' : 'Recurring appointments'}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {availabilityProductId && ['none', 'external'].includes(availabilityMode) && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    This service is set to {availabilityMode === 'external' ? 'external booking' : 'no scheduling'} in service setup. Change its scheduling style to edit Takeer availability here.
                                </div>
                            )}

                            {availabilityMode === 'fixed_sessions' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-black">Fixed sessions / events</p>
                                            <p className="text-xs text-muted-foreground">Use this for trainings, workshops, cohorts, webinars, or one-off service dates.</p>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" className="rounded-xl min-h-10" onClick={addServiceSession}>
                                            <Plus className="h-4 w-4 mr-1" /> Add session
                                        </Button>
                                    </div>

                                    {serviceSessions.length === 0 ? (
                                        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                                            No sessions yet. Add a date customers can book or register for.
                                        </div>
                                    ) : serviceSessions.map((session, index) => (
                                        <div key={session.local_id || index} className="rounded-2xl border p-3 space-y-3 bg-muted/10">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Session {index + 1}</p>
                                                <button type="button" onClick={() => removeServiceSession(index)} className="h-10 w-10 rounded-xl border bg-background text-muted-foreground hover:text-red-600" aria-label="Remove session">
                                                    <X className="h-4 w-4 mx-auto" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Title</span>
                                                    <input className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.title} onChange={(e) => updateServiceSession(index, { title: e.target.value })} placeholder="Saturday cohort, Webinar, Workshop" />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</span>
                                                    <select className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.status} onChange={(e) => updateServiceSession(index, { status: e.target.value })}>
                                                        <option value="open">Open</option>
                                                        <option value="draft">Draft</option>
                                                        <option value="full">Full</option>
                                                        <option value="closed">Closed</option>
                                                        <option value="cancelled">Cancelled</option>
                                                    </select>
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Starts</span>
                                                    <input type="datetime-local" className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.starts_at} onChange={(e) => updateServiceSession(index, { starts_at: e.target.value })} />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ends</span>
                                                    <input type="datetime-local" className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.ends_at} onChange={(e) => updateServiceSession(index, { ends_at: e.target.value })} />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Seats</span>
                                                    <input type="number" min="1" className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.capacity} onChange={(e) => updateServiceSession(index, { capacity: e.target.value })} placeholder="Blank = unlimited" />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Price override</span>
                                                    <input type="number" min="0" className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.price_override} onChange={(e) => updateServiceSession(index, { price_override: e.target.value })} placeholder="Optional" />
                                                </label>
                                                <label className="space-y-1.5 sm:col-span-2">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Location / online link</span>
                                                    <input className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.location_text} onChange={(e) => updateServiceSession(index, { location_text: e.target.value })} placeholder="Venue, Zoom link, Google Meet, or address" />
                                                </label>
                                                <label className="space-y-1.5 sm:col-span-2">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Registration deadline</span>
                                                    <input type="datetime-local" className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.registration_deadline} onChange={(e) => updateServiceSession(index, { registration_deadline: e.target.value })} />
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {availabilityMode !== 'fixed_sessions' && !['none', 'external'].includes(availabilityMode) && (
                            <div className="space-y-3">
                                {availabilityRules.map((rule, index) => {
                                    const day = weekdayOptions.find((option) => option.value === Number(rule.weekday));
                                    const invalidTime = rule.start_time >= rule.end_time;

                                    return (
                                        <div key={rule.local_id || index} className={`rounded-2xl border p-3 space-y-3 ${rule.is_active ? 'bg-muted/10' : 'bg-muted/40 opacity-75'}`}>
                                            <div className="flex items-center justify-between gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => updateAvailabilityRule(index, { is_active: !rule.is_active })}
                                                    className={`h-10 px-3 rounded-xl text-xs font-black uppercase tracking-widest ${rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}
                                                >
                                                    {rule.is_active ? 'Open' : 'Closed'}
                                                </button>
                                                <div className="min-w-0 flex-1 text-center">
                                                    <p className="text-sm font-black">{day?.label || 'Day'}</p>
                                                    <p className="text-xs text-muted-foreground">{rule.start_time} - {rule.end_time}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAvailabilityRule(index)}
                                                    className="h-10 w-10 rounded-xl border bg-background text-muted-foreground hover:text-red-600"
                                                    aria-label="Remove availability rule"
                                                >
                                                    <X className="h-4 w-4 mx-auto" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Day</span>
                                                    <select
                                                        className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                        value={rule.weekday}
                                                        onChange={(e) => updateAvailabilityRule(index, { weekday: Number(e.target.value) })}
                                                    >
                                                        {weekdayOptions.map((option) => (
                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Start</span>
                                                    <input
                                                        type="time"
                                                        className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                        value={rule.start_time}
                                                        onChange={(e) => updateAvailabilityRule(index, { start_time: e.target.value })}
                                                    />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">End</span>
                                                    <input
                                                        type="time"
                                                        className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                        value={rule.end_time}
                                                        onChange={(e) => updateAvailabilityRule(index, { end_time: e.target.value })}
                                                    />
                                                </label>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                <label className="space-y-1.5">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Slot</span>
                                                    <select
                                                        className="w-full h-11 rounded-xl border border-input bg-background px-2 text-sm font-semibold"
                                                        value={rule.slot_interval_minutes}
                                                        onChange={(e) => updateAvailabilityRule(index, { slot_interval_minutes: Number(e.target.value) })}
                                                    >
                                                        {[15, 30, 45, 60, 90, 120].map((minutes) => (
                                                            <option key={minutes} value={minutes}>{minutes}m</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Buffer</span>
                                                    <select
                                                        className="w-full h-11 rounded-xl border border-input bg-background px-2 text-sm font-semibold"
                                                        value={rule.buffer_minutes}
                                                        onChange={(e) => updateAvailabilityRule(index, { buffer_minutes: Number(e.target.value) })}
                                                    >
                                                        {[0, 5, 10, 15, 30, 60].map((minutes) => (
                                                            <option key={minutes} value={minutes}>{minutes}m</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Limit</span>
                                                    <select
                                                        className="w-full h-11 rounded-xl border border-input bg-background px-2 text-sm font-semibold"
                                                        value={rule.capacity_type || 'limited'}
                                                        onChange={(e) => updateAvailabilityRule(index, { capacity_type: e.target.value })}
                                                    >
                                                        <option value="limited">Limited</option>
                                                        <option value="unlimited">Unlimited</option>
                                                    </select>
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Capacity</span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="1000"
                                                        disabled={(rule.capacity_type || 'limited') === 'unlimited'}
                                                        className="w-full h-11 rounded-xl border border-input bg-background px-2 text-sm font-semibold"
                                                        value={rule.capacity}
                                                        onChange={(e) => updateAvailabilityRule(index, { capacity: Number(e.target.value || 1) })}
                                                    />
                                                </label>
                                            </div>

                                            {invalidTime && (
                                                <p className="text-xs font-semibold text-red-600">End time must be after start time.</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            )}

                            <div className="sticky bottom-3 z-10 rounded-2xl border bg-background/95 p-2 shadow-lg backdrop-blur sm:static sm:shadow-none sm:border-0 sm:bg-transparent sm:p-0">
                                <Button
                                    type="button"
                                    className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black"
                                    onClick={() => availabilityMode === 'fixed_sessions' ? saveServiceSessions() : saveScheduling()}
                                    disabled={schedulingSaving || (availabilityProductId && ['none', 'external'].includes(availabilityMode))}
                                >
                                    {schedulingSaving ? 'Saving availability...' : availabilityMode === 'fixed_sessions' ? 'Save Sessions' : 'Save Availability'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex bg-muted/50 p-1 rounded-xl w-fit">
                        {['all', 'published', 'draft'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filter === f
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {f === 'all' ? 'Zote' : f === 'published' ? 'Zilizopo' : 'Rasimu'}
                            </button>
                        ))}
                    </div>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Tafuta bidhaa..."
                            className="w-full pl-10 pr-4 h-11 bg-muted/30 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Product List */}
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-muted-foreground space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                        <p className="text-sm font-medium">Inapakia bidhaa...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="py-20 text-center bg-card/40 rounded-3xl border border-dashed border-border flex flex-col items-center">
                        <div className="p-4 bg-muted/50 rounded-full mb-4">
                            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold">Hakuna {pageMeta.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                            Hujampandisha bidhaa yoyote bado au utafutaji wako hauna matokeo.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                            {filteredProducts.map((product) => (
                                <Card
                                    key={product.id}
                                    className="overflow-hidden border-border/60 hover:border-brand-500/40 transition-colors group cursor-pointer"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => router.visit(productCardTarget(product))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            router.visit(productCardTarget(product));
                                        }
                                    }}
                                >
                                    <CardContent className="p-3 space-y-3">
                                        {/* Thumbnail */}
                                        <div className="aspect-[4/3] rounded-xl bg-muted overflow-hidden shrink-0 border border-border/10">
                                            {product.image_url ? (
                                                <img
                                                    src={product.image_url}
                                                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                                                    alt={product.title}
                                                />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center">
                                                    <Package className="h-6 w-6 text-muted-foreground/30" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="min-w-0">
                                            <div className="mb-1 flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {statusBadge(product.status)}
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                        {typeIcon(product.type)} {product.type}
                                                    </span>
                                                </div>
                                                {canDelete && (
                                                    <button
                                                        type="button"
                                                        className="h-8 w-8 shrink-0 rounded-xl border border-red-100 bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                        aria-label={product.status === 'draft' ? 'Futa draft' : 'Futa bidhaa'}
                                                        disabled={deletingProductId === product.id}
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            deleteProduct(product);
                                                        }}
                                                    >
                                                        {deletingProductId === product.id ? (
                                                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="mx-auto h-4 w-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                            <p className="font-bold text-sm line-clamp-2 text-left hover:text-brand-700">
                                                {product.title}
                                            </p>
                                            {product.status === 'draft' && (
                                                <p className="mt-1 text-[11px] font-semibold text-amber-700">
                                                    Endelea kuikamilisha kwenye upload editor.
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                                                <span className="font-black text-foreground">{priceLabel(product)}</span>
                                                {product.created_by?.label && (
                                                    <span>{product.created_by.label}</span>
                                                )}
                                                {product.type === 'physical' && (
                                                    <span className="flex items-center gap-1">
                                                        <Package className="h-3 w-3" /> {productStockLabel(product)}
                                                    </span>
                                                )}
                                                {product.type === 'service' && (
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" /> {serviceModeLabel(product)}
                                                    </span>
                                                )}
                                                {product.type === 'service' && (product.service_category || product.service_subcategory) && (
                                                    <span className="font-semibold">
                                                        {product.service_subcategory || product.service_category}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {!!product?.attributes?.category && (
                                                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                                        {product.attributes.category}
                                                    </span>
                                                )}
                                                {!!product?.attributes?.sub_category && (
                                                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                                        {product.attributes.sub_category}
                                                    </span>
                                                )}
                                                {(product.category_attribute_values || [])
                                                    .slice(0, 2)
                                                    .map((entry) => {
                                                        const label = entry?.attribute?.label || entry?.attribute?.key || 'Facet';
                                                        const value = facetValue(entry);
                                                        return (
                                                            <span key={`${product.id}-${entry.category_attribute_id}`} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-700">
                                                                {label}: {String(value)}
                                                            </span>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        {meta.last_page > 1 && (
                            <div className="flex items-center justify-center gap-3 pt-1">
                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                    disabled={meta.current_page <= 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Page {meta.current_page} / {meta.last_page}
                                </span>
                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setPage((prev) => Math.min(meta.last_page, prev + 1))}
                                    disabled={meta.current_page >= meta.last_page}
                                >
                                    Next <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        )}
                        <p className="text-center text-xs text-muted-foreground">
                            Inaonyesha page {meta.current_page} ya {meta.last_page} · jumla {meta.total} bidhaa
                        </p>
                    </div>
                )}

                {selectedCalendarDay && (
                    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                        <div className="w-full max-w-3xl rounded-2xl bg-background border shadow-2xl max-h-[90vh] overflow-y-auto">
                            <div className="p-5 border-b flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-brand-600">Day view</p>
                                    <h2 className="text-xl font-black mt-1">{selectedCalendarLabel}</h2>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {selectedCalendarRequests.length} booking{selectedCalendarRequests.length === 1 ? '' : 's'} scheduled on this date.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedCalendarDay(null)}
                                    className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-5 space-y-4">
                                {selectedCalendarGroups.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-8 text-center">
                                        <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground" />
                                        <p className="font-black mt-3">No bookings on this day</p>
                                        <p className="text-sm text-muted-foreground mt-1">Scheduled bookings will appear here once customers book or you confirm a time.</p>
                                    </div>
                                ) : (
                                    selectedCalendarGroups.map((group) => (
                                        <div key={group.key} className="rounded-2xl border bg-white p-3 space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-black">{group.productTitle}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{group.timeLabel}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-black text-brand-700 uppercase tracking-widest">
                                                        {group.requests.length} total
                                                    </span>
                                                    {Object.entries(group.statusCounts).map(([status, count]) => (
                                                        <span key={status} className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${serviceRequestStatusClass(status)}`}>
                                                            {count} {status}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid gap-2">
                                                {group.requests.map((request) => (
                                                    <button
                                                        key={request.id}
                                                        type="button"
                                                        onClick={() => openServiceRequest(request)}
                                                        className="rounded-xl border bg-muted/10 px-3 py-2 text-left hover:border-brand-300 transition-colors"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-black truncate">{request.customer_name}</p>
                                                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                                    {request.customer_phone || request.customer_email || 'No contact'} · {formatTimeRange(request)}
                                                                </p>
                                                            </div>
                                                            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${serviceRequestStatusClass(request.status)}`}>
                                                                {request.status}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {selectedServiceRequest && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                        <div className="w-full max-w-2xl rounded-2xl bg-background border shadow-2xl max-h-[90vh] overflow-y-auto">
                            <div className="p-5 border-b flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-amber-600">
                                        {serviceRequestTypeLabel(selectedServiceRequest.request_type)}
                                    </p>
                                    <h2 className="text-xl font-black mt-1">{selectedServiceRequest.product?.title || 'Service request'}</h2>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Sent {selectedServiceRequest.created_at ? new Date(selectedServiceRequest.created_at).toLocaleString() : ''}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedServiceRequest(null)}
                                    className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-5 space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-xl border bg-muted/20 p-3">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Customer</p>
                                        <p className="font-black mt-1">{selectedServiceRequest.customer_name}</p>
                                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                            {selectedServiceRequest.customer_phone && (
                                                <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {selectedServiceRequest.customer_phone}</p>
                                            )}
                                            {selectedServiceRequest.customer_email && (
                                                <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {selectedServiceRequest.customer_email}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border bg-muted/20 p-3">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Preference</p>
                                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                            {selectedServiceRequest.service_option?.name && (
                                                <p className="font-black text-foreground">{selectedServiceRequest.service_option.name}</p>
                                            )}
                                            {(selectedServiceRequest.preferred_date || selectedServiceRequest.preferred_time) && (
                                                <p className="flex items-center gap-2">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {selectedServiceRequest.preferred_date || 'Any date'} {selectedServiceRequest.preferred_time || ''}
                                                </p>
                                            )}
                                            {selectedServiceRequest.location_text && (
                                                <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {selectedServiceRequest.location_text}</p>
                                            )}
                                            {selectedServiceRequest.duration_minutes && (
                                                <p>{selectedServiceRequest.duration_minutes} min expected duration</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {selectedServiceRequest.message && (
                                    <div className="rounded-xl border bg-white p-3">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Message</p>
                                        <p className="text-sm mt-2 whitespace-pre-line">{selectedServiceRequest.message}</p>
                                    </div>
                                )}

                                {selectedServiceRequest.client_requirements && Object.keys(selectedServiceRequest.client_requirements).length > 0 && (
                                    <div className="rounded-xl border bg-white p-3">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Intake Details</p>
                                        <div className="mt-2 grid gap-2">
                                            {Object.entries(selectedServiceRequest.client_requirements).map(([key, value]) => {
                                                const field = (selectedServiceRequest.product?.service_intake_form || []).find((item) => String(item.id) === String(key));
                                                const label = field?.label || key.replaceAll('_', ' ');

                                                return (
                                                    <div key={key} className="rounded-lg bg-muted/30 p-2">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                                                        {Array.isArray(value) ? (
                                                            <div className="mt-1 grid gap-1">
                                                                {value.map((file, index) => {
                                                                    const attachmentUrl = file?.url
                                                                        ? `/merchant/${merchantUsername}/service-requests/${selectedServiceRequest.id}/attachments/${encodeURIComponent(key)}/${index}`
                                                                        : null;
                                                                    const fileLabel = file?.name || file?.address || `File ${index + 1}`;

                                                                    return attachmentUrl ? (
                                                                        <a
                                                                            key={`${file?.url || file?.name || index}`}
                                                                            href={attachmentUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline break-all"
                                                                        >
                                                                            {fileLabel}
                                                                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                                                        </a>
                                                                    ) : (
                                                                        <p key={`${file?.url || file?.name || index}`} className="text-sm font-semibold break-words">
                                                                            {fileLabel}
                                                                        </p>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm font-semibold mt-1 break-words">
                                                                {typeof value === 'boolean'
                                                                    ? (value ? 'Yes' : 'No')
                                                                    : typeof value === 'object' && value !== null
                                                                        ? (value.address || value.name || JSON.stringify(value))
                                                                        : String(value)}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {canUpdate && (
                                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 space-y-3">
                                    <p className="font-black">Manage Request</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</span>
                                            <select
                                                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                                value={requestAction.status}
                                                onChange={(e) => setRequestAction((prev) => ({ ...prev, status: e.target.value }))}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="contacted">Contacted</option>
                                                <option value="quoted">Quoted</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="completed">Completed</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                        </label>
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quote TZS</span>
                                            <input
                                                type="number"
                                                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                                value={requestAction.quoted_amount}
                                                onChange={(e) => setRequestAction((prev) => ({ ...prev, quoted_amount: e.target.value, status: e.target.value ? 'quoted' : prev.status }))}
                                                placeholder="Optional"
                                            />
                                        </label>
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Schedule</span>
                                            <input
                                                type="datetime-local"
                                                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                                value={requestAction.scheduled_at}
                                                onChange={(e) => setRequestAction((prev) => ({ ...prev, scheduled_at: e.target.value, status: e.target.value ? 'confirmed' : prev.status }))}
                                            />
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        <Button type="button" variant="outline" className="rounded-xl" disabled={requestUpdating} onClick={() => updateServiceRequest({ status: 'contacted' })}>
                                            Mark Contacted
                                        </Button>
                                        <Button type="button" variant="outline" className="rounded-xl" disabled={requestUpdating} onClick={() => updateServiceRequest({ status: 'quoted' })}>
                                            Save Quote
                                        </Button>
                                        <Button type="button" variant="outline" className="rounded-xl" disabled={requestUpdating} onClick={() => updateServiceRequest({ status: 'confirmed' })}>
                                            Confirm
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                            disabled={requestUpdating || !['held', 'paid'].includes(selectedServiceRequest.payment_status)}
                                            onClick={markServiceDelivered}
                                        >
                                            Delivered
                                        </Button>
                                        <Button type="button" className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white" disabled={requestUpdating} onClick={() => updateServiceRequest()}>
                                            {requestUpdating ? 'Saving...' : 'Save'}
                                        </Button>
                                    </div>

                                    {selectedServiceRequest.payment_status && (
                                        <div className="rounded-xl border bg-white p-3">
                                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">SafePay</p>
                                            <p className="text-sm font-semibold mt-1">
                                                Payment: {selectedServiceRequest.payment_status.replaceAll('_', ' ')}
                                                {selectedServiceRequest.delivery_status ? ` · Delivery: ${selectedServiceRequest.delivery_status.replaceAll('_', ' ')}` : ''}
                                            </p>
                                            {selectedServiceRequest.auto_confirm_after && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Auto-confirm window ends {new Date(selectedServiceRequest.auto_confirm_after).toLocaleString()} if no dispute is opened.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {selectedServiceRequest.scheduled_at && (
                                        <div className="rounded-xl border bg-white p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Calendar readiness</p>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {selectedServiceRequest.calendar_sync_status || 'pending'}{selectedServiceRequest.calendar_sync_error ? ` · ${selectedServiceRequest.calendar_sync_error}` : ''}
                                                </p>
                                            </div>
                                            <Button type="button" variant="outline" className="rounded-xl shrink-0" disabled={requestUpdating} onClick={prepareCalendarEvent}>
                                                <Calendar className="h-4 w-4 mr-1" /> Prepare Event
                                            </Button>
                                        </div>
                                    )}

                                    {selectedServiceRequest.payment_url && (
                                        <div className="space-y-3">
                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Payment link</p>
                                                    <p className="text-xs text-emerald-800 truncate mt-1">{selectedServiceRequest.payment_url}</p>
                                                </div>
                                                <Button type="button" variant="outline" className="rounded-xl shrink-0" onClick={() => copyPaymentLink(selectedServiceRequest.payment_url)}>
                                                    <Copy className="h-4 w-4 mr-1" /> Copy Link
                                                </Button>
                                            </div>

                                            <div className="rounded-xl border bg-white p-3 space-y-3">
                                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Notification outbox</p>
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            Prepare pending SMS, WhatsApp, and email payloads. Provider sending will connect here later.
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="rounded-xl"
                                                            disabled={notificationPreparing}
                                                            onClick={() => prepareServiceRequestNotifications(['sms', 'whatsapp'])}
                                                        >
                                                            <MessageSquare className="h-4 w-4 mr-1" /> SMS/WhatsApp
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="rounded-xl"
                                                            disabled={notificationPreparing}
                                                            onClick={() => prepareServiceRequestNotifications(['email'])}
                                                        >
                                                            <Mail className="h-4 w-4 mr-1" /> Email
                                                        </Button>
                                                    </div>
                                                </div>

                                                {selectedServiceRequest.notifications?.length > 0 && (
                                                    <div className="space-y-2">
                                                        {selectedServiceRequest.notifications.map((notification) => (
                                                            <div key={notification.id} className="rounded-xl border bg-muted/20 p-3">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                                            {notification.channel} · {notification.status}
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground truncate mt-1">
                                                                            {notification.recipient || notification.error_message || 'No recipient'}
                                                                        </p>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="rounded-xl shrink-0"
                                                                        onClick={() => copyPreparedMessage(notification.message)}
                                                                    >
                                                                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                                                                    </Button>
                                                                </div>
                                                                {notification.subject && (
                                                                    <p className="text-xs font-bold mt-2">{notification.subject}</p>
                                                                )}
                                                                <p className="text-sm mt-2 whitespace-pre-line">{notification.message}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </AppLayout>
    );
}
