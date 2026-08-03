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
    Phone, Mail, MapPin, X, Copy, CalendarDays, ListChecks, Settings2, ExternalLink, Trash2, BedDouble, Users, Map
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { productPriceLabel, productStockLabel } from '@/lib/productUnits';
import { useMerchantPermissions } from '@/lib/merchantPermissions';
import { useLocale } from '@/lib/i18n';

export default function MerchantProducts({ merchantUsername, typeScope = 'all', moduleScope = null, merchantTimezone = 'Africa/Dar_es_Salaam' }) {
    const { copy } = useLocale();
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
    const [fulfillmentAction, setFulfillmentAction] = useState({ action: 'confirm', fulfillment_status: '', notes: '', fields: {} });
    const [requestUpdating, setRequestUpdating] = useState(false);
    const [fulfillmentUpdating, setFulfillmentUpdating] = useState(false);
    const [notificationPreparing, setNotificationPreparing] = useState(false);
    const [scheduling, setScheduling] = useState(null);
    const [schedulingSaving, setSchedulingSaving] = useState(false);
    const [availabilityRules, setAvailabilityRules] = useState([]);
    const [availabilityTimezone, setAvailabilityTimezone] = useState(merchantTimezone);
    const [availabilityProductId, setAvailabilityProductId] = useState('');
    const [serviceSessions, setServiceSessions] = useState([]);
    const [deletingProductId, setDeletingProductId] = useState(null);
    const normalizedTypeScope = ['physical', 'digital', 'service'].includes(typeScope) ? typeScope : 'all';
    const normalizedModuleScope = ['menu', 'rooms', 'tour_departures', 'custom_orders', 'appointments', 'reservations', 'rentals', 'workshops', 'forwarders'].includes(moduleScope) ? moduleScope : null;
    const { can, canAny } = useMerchantPermissions(merchantUsername);
    const resourceForScope = normalizedTypeScope === 'digital'
        ? 'digital_products'
        : (normalizedTypeScope === 'service' ? 'services' : 'products');
    const canCreate = canAny([`${resourceForScope}.create`, 'products.create', 'digital_products.create', 'services.create']);
    const canUpdate = canAny([`${resourceForScope}.update`, 'products.update', 'digital_products.update', 'services.update']);
    const canDelete = canAny([`${resourceForScope}.delete`, 'products.delete', 'digital_products.delete', 'services.delete']);
    const canSchedule = can('services.schedule');
    const weekdayOptions = [
        { value: 1, short: copy('Mon', 'Jt'), label: copy('Monday', 'Jumatatu') },
        { value: 2, short: copy('Tue', 'Jnn'), label: copy('Tuesday', 'Jumanne') },
        { value: 3, short: copy('Wed', 'Jtn'), label: copy('Wednesday', 'Jumatano') },
        { value: 4, short: copy('Thu', 'Alh'), label: copy('Thursday', 'Alhamisi') },
        { value: 5, short: copy('Fri', 'Iju'), label: copy('Friday', 'Ijumaa') },
        { value: 6, short: copy('Sat', 'Jmo'), label: copy('Saturday', 'Jumamosi') },
        { value: 7, short: copy('Sun', 'Jpi'), label: copy('Sunday', 'Jumapili') },
    ];
    const selectedAvailabilityProduct = products.find((product) => String(product.id) === String(availabilityProductId));
    const availabilityMode = selectedAvailabilityProduct?.service_scheduling_type || 'recurring';

    useEffect(() => {
        fetchProducts();
    }, [filter, page, merchantUsername, normalizedTypeScope, normalizedModuleScope]);

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
    }, [filter, normalizedTypeScope, normalizedModuleScope]);

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
            if (normalizedModuleScope) params.set('module', normalizedModuleScope);
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
                ? copy('Delete this draft permanently?', 'Unataka kufuta draft hii kabisa?')
                : copy('Delete this product? A product with orders cannot be deleted.', 'Unataka kufuta bidhaa hii? Bidhaa yenye oda haiwezi kufutwa.')
        );
        if (!confirmed) return;

        setDeletingProductId(product.id);
        try {
            const response = await axios.delete(`/merchant/${merchantUsername}/products/${product.id}`);
            toast.success(response.data?.message || copy('Product removed.', 'Bidhaa imeondolewa.'));
            setProducts((prev) => prev.filter((item) => item.id !== product.id));
            setMeta((prev) => ({ ...prev, total: Math.max(0, Number(prev.total || 0) - 1) }));
            if (products.length === 1 && page > 1) {
                setPage((prev) => Math.max(1, prev - 1));
            } else {
                fetchProducts();
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Unable to delete product.', 'Imeshindwa kufuta bidhaa.'));
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
                toast.error(copy('Add at least one valid availability rule.', 'Ongeza angalau kanuni moja sahihi ya upatikanaji.'));
                return;
            }

            const response = await axios.put(`/merchant/${merchantUsername}/service-scheduling/api`, {
                product_id: availabilityProductId ? Number(availabilityProductId) : null,
                timezone: availabilityTimezone,
                rules: cleanedRules,
            });
                toast.success(response.data?.message || copy('Scheduling settings saved.', 'Mipangilio ya ratiba imehifadhiwa.'));
            applySchedulingResponse(response.data || null);
        } catch (error) {
                toast.error(error?.response?.data?.message || copy('Failed to save scheduling settings.', 'Imeshindikana kuhifadhi mipangilio ya ratiba.'));
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
                toast.error(copy('Add at least one session with a start date.', 'Ongeza angalau session moja yenye tarehe ya kuanza.'));
                return;
            }

            const response = await axios.put(`/merchant/${merchantUsername}/service-sessions/api`, {
                product_id: Number(availabilityProductId),
                sessions,
            });
                toast.success(response.data?.message || copy('Service sessions saved.', 'Sessions za huduma zimehifadhiwa.'));
            setServiceSessions(normalizeSessions(response.data?.sessions || []));
        } catch (error) {
                toast.error(error?.response?.data?.message || copy('Failed to save sessions.', 'Imeshindikana kuhifadhi sessions.'));
        } finally {
            setSchedulingSaving(false);
        }
    };

    const openServiceRequest = (request) => {
        const moduleKey = request.product?.module_key || request.metadata?.module_key;
        const config = moduleFulfillmentConfig(moduleKey);
        const existingFulfillment = request.module_fulfillment || request.metadata?.module_fulfillment || {};
        const modulePayload = request.metadata?.module_payload || request.client_requirements?.module_payload || {};
        const defaultFields = {
            guests: modulePayload.tour_guests || modulePayload.appointment_spots || modulePayload.stay_guests || '',
            party_size: modulePayload.reservation_party_size || '',
            attendee_count: modulePayload.workshop_seats || '',
        };

        setSelectedServiceRequest(request);
        setRequestAction({
            status: request.status === 'pending' ? 'contacted' : request.status,
            quoted_amount: request.quoted_amount ?? '',
            scheduled_at: request.scheduled_at ? request.scheduled_at.slice(0, 16) : '',
        });
        setFulfillmentAction({
            action: existingFulfillment.action || 'confirm',
            fulfillment_status: existingFulfillment.status || config?.statuses?.[0] || '',
            notes: existingFulfillment.notes || '',
            fields: {
                ...defaultFields,
                ...(existingFulfillment.fields || {}),
            },
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
            toast.success(response.data?.message || copy('Request updated.', 'Ombi limesasishwa.'));
            setSelectedServiceRequest(response.data?.data || null);
            await fetchServiceRequests();
            await fetchCalendarRequests();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Failed to update service request.', 'Imeshindwa kusasisha ombi la huduma.'));
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
            toast.success(response.data?.message || copy('Service marked delivered.', 'Huduma imewekwa kuwa imewasilishwa.'));
            setSelectedServiceRequest(response.data?.data || selectedServiceRequest);
            await fetchServiceRequests();
            await fetchCalendarRequests();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Failed to mark service delivered.', 'Imeshindwa kuweka huduma kuwa imewasilishwa.'));
        } finally {
            setRequestUpdating(false);
        }
    };

    const updateFulfillmentField = (key, value) => {
        setFulfillmentAction((prev) => ({
            ...prev,
            fields: {
                ...(prev.fields || {}),
                [key]: value,
            },
        }));
    };

    const saveModuleFulfillment = async (overrides = {}) => {
        if (!selectedServiceRequest || fulfillmentUpdating) return;
        setFulfillmentUpdating(true);
        try {
            const response = await axios.patch(
                `/merchant/${merchantUsername}/service-requests/${selectedServiceRequest.id}/fulfillment`,
                {
                    action: overrides.action || fulfillmentAction.action || 'update',
                    fulfillment_status: overrides.fulfillment_status || fulfillmentAction.fulfillment_status || null,
                    notes: fulfillmentAction.notes || null,
                    fields: fulfillmentAction.fields || {},
                }
            );
            toast.success(response.data?.message || copy('Fulfillment updated.', 'Utimizaji wa order umesasishwa.'));
            setSelectedServiceRequest(response.data?.data || selectedServiceRequest);
            await fetchServiceRequests();
            await fetchCalendarRequests();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Failed to update fulfillment.', 'Imeshindwa kusasisha utimizaji wa order.'));
        } finally {
            setFulfillmentUpdating(false);
        }
    };

    const copyPaymentLink = async (url) => {
        try {
            await navigator.clipboard.writeText(url);
            toast.success(copy('Payment link copied.', 'Payment link imenakiliwa.'));
        } catch (error) {
            toast.error(copy('Could not copy payment link.', 'Imeshindwa kunakili payment link.'));
        }
    };

    const copyPreparedMessage = async (message) => {
        try {
            await navigator.clipboard.writeText(message);
            toast.success(copy('Message copied.', 'Ujumbe umenakiliwa.'));
        } catch (error) {
            toast.error(copy('Could not copy message.', 'Imeshindwa kunakili ujumbe.'));
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
            toast.success(response.data?.message || copy('Notification payloads are ready.', 'Taarifa za notification ziko tayari.'));
            setSelectedServiceRequest(response.data?.service_request || selectedServiceRequest);
            await fetchServiceRequests();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Failed to prepare notifications.', 'Imeshindwa kuandaa notifications.'));
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
            toast.success(response.data?.message || copy('Calendar event payload is ready.', 'Taarifa za tukio la kalenda ziko tayari.'));
            setSelectedServiceRequest(response.data?.data || selectedServiceRequest);
            await fetchServiceRequests();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Failed to prepare calendar event.', 'Imeshindwa kuandaa tukio la kalenda.'));
        } finally {
            setRequestUpdating(false);
        }
    };

    const statusBadge = (status) => {
        switch (status) {
            case 'published':
                return <span className="flex items-center gap-1 text-[10px] font-bold bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" /> {copy('PUBLISHED', 'IMEWEKWA')}</span>;
            case 'draft':
                return <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full"><Clock className="h-3 w-3" /> {copy('DRAFT', 'RASIMU')}</span>;
            case 'archived':
                return <span className="flex items-center gap-1 text-[10px] font-bold bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full"><Archive className="h-3 w-3" /> {copy('ARCHIVED', 'IMEZUIWA')}</span>;
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
        showcase_only: copy('Showcase', 'Onyesha tu'),
        request_quote: copy('Request quote', 'Omba bei'),
        book_appointment: product.service_scheduling_type === 'fixed_sessions' ? copy('Fixed sessions', 'Vipindi maalum') : copy('Appointment', 'Miadi'),
        pay_now: copy('Pay / reserve', 'Lipa / hifadhi'),
        external_booking: copy('External link', 'Link ya nje'),
    }[product.service_mode] || copy('Service', 'Huduma'));
    const priceLabel = (product) => {
        if (product.type !== 'service') return productPriceLabel(product);
        if (product.service_price_display === 'hidden') return copy('No public price', 'Hakuna bei ya umma');
        if (product.service_price_display === 'quote_only' || product.service_mode === 'request_quote') return copy('Quote only', 'Bei kwa makubaliano');
        if (product.service_price_display === 'starts_from') return `${copy('From', 'Kuanzia')} TZS ${parseFloat(product.price).toLocaleString()}`;
        const units = {
            hourly: ['per hour', 'kwa saa'], daily: ['per day', 'kwa siku'], nightly: ['per night', 'kwa usiku'],
            weekly: ['per week', 'kwa wiki'], monthly: ['per month', 'kwa mwezi'], yearly: ['per year', 'kwa mwaka'],
            per_person: ['per person', 'kwa mtu'], per_visit: ['per visit', 'kwa ziara'], per_session: ['per session', 'kwa kikao'],
            per_project: ['per project', 'kwa mradi'], package: ['package', 'kifurushi'],
        };
        if (units[product.service_price_display]) {
            const [english, swahili] = units[product.service_price_display];
            return `TZS ${parseFloat(product.price).toLocaleString()} ${copy(english, swahili)}`;
        }
        return `TZS ${parseFloat(product.price).toLocaleString()}`;
    };
    const serviceRequestTypeLabel = (type) => ({
        quote_request: copy('Quote request', 'Ombi la bei'),
        appointment_request: copy('Appointment', 'Miadi'),
        room_booking_request: copy('Room booking', 'Uhifadhi wa chumba'),
        tour_booking_request: copy('Tour booking', 'Uhifadhi wa ziara'),
        workshop_enrollment_request: copy('Workshop enrollment', 'Usajili wa warsha'),
        reservation_request: copy('Reservation', 'Uhifadhi'),
        rental_request: copy('Rental', 'Ukodishaji'),
        custom_order_request: copy('Custom order', 'Oda maalum'),
        contact_request: copy('Contact', 'Mawasiliano'),
    }[type] || copy('Request', 'Ombi'));
    const moduleFulfillmentConfig = (moduleKey) => {
        const config = ({
        rooms: {
            title: 'Stay fulfillment',
            hint: 'Assign room, track check-in, check-out, and no-show handling.',
            statuses: ['reserved', 'checked_in', 'checked_out', 'no_show', 'cancelled'],
            fields: [
                { key: 'room_number', label: 'Room number' },
                { key: 'unit_label', label: 'Unit / floor' },
                { key: 'guests', label: 'Guests', type: 'number' },
                { key: 'check_in_at', label: 'Check-in', type: 'datetime-local' },
                { key: 'check_out_at', label: 'Check-out', type: 'datetime-local' },
            ],
        },
        tour_departures: {
            title: 'Tour fulfillment',
            hint: 'Track manifest, pickup, departure, guide assignment, and completion.',
            statuses: ['reserved', 'checked_in', 'departed', 'completed', 'cancelled'],
            fields: [
                { key: 'guests', label: 'Guests', type: 'number' },
                { key: 'pickup_point', label: 'Pickup point' },
                { key: 'departure_at', label: 'Departure', type: 'datetime-local' },
                { key: 'guide_name', label: 'Guide' },
            ],
        },
        workshops: {
            title: 'Enrollment fulfillment',
            hint: 'Confirm seats, attendance, and certificate readiness.',
            statuses: ['enrolled', 'attended', 'completed', 'no_show', 'cancelled'],
            fields: [
                { key: 'attendee_count', label: 'Attendees', type: 'number' },
                { key: 'session_title', label: 'Session / cohort' },
                { key: 'certificate_status', label: 'Certificate' },
            ],
        },
        appointments: {
            title: 'Appointment fulfillment',
            hint: 'Track check-in, practitioner assignment, and completion.',
            statuses: ['confirmed', 'checked_in', 'completed', 'no_show', 'cancelled'],
            fields: [
                { key: 'practitioner', label: 'Practitioner' },
                { key: 'appointment_room', label: 'Room / desk' },
                { key: 'guests', label: 'People', type: 'number' },
            ],
        },
        reservations: {
            title: 'Reservation fulfillment',
            hint: 'Assign table or space and track arrival through completion.',
            statuses: ['confirmed', 'seated', 'completed', 'no_show', 'cancelled'],
            fields: [
                { key: 'table_label', label: 'Table / space' },
                { key: 'party_size', label: 'Party size', type: 'number' },
            ],
        },
        rentals: {
            title: 'Rental fulfillment',
            hint: 'Assign unit, capture pickup, return due date, and deposit state.',
            statuses: ['reserved', 'picked_up', 'returned', 'overdue', 'cancelled'],
            fields: [
                { key: 'unit_label', label: 'Unit / asset' },
                { key: 'pickup_at', label: 'Pickup', type: 'datetime-local' },
                { key: 'return_due_at', label: 'Return due', type: 'datetime-local' },
                { key: 'deposit_status', label: 'Deposit' },
            ],
        },
        custom_orders: {
            title: 'Custom order fulfillment',
            hint: 'Move the job through production, ready, delivery, or cancellation.',
            statuses: ['accepted', 'in_production', 'ready', 'delivered', 'cancelled'],
            fields: [
                { key: 'reference_code', label: 'Job reference' },
                { key: 'due_at', label: 'Due date', type: 'datetime-local' },
            ],
        },
        }[moduleKey] || null);
        if (!config) return null;
        const labels = {
            'Stay fulfillment': 'Utimilishaji wa malazi',
            'Tour fulfillment': 'Utimilishaji wa ziara',
            'Enrollment fulfillment': 'Utimilishaji wa usajili',
            'Appointment fulfillment': 'Utimilishaji wa miadi',
            'Reservation fulfillment': 'Utimilishaji wa uhifadhi',
            'Rental fulfillment': 'Utimilishaji wa ukodishaji',
            'Custom order fulfillment': 'Utimilishaji wa oda maalum',
            'Assign room, track check-in, check-out, and no-show handling.': 'Weka chumba, fuatilia check-in, check-out na mteja asiyetokea.',
            'Track manifest, pickup, departure, guide assignment, and completion.': 'Fuatilia orodha, pickup, kuondoka, mwongozo na kukamilika.',
            'Confirm seats, attendance, and certificate readiness.': 'Thibitisha nafasi, mahudhurio na utayari wa cheti.',
            'Track check-in, practitioner assignment, and completion.': 'Fuatilia check-in, mtaalamu na kukamilika.',
            'Assign table or space and track arrival through completion.': 'Weka meza au nafasi na fuatilia kuwasili hadi kukamilika.',
            'Assign unit, capture pickup, return due date, and deposit state.': 'Weka kitengo, rekodi pickup, tarehe ya kurudisha na hali ya amana.',
            'Move the job through production, ready, delivery, or cancellation.': 'Sogeza kazi kwenye uzalishaji, utayari, delivery au kughairi.',
            'Room number': 'Namba ya chumba', 'Unit / floor': 'Kitengo / ghorofa', Guests: 'Wageni', 'Check-in': 'Kuingia', 'Check-out': 'Kutoka',
            'Pickup point': 'Eneo la pickup', Departure: 'Kuondoka', Guide: 'Mwongoza ziara', Attendees: 'Washiriki', 'Session / cohort': 'Kipindi / kundi', Certificate: 'Cheti',
            Practitioner: 'Mtaalamu', 'Room / desk': 'Chumba / dawati', People: 'Watu', 'Table / space': 'Meza / nafasi', 'Party size': 'Idadi ya kundi',
            'Unit / asset': 'Kitengo / mali', Pickup: 'Pickup', 'Return due': 'Tarehe ya kurudisha', Deposit: 'Amana', 'Job reference': 'Rejea ya kazi', 'Due date': 'Tarehe ya mwisho',
        };
        const translateLabel = (value) => copy(value, labels[value] || value);
        return {
            ...config,
            title: translateLabel(config.title),
            hint: translateLabel(config.hint),
            fields: config.fields.map((field) => ({ ...field, label: translateLabel(field.label) })),
        };
    };
    const formatFulfillmentValue = (value) => {
        if (!value) return '';
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
        }
        return String(value).replaceAll('_', ' ');
    };
    const formatDateTimeInput = (value) => {
        if (!value) return '';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '';
        const offset = parsed.getTimezoneOffset();
        return new Date(parsed.getTime() - offset * 60000).toISOString().slice(0, 16);
    };
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
        if (!request.scheduled_at) return copy('Unscheduled', 'Bila ratiba');
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
        { key: 'inbox', label: copy('Inbox', 'Kikasha'), icon: ListChecks },
        { key: 'calendar', label: copy('Calendar', 'Kalenda'), icon: CalendarDays },
        { key: 'availability', label: copy('Availability', 'Upatikanaji'), icon: Settings2 },
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
                subtitle: copy('Manage digital files and download links.', 'Simamia faili za kidigitali na link za kupakua.'),
                createLabel: copy('Add download', 'Ongeza download'),
                createType: 'digital',
                icon: FileText,
            };
        }
        if (normalizedTypeScope === 'service') {
            if (normalizedModuleScope === 'rooms') {
                return {
                    title: 'Rooms & Stays',
                    subtitle: copy('Manage room types, nightly pricing, capacity, availability, and booking readiness.', 'Simamia aina za vyumba, bei za usiku, uwezo, upatikanaji na utayari wa booking.'),
                    createLabel: copy('Add room / stay', 'Ongeza chumba / kukaa'),
                    createType: 'service',
                    createModule: 'rooms',
                    icon: BedDouble,
                };
            }
            if (normalizedModuleScope === 'tour_departures') {
                return {
                    title: 'Tours & Departures',
                    subtitle: copy('Manage itineraries, destinations, pickup points, seats, and tour booking readiness.', 'Simamia ratiba, destinations, pickup points, viti na utayari wa booking za tour.'),
                    createLabel: copy('Add tour', 'Ongeza tour'),
                    createType: 'service',
                    createModule: 'tour_departures',
                    icon: Map,
                };
            }
            if (normalizedModuleScope === 'custom_orders') {
                return {
                    title: 'Custom Orders & Quotes',
                    subtitle: copy('Manage made-to-order services, customer requirements, quote-first pricing, and fulfillment notes.', 'Simamia huduma za oda maalum, mahitaji ya wateja, bei za quote na maelezo ya utimizaji.'),
                    createLabel: copy('Add custom order', 'Ongeza oda maalum'),
                    createType: 'service',
                    createModule: 'custom_orders',
                    icon: MessageSquare,
                };
            }
            if (normalizedModuleScope === 'appointments') {
                return {
                    title: 'Appointments',
                    subtitle: copy('Manage appointment services, slot duration, booking policy, capacity, and availability.', 'Simamia huduma za appointment, muda wa slot, sera ya booking, uwezo na upatikanaji.'),
                    createLabel: copy('Add appointment', 'Ongeza appointment'),
                    createType: 'service',
                    createModule: 'appointments',
                    icon: Calendar,
                };
            }
            if (normalizedModuleScope === 'reservations') {
                return {
                    title: 'Reservations',
                    subtitle: copy('Manage table, venue, visit, activity, and space reservation offers.', 'Simamia offers za reservation za meza, venue, ziara, shughuli na maeneo.'),
                    createLabel: copy('Add reservation', 'Ongeza reservation'),
                    createType: 'service',
                    createModule: 'reservations',
                    icon: CalendarDays,
                };
            }
            if (normalizedModuleScope === 'rentals') {
                return {
                    title: 'Rentals & Hire',
                    subtitle: copy('Manage rentable equipment, vehicles, event gear, spaces, deposits, and pickup/return terms.', 'Simamia vifaa, magari, vifaa vya matukio, maeneo, deposits na masharti ya pickup/return.'),
                    createLabel: copy('Add rental', 'Ongeza rental'),
                    createType: 'service',
                    createModule: 'rentals',
                    icon: Package,
                };
            }
            if (normalizedModuleScope === 'workshops') {
                return {
                    title: 'Workshops & Sessions',
                    subtitle: copy('Manage short courses, seminars, webinars, bootcamps, capacity, and session enrollment.', 'Simamia kozi fupi, semina, webinars, bootcamps, uwezo na usajili wa session.'),
                    createLabel: copy('Add workshop', 'Ongeza workshop'),
                    createType: 'service',
                    createModule: 'workshops',
                    icon: CalendarDays,
                };
            }

            return {
                title: 'Services & Bookings',
                subtitle: copy('Manage services, contact details, and booking links.', 'Simamia huduma, namba za mawasiliano na booking links.'),
                createLabel: copy('Add service', 'Ongeza huduma'),
                createType: 'service',
                icon: Calendar,
            };
        }
        if (normalizedTypeScope === 'physical') {
            if (normalizedModuleScope === 'menu') {
                return {
                    title: 'Menu',
                    subtitle: copy('Manage food, drinks, add-ons, and menu pricing for this business.', 'Simamia chakula, vinywaji, add-ons na bei za menu kwa biashara hii.'),
                    createLabel: copy('Add menu item', 'Ongeza item ya menu'),
                    createType: 'physical',
                    createModule: 'menu',
                    icon: ShoppingBag,
                };
            }

            return {
                title: 'Physical Products',
                subtitle: copy('Manage stock products and delivery sales.', 'Simamia bidhaa za stoo na mauzo ya usafirishaji.'),
                createLabel: copy('Add product', 'Ongeza bidhaa'),
                createType: 'physical',
                icon: ShoppingBag,
            };
        }
        return {
            title: copy('My Products', 'Bidhaa zangu'),
            subtitle: copy('Manage inventory and details for all your products.', 'Simamia hesabu na maelezo ya bidhaa zako zote.'),
            createLabel: copy('Add product', 'Ongeza bidhaa'),
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
                            onClick={() => {
                                const params = new URLSearchParams();
                                if (pageMeta.createType) params.set('type', pageMeta.createType);
                                if (pageMeta.createModule) params.set('module', pageMeta.createModule);
                                router.visit(`/merchant/${merchantUsername}/upload${params.toString() ? `?${params.toString()}` : ''}`);
                            }}
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
                                    <MessageSquare className="h-4 w-4 text-amber-600" /> {copy('Service request inbox', 'Kikasha cha maombi ya huduma')}
                                </h2>
                                <p className="text-xs text-amber-800/80 mt-0.5">{copy('Quote, appointment, and contact requests from buyers.', 'Maombi ya quote, appointment na mawasiliano kutoka kwa wanunuzi.')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    className="h-9 rounded-xl border border-amber-200 bg-white px-3 text-xs font-bold"
                                    value={serviceRequestStatus}
                                    onChange={(e) => setServiceRequestStatus(e.target.value)}
                                >
                                    <option value="pending">{copy('Pending', 'Inasubiri')}</option>
                                    <option value="contacted">{copy('Contacted', 'Amefikiwa')}</option>
                                    <option value="quoted">{copy('Quoted', 'Amepewa bei')}</option>
                                    <option value="confirmed">{copy('Confirmed', 'Imethibitishwa')}</option>
                                    <option value="completed">{copy('Completed', 'Imekamilika')}</option>
                                    <option value="cancelled">{copy('Cancelled', 'Imeghairiwa')}</option>
                                    <option value="all">{copy('All', 'Zote')}</option>
                                </select>
                                <Button variant="outline" size="sm" className="rounded-xl" onClick={fetchServiceRequests}>
                                    {copy('Refresh', 'Onyesha upya')}
                                </Button>
                            </div>
                        </div>

                        {serviceRequestsLoading ? (
                            <p className="text-sm font-semibold text-amber-800">{copy('Loading requests...', 'Inapakia maombi...')}</p>
                        ) : serviceRequests.length === 0 ? (
                            <p className="text-sm font-semibold text-amber-800">{copy('No pending service requests yet.', 'Hakuna maombi ya huduma yanayosubiri bado.')}</p>
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
                                            <p className="text-sm font-black truncate">{request.product?.title || copy('Service request', 'Ombi la huduma')}</p>
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
                                    <CalendarDays className="h-4 w-4 text-brand-600" /> {copy('Takeer Booking Calendar', 'Kalenda ya booking ya Takeer')}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {copy('Confirmed or scheduled Takeer bookings for this month. Connect', 'Booking za Takeer zilizothibitishwa au zilizopangwa kwa mwezi huu. Unganisha')} <Link href="/merchant/settings" className="font-bold text-brand-600">Google Calendar</Link> {copy('to sync on top of this.', 'ili kusawazisha ratiba zaidi.')}
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
                                <Loader2 className="h-4 w-4 animate-spin" /> {copy('Loading booking calendar...', 'Inapakia kalenda ya booking...')}
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
                                                        +{day.requests.length - 2} {copy('more', 'zaidi')}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="rounded-2xl border bg-muted/20 p-3">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <h3 className="text-sm font-black">{copy('Upcoming bookings', 'Booking zijazo')}</h3>
                                        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={fetchCalendarRequests}>
                                            Refresh
                                        </Button>
                                    </div>
                                    {nextCalendarBookings.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">{copy('No scheduled bookings in this month yet.', 'Hakuna booking zilizopangwa mwezi huu bado.')}</p>
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
                                                            <p className="text-sm font-black truncate">{request.product?.title || copy('Service booking', 'Booking ya huduma')}</p>
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
                                    <Calendar className="h-4 w-4 text-brand-600" /> {copy('Availability & scheduling', 'Upatikanaji na ratiba')}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {copy('Google Calendar is', 'Google Calendar iko')} {scheduling?.integration?.status || copy('pending', 'inasubiri')}. {copy('These slots are already used by Takeer booking requests.', 'Nafasi hizi tayari zinatumika na maombi ya booking ya Takeer.')}
                                </p>
                                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                                    <p><span className="font-bold text-foreground">{copy('Slot', 'Nafasi')}</span> {copy('is how long each booking window is.', 'ni muda wa kila dirisha la booking.')}</p>
                                    <p><span className="font-bold text-foreground">{copy('Buffer', 'Muda wa mapumziko')}</span> {copy('is rest/travel time after each booking.', 'ni muda wa mapumziko/safari baada ya booking.')}</p>
                                    <p><span className="font-bold text-foreground">{copy('Limit', 'Kikomo')}</span> {copy('controls whether bookings are capped.', 'hudhibiti kama booking zina kikomo.')}</p>
                                    <p><span className="font-bold text-foreground">{copy('Capacity', 'Uwezo')}</span> {copy('is how many bookings can share one slot.', 'ni idadi ya booking zinazoweza kutumia nafasi moja.')}</p>
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
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Service', 'Huduma')}</span>
                                <select
                                    className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                    value={availabilityProductId}
                                    onChange={(e) => setAvailabilityProductId(e.target.value)}
                                >
                                    <option value="">{copy('Default for services without their own schedule', 'Msingi kwa huduma zisizo na ratiba yao')}</option>
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
                                        <p className="text-sm font-black">{copy('Fixed sessions / events', 'Vipindi / matukio maalum')}</p>
                                        <p className="text-xs text-muted-foreground">{copy('Use this for trainings, workshops, cohorts, webinars, or one-off service dates.', 'Tumia hii kwa mafunzo, workshops, cohorts, webinars au tarehe za huduma za mara moja.')}</p>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" className="rounded-xl min-h-10" onClick={addServiceSession}>
                                            <Plus className="h-4 w-4 mr-1" /> {copy('Add session', 'Ongeza kipindi')}
                                        </Button>
                                    </div>

                                    {serviceSessions.length === 0 ? (
                                        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                                            No sessions yet. Add a date customers can book or register for.
                                        </div>
                                    ) : serviceSessions.map((session, index) => (
                                        <div key={session.local_id || index} className="rounded-2xl border p-3 space-y-3 bg-muted/10">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{copy('Session', 'Kipindi')} {index + 1}</p>
                                                <button type="button" onClick={() => removeServiceSession(index)} className="h-10 w-10 rounded-xl border bg-background text-muted-foreground hover:text-red-600" aria-label={copy('Remove session', 'Ondoa kipindi')}>
                                                    <X className="h-4 w-4 mx-auto" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Title', 'Kichwa')}</span>
                                                    <input className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.title} onChange={(e) => updateServiceSession(index, { title: e.target.value })} placeholder={copy('Saturday cohort, Webinar, Workshop', 'Kundi la Jumamosi, Webinar, Warsha')} />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Status', 'Hali')}</span>
                                                    <select className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.status} onChange={(e) => updateServiceSession(index, { status: e.target.value })}>
                                                        <option value="open">{copy('Open', 'Wazi')}</option>
                                                        <option value="draft">{copy('Draft', 'Draft')}</option>
                                                        <option value="full">{copy('Full', 'Imejaa')}</option>
                                                        <option value="closed">{copy('Closed', 'Imefungwa')}</option>
                                                        <option value="cancelled">{copy('Cancelled', 'Imeghairiwa')}</option>
                                                    </select>
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Starts', 'Inaanza')}</span>
                                                    <input type="datetime-local" className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.starts_at} onChange={(e) => updateServiceSession(index, { starts_at: e.target.value })} />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Ends', 'Inaisha')}</span>
                                                    <input type="datetime-local" className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.ends_at} onChange={(e) => updateServiceSession(index, { ends_at: e.target.value })} />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Seats', 'Viti')}</span>
                                                    <input type="number" min="1" className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.capacity} onChange={(e) => updateServiceSession(index, { capacity: e.target.value })} placeholder={copy('Blank = unlimited', 'Acha wazi = bila kikomo')} />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Price override', 'Badilisha bei')}</span>
                                                    <input type="number" min="0" className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.price_override} onChange={(e) => updateServiceSession(index, { price_override: e.target.value })} placeholder={copy('Optional', 'Si lazima')} />
                                                </label>
                                                <label className="space-y-1.5 sm:col-span-2">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Location / online link', 'Mahali / kiungo cha mtandaoni')}</span>
                                                    <input className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={session.location_text} onChange={(e) => updateServiceSession(index, { location_text: e.target.value })} placeholder={copy('Venue, Zoom link, Google Meet, or address', 'Ukumbi, kiungo cha Zoom, Google Meet, au anwani')} />
                                                </label>
                                                <label className="space-y-1.5 sm:col-span-2">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Registration deadline', 'Mwisho wa usajili')}</span>
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
                                                <p className="text-sm font-black">{day?.label || copy('Day', 'Siku')}</p>
                                                    <p className="text-xs text-muted-foreground">{rule.start_time} - {rule.end_time}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAvailabilityRule(index)}
                                                    className="h-10 w-10 rounded-xl border bg-background text-muted-foreground hover:text-red-600"
                                                    aria-label={copy('Remove availability rule', 'Ondoa kanuni ya upatikanaji')}
                                                >
                                                    <X className="h-4 w-4 mx-auto" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Day', 'Siku')}</span>
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
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Start', 'Anza')}</span>
                                                    <input
                                                        type="time"
                                                        className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                        value={rule.start_time}
                                                        onChange={(e) => updateAvailabilityRule(index, { start_time: e.target.value })}
                                                    />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('End', 'Mwisho')}</span>
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
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{copy('Slot', 'Nafasi')}</span>
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
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{copy('Buffer', 'Muda wa mapumziko')}</span>
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
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{copy('Limit', 'Kikomo')}</span>
                                                    <select
                                                        className="w-full h-11 rounded-xl border border-input bg-background px-2 text-sm font-semibold"
                                                        value={rule.capacity_type || 'limited'}
                                                        onChange={(e) => updateAvailabilityRule(index, { capacity_type: e.target.value })}
                                                    >
                                                        <option value="limited">{copy('Limited', 'Yenye kikomo')}</option>
                                                        <option value="unlimited">{copy('Unlimited', 'Bila kikomo')}</option>
                                                    </select>
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{copy('Capacity', 'Uwezo')}</span>
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
                                                <p className="text-xs font-semibold text-red-600">{copy('End time must be after start time.', 'Muda wa mwisho lazima uwe baada ya muda wa kuanza.')}</p>
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
                                    {schedulingSaving ? copy('Saving availability...', 'Inahifadhi upatikanaji...') : availabilityMode === 'fixed_sessions' ? copy('Save Sessions', 'Hifadhi vipindi') : copy('Save Availability', 'Hifadhi upatikanaji')}
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
                            placeholder={copy('Search products...', 'Tafuta bidhaa...')}
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
                        <p className="text-sm font-medium">{copy('Loading products...', 'Inapakia bidhaa...')}</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="py-20 text-center bg-card/40 rounded-3xl border border-dashed border-border flex flex-col items-center">
                        <div className="p-4 bg-muted/50 rounded-full mb-4">
                            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold">{copy('No', 'Hakuna')} {pageMeta.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                            {copy('You have not published any products yet, or your search returned no results.', 'Hujampandisha bidhaa yoyote bado au utafutaji wako hauna matokeo.')}
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
                                                    {copy('Continue completing it in the upload editor.', 'Endelea kuikamilisha kwenye upload editor.')}
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
                                                {product.module_key === 'menu' && product.module_details?.prep_time_minutes !== null && product.module_details?.prep_time_minutes !== undefined && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {product.module_details.prep_time_minutes} {copy('min', 'dak')}
                                                    </span>
                                                )}
                                                {product.module_key === 'rooms' && product.module_details?.max_guests && (
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> up to {product.module_details.max_guests}
                                                    </span>
                                                )}
                                                {product.module_key === 'rooms' && product.module_details?.room_count && (
                                                    <span className="flex items-center gap-1">
                                                        <BedDouble className="h-3 w-3" /> {product.module_details.room_count} room{Number(product.module_details.room_count) === 1 ? '' : 's'}
                                                    </span>
                                                )}
                                                {product.module_key === 'tour_departures' && product.module_details?.duration_label && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {product.module_details.duration_label}
                                                    </span>
                                                )}
                                                {product.module_key === 'tour_departures' && product.module_details?.group_size && (
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> {product.module_details.group_size} {copy('seats', 'nafasi')}
                                                    </span>
                                                )}
                                                {product.module_key === 'custom_orders' && product.module_details?.lead_time && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {product.module_details.lead_time}
                                                    </span>
                                                )}
                                                {product.module_key === 'custom_orders' && product.module_details?.minimum_order && (
                                                    <span className="flex items-center gap-1">
                                                        <Package className="h-3 w-3" /> {copy('min', 'kiwango cha chini')} {product.module_details.minimum_order}
                                                    </span>
                                                )}
                                                {product.module_key === 'appointments' && product.module_details?.appointment_duration_minutes && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {product.module_details.appointment_duration_minutes} {copy('min', 'dak')}
                                                    </span>
                                                )}
                                                {product.module_key === 'appointments' && product.module_details?.capacity && (
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> {product.module_details.capacity}/slot
                                                    </span>
                                                )}
                                                {product.module_key === 'reservations' && product.module_details?.reservation_duration_minutes && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {product.module_details.reservation_duration_minutes} {copy('min', 'dak')}
                                                    </span>
                                                )}
                                                {product.module_key === 'reservations' && product.module_details?.party_size_limit && (
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> up to {product.module_details.party_size_limit}
                                                    </span>
                                                )}
                                                {product.module_key === 'rentals' && product.module_details?.rental_duration_minutes && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {product.module_details.rental_duration_minutes} {copy('min', 'dak')}
                                                    </span>
                                                )}
                                                {product.module_key === 'rentals' && product.module_details?.available_units && (
                                                    <span className="flex items-center gap-1">
                                                        <Package className="h-3 w-3" /> {product.module_details.available_units} {copy(Number(product.module_details.available_units) === 1 ? 'unit' : 'units', 'vitengo')}
                                                    </span>
                                                )}
                                                {product.module_key === 'workshops' && product.module_details?.workshop_duration_minutes && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {product.module_details.workshop_duration_minutes} {copy('min', 'dak')}
                                                    </span>
                                                )}
                                                {product.module_key === 'workshops' && product.module_details?.workshop_capacity && (
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> {product.module_details.workshop_capacity} {copy('seats', 'nafasi')}
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
                                                {product.module_key === 'menu' && product.module_details?.section && (
                                                    <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">
                                                        {product.module_details.section}
                                                    </span>
                                                )}
                                                {product.module_key === 'menu' && (product.module_details?.dietary_tags || []).slice(0, 2).map((tag) => (
                                                    <span key={`${product.id}-${tag}`} className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                                        {String(tag).replace(/_/g, ' ')}
                                                    </span>
                                                ))}
                                                {product.module_key === 'rooms' && product.module_details?.room_type && (
                                                    <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700">
                                                        {product.module_details.room_type}
                                                    </span>
                                                )}
                                                {product.module_key === 'rooms' && product.module_details?.bed_type && (
                                                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                                        {product.module_details.bed_type}
                                                    </span>
                                                )}
                                                {product.module_key === 'rooms' && (product.module_details?.amenities || []).slice(0, 2).map((amenity) => (
                                                    <span key={`${product.id}-${amenity}`} className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                                        {String(amenity).replace(/_/g, ' ')}
                                                    </span>
                                                ))}
                                                {product.module_key === 'tour_departures' && product.module_details?.destination && (
                                                    <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-semibold text-cyan-700">
                                                        {product.module_details.destination}
                                                    </span>
                                                )}
                                                {product.module_key === 'tour_departures' && product.module_details?.departure_type && (
                                                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                                        {String(product.module_details.departure_type).replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {product.module_key === 'custom_orders' && (
                                                    <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">
                                                        Quote after request
                                                    </span>
                                                )}
                                                {product.module_key === 'custom_orders' && product.module_details?.quote_policy && (
                                                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                                        {String(product.module_details.quote_policy).replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {product.module_key === 'appointments' && product.module_details?.booking_policy && (
                                                    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                                                        {String(product.module_details.booking_policy).replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {product.module_key === 'appointments' && product.module_details?.appointment_location_mode && (
                                                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                                        {String(product.module_details.appointment_location_mode).replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {product.module_key === 'reservations' && product.module_details?.reservation_type && (
                                                    <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700">
                                                        {String(product.module_details.reservation_type).replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {product.module_key === 'reservations' && product.module_details?.seating_type && (
                                                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                                        {product.module_details.seating_type}
                                                    </span>
                                                )}
                                                {product.module_key === 'rentals' && product.module_details?.rental_type && (
                                                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                                                        {String(product.module_details.rental_type).replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {product.module_key === 'rentals' && product.module_details?.rental_unit && (
                                                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                                        per {String(product.module_details.rental_unit).replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {product.module_key === 'workshops' && product.module_details?.workshop_format && (
                                                    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                                                        {String(product.module_details.workshop_format).replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {product.module_key === 'workshops' && product.module_details?.session_count && (
                                                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                                        {product.module_details.session_count} session{Number(product.module_details.session_count) === 1 ? '' : 's'}
                                                    </span>
                                                )}
                                                {(product.category_attribute_values || [])
                                                    .slice(0, 2)
                                                    .map((entry) => {
                                                        const label = entry?.attribute?.label || entry?.attribute?.key || copy('Facet', 'Sifa');
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
                                    <p className="text-xs font-black uppercase tracking-widest text-brand-600">{copy('Day view', 'Muonekano wa siku')}</p>
                                    <h2 className="text-xl font-black mt-1">{selectedCalendarLabel}</h2>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {selectedCalendarRequests.length} {copy(selectedCalendarRequests.length === 1 ? 'booking scheduled on this date.' : 'bookings scheduled on this date.', selectedCalendarRequests.length === 1 ? 'booking imepangwa kwa tarehe hii.' : 'booking zimepangwa kwa tarehe hii.')}
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
                                        <p className="font-black mt-3">{copy('No bookings on this day', 'Hakuna booking siku hii')}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{copy('Scheduled bookings will appear here once customers book or you confirm a time.', 'Booking zilizopangwa zitaonekana hapa wateja wakifanya booking au ukithibitisha muda.')}</p>
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
                                                        {group.requests.length} {copy('total', 'jumla')}
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
                                                                    {request.customer_phone || request.customer_email || copy('No contact', 'Hakuna mawasiliano')} · {formatTimeRange(request)}
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
                                    <h2 className="text-xl font-black mt-1">{selectedServiceRequest.product?.title || copy('Service request', 'Ombi la huduma')}</h2>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {copy('Sent', 'Limetumwa')} {selectedServiceRequest.created_at ? new Date(selectedServiceRequest.created_at).toLocaleString() : ''}
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
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Customer', 'Mteja')}</p>
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
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Preference', 'Upendeleo')}</p>
                                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                            {selectedServiceRequest.service_option?.name && (
                                                <p className="font-black text-foreground">{selectedServiceRequest.service_option.name}</p>
                                            )}
                                            {(selectedServiceRequest.preferred_date || selectedServiceRequest.preferred_time) && (
                                                <p className="flex items-center gap-2">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {selectedServiceRequest.preferred_date || copy('Any date', 'Tarehe yoyote')} {selectedServiceRequest.preferred_time || ''}
                                                </p>
                                            )}
                                            {selectedServiceRequest.location_text && (
                                                <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {selectedServiceRequest.location_text}</p>
                                            )}
                                            {selectedServiceRequest.duration_minutes && (
                                                <p>{selectedServiceRequest.duration_minutes} {copy('min expected duration', 'dakika za muda unaotarajiwa')}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {selectedServiceRequest.message && (
                                    <div className="rounded-xl border bg-white p-3">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Message', 'Ujumbe')}</p>
                                        <p className="text-sm mt-2 whitespace-pre-line">{selectedServiceRequest.message}</p>
                                    </div>
                                )}

                                {selectedServiceRequest.client_requirements && Object.keys(selectedServiceRequest.client_requirements).length > 0 && (
                                    <div className="rounded-xl border bg-white p-3">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Intake Details', 'Maelezo ya awali')}</p>
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
                                                                    ? (value ? copy('Yes', 'Ndiyo') : copy('No', 'Hapana'))
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

                                {canUpdate && (() => {
                                    const moduleKey = selectedServiceRequest.product?.module_key || selectedServiceRequest.metadata?.module_key;
                                    const config = moduleFulfillmentConfig(moduleKey);
                                    const current = selectedServiceRequest.module_fulfillment || selectedServiceRequest.metadata?.module_fulfillment || null;
                                    if (!config) return null;

                                    return (
                                        <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                <div>
                                                    <p className="font-black">{config.title}</p>
                                                    <p className="text-xs text-sky-900/80 mt-1">{config.hint}</p>
                                                </div>
                                                {current?.status && (
                                                    <span className="w-fit rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-sky-700">
                                                        {current.status.replaceAll('_', ' ')}
                                                    </span>
                                                )}
                                            </div>

                                            {current?.fields && Object.keys(current.fields).length > 0 && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {Object.entries(current.fields).map(([key, value]) => (
                                                        <div key={key} className="rounded-lg bg-white/80 p-2">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{key.replaceAll('_', ' ')}</p>
                                                            <p className="text-sm font-semibold mt-1 break-words">{formatFulfillmentValue(value)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Action', 'Hatua')}</span>
                                                    <select
                                                        className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                                        value={fulfillmentAction.action}
                                                        onChange={(e) => setFulfillmentAction((prev) => ({ ...prev, action: e.target.value }))}
                                                    >
                                                        <option value="confirm">{copy('Confirm', 'Thibitisha')}</option>
                                                        <option value="start">{copy('Start / check in', 'Anza / ingia')}</option>
                                                        <option value="update">{copy('Update only', 'Sasisha tu')}</option>
                                                        <option value="complete">{copy('Complete', 'Kamilisha')}</option>
                                                        <option value="cancel">{copy('Cancel', 'Ghairi')}</option>
                                                    </select>
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Tool status', 'Hali ya zana')}</span>
                                                    <select
                                                        className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                                        value={fulfillmentAction.fulfillment_status}
                                                        onChange={(e) => setFulfillmentAction((prev) => ({ ...prev, fulfillment_status: e.target.value }))}
                                                    >
                                                        {config.statuses.map((status) => (
                                                            <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {config.fields.map((field) => (
                                                    <label key={field.key} className="space-y-1.5">
                                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{field.label}</span>
                                                        <input
                                                            type={field.type || 'text'}
                                                            min={field.type === 'number' ? '1' : undefined}
                                                            className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                                            value={field.type === 'datetime-local'
                                                                ? formatDateTimeInput(fulfillmentAction.fields?.[field.key])
                                                                : (fulfillmentAction.fields?.[field.key] ?? '')}
                                                            onChange={(e) => updateFulfillmentField(field.key, e.target.value)}
                                                        />
                                                    </label>
                                                ))}
                                                <label className="space-y-1.5 sm:col-span-2">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Internal notes', 'Maelezo ya ndani')}</span>
                                                    <textarea
                                                        className="w-full min-h-20 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                                        value={fulfillmentAction.notes}
                                                        onChange={(e) => setFulfillmentAction((prev) => ({ ...prev, notes: e.target.value }))}
                                                        placeholder={copy('Room issue, pickup instructions, production note, handover note...', 'Tatizo la chumba, maelekezo ya pickup, maelezo ya uzalishaji, maelezo ya makabidhiano...')}
                                                    />
                                                </label>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                <Button type="button" variant="outline" className="rounded-xl" disabled={fulfillmentUpdating} onClick={() => saveModuleFulfillment({ action: 'confirm' })}>
                                                    {copy('Confirm', 'Thibitisha')}
                                                </Button>
                                                <Button type="button" variant="outline" className="rounded-xl" disabled={fulfillmentUpdating} onClick={() => saveModuleFulfillment({ action: 'start' })}>
                                                    {copy('Start', 'Anza')}
                                                </Button>
                                                <Button type="button" variant="outline" className="rounded-xl" disabled={fulfillmentUpdating} onClick={() => saveModuleFulfillment({ action: 'complete' })}>
                                                    {copy('Complete', 'Kamilisha')}
                                                </Button>
                                                <Button type="button" className="rounded-xl bg-sky-700 hover:bg-sky-800 text-white" disabled={fulfillmentUpdating} onClick={() => saveModuleFulfillment()}>
                                                    {fulfillmentUpdating ? copy('Saving...', 'Inahifadhi...') : copy('Save', 'Hifadhi')}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {canUpdate && (
                                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 space-y-3">
                                    <p className="font-black">{copy('Manage Request', 'Dhibiti ombi')}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Status', 'Hali')}</span>
                                            <select
                                                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                                value={requestAction.status}
                                                onChange={(e) => setRequestAction((prev) => ({ ...prev, status: e.target.value }))}
                                            >
                                                <option value="pending">{copy('Pending', 'Inasubiri')}</option>
                                                <option value="contacted">{copy('Contacted', 'Amefikiwa')}</option>
                                                <option value="quoted">{copy('Quoted', 'Bei imetolewa')}</option>
                                                <option value="confirmed">{copy('Confirmed', 'Imethibitishwa')}</option>
                                                <option value="completed">{copy('Completed', 'Imekamilika')}</option>
                                                <option value="cancelled">{copy('Cancelled', 'Imeghairiwa')}</option>
                                            </select>
                                        </label>
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Quote TZS', 'Bei ya TZS')}</span>
                                            <input
                                                type="number"
                                                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                                value={requestAction.quoted_amount}
                                                onChange={(e) => setRequestAction((prev) => ({ ...prev, quoted_amount: e.target.value, status: e.target.value ? 'quoted' : prev.status }))}
                                                placeholder={copy('Optional', 'Si lazima')}
                                            />
                                        </label>
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Schedule', 'Ratiba')}</span>
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
                                            {copy('Mark Contacted', 'Weka amefikiwa')}
                                        </Button>
                                        <Button type="button" variant="outline" className="rounded-xl" disabled={requestUpdating} onClick={() => updateServiceRequest({ status: 'quoted' })}>
                                            {copy('Save Quote', 'Hifadhi bei')}
                                        </Button>
                                        <Button type="button" variant="outline" className="rounded-xl" disabled={requestUpdating} onClick={() => updateServiceRequest({ status: 'confirmed' })}>
                                            {copy('Confirm', 'Thibitisha')}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                            disabled={requestUpdating || !['held', 'paid'].includes(selectedServiceRequest.payment_status)}
                                            onClick={markServiceDelivered}
                                        >
                                            {copy('Delivered', 'Imewasilishwa')}
                                        </Button>
                                        <Button type="button" className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white" disabled={requestUpdating} onClick={() => updateServiceRequest()}>
                                            {requestUpdating ? copy('Saving...', 'Inahifadhi...') : copy('Save', 'Hifadhi')}
                                        </Button>
                                    </div>

                                    {selectedServiceRequest.payment_status && (
                                        <div className="rounded-xl border bg-white p-3">
                                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('PSP settlement', 'Malipo ya PSP')}</p>
                                            <p className="text-sm font-semibold mt-1">
                                                {copy('Payment:', 'Malipo:')} {selectedServiceRequest.payment_status.replaceAll('_', ' ')}
                                                {selectedServiceRequest.delivery_status ? ` · ${copy('Delivery:', 'Delivery:')} ${selectedServiceRequest.delivery_status.replaceAll('_', ' ')}` : ''}
                                            </p>
                                            {selectedServiceRequest.auto_confirm_after && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {copy('Auto-confirm window ends', 'Muda wa uthibitishaji wa moja kwa moja unaisha')} {new Date(selectedServiceRequest.auto_confirm_after).toLocaleString()} {copy('if no dispute is opened.', 'ikiwa hakuna mgogoro unaofunguliwa.')}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {selectedServiceRequest.scheduled_at && (
                                        <div className="rounded-xl border bg-white p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Calendar readiness', 'Utayari wa kalenda')}</p>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {selectedServiceRequest.calendar_sync_status || 'pending'}{selectedServiceRequest.calendar_sync_error ? ` · ${selectedServiceRequest.calendar_sync_error}` : ''}
                                                </p>
                                            </div>
                                            <Button type="button" variant="outline" className="rounded-xl shrink-0" disabled={requestUpdating} onClick={prepareCalendarEvent}>
                                                <Calendar className="h-4 w-4 mr-1" /> {copy('Prepare Event', 'Andaa tukio')}
                                            </Button>
                                        </div>
                                    )}

                                    {selectedServiceRequest.payment_url && (
                                        <div className="space-y-3">
                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black uppercase tracking-widest text-emerald-700">{copy('Payment link', 'Kiungo cha malipo')}</p>
                                                    <p className="text-xs text-emerald-800 truncate mt-1">{selectedServiceRequest.payment_url}</p>
                                                </div>
                                                <Button type="button" variant="outline" className="rounded-xl shrink-0" onClick={() => copyPaymentLink(selectedServiceRequest.payment_url)}>
                                                    <Copy className="h-4 w-4 mr-1" /> {copy('Copy Link', 'Nakili kiungo')}
                                                </Button>
                                            </div>

                                            <div className="rounded-xl border bg-white p-3 space-y-3">
                                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Notification outbox', 'Kikasha cha arifa')}</p>
                                                        <p className="text-sm text-muted-foreground mt-1">{copy('Prepare pending SMS, WhatsApp, and email payloads. Provider sending will connect here later.', 'Andaa ujumbe wa SMS, WhatsApp na barua pepe unaosubiri. Utaftaji wa mtoa huduma utaunganishwa hapa baadaye.')}</p>
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
