import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import {
    Search,
    ShoppingCart,
    Trash2,
    Plus,
    Minus,
    CheckCircle,
    User,
    CreditCard,
    Banknote,
    Smartphone,
    UserPlus,
    X,
    Package,
    ShieldCheck,
    Inbox,
    Loader2,
    Info,
    ChevronRight,
    Check,
    History,
    Search as SearchIcon
} from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from '@/Components/ui/Dialog';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter,
    DrawerClose
} from '@/Components/ui/Drawer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { productQuantityLabel, productStockLabel, productUnitLabel } from '@/lib/productUnits';

export default function PosTerminal({ merchant }) {
    const [hasTerminalSession, setHasTerminalSession] = useState(false);
    const [checkedTerminalSession, setCheckedTerminalSession] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [paymentMode, setPaymentMode] = useState('cash');
    const [processing, setProcessing] = useState(false);
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [staffList, setStaffList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [activeStaff, setActiveStaff] = useState(null);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [lastOrder, setLastOrder] = useState(null);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [amountPaid, setAmountPaid] = useState('');
    const [managerPin, setManagerPin] = useState('');
    const [requireManagerApproval, setRequireManagerApproval] = useState(false);
    const [requestingRemote, setRequestingRemote] = useState(false);
    const [approvalRequested, setApprovalRequested] = useState(false);
    const [pendingOrders, setPendingOrders] = useState([]);
    const [isOrdersDrawerOpen, setIsOrdersDrawerOpen] = useState(false);
    const [pickupCode, setPickupCode] = useState('');
    const [fetchingOrders, setFetchingOrders] = useState(false);
    const [searchingCode, setSearchingCode] = useState(false);
    const [hasNewUpdate, setHasNewUpdate] = useState(false);
    const [loadedOrderId, setLoadedOrderId] = useState(null);
    const [selectedProductForDetails, setSelectedProductForDetails] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
    const [staffSessionLocation, setStaffSessionLocation] = useState(null);
    const shopRoutes = Array.isArray(merchant?.retail_settings?.shop_routes) ? merchant.retail_settings.shop_routes : [];
    const routeByShopId = shopRoutes.reduce((acc, row) => {
        acc[Number(row.shop_location_id)] = row;
        return acc;
    }, {});
    const activeStaffRole = String(activeStaff?.role || '').toUpperCase();
    const isManagerLike = activeStaffRole === 'MANAGER' || (merchant?.user_id && activeStaff?.user_id && Number(merchant.user_id) === Number(activeStaff.user_id));
    const canSwitchLocation = isManagerLike;
    const staffLocationId = Number(staffSessionLocation?.id || activeStaff?.assigned_location_id || 0);
    const accessibleLocations = canSwitchLocation
        ? locations
        : locations.filter((loc) => Number(loc.id) === staffLocationId);
    const cartItemKey = (productId, variantId = null) => `${productId}:${variantId || 0}`;

    const variantDisplayLabel = (variant, productTitle = '') => {
        const attrs = variant?.attributes && typeof variant.attributes === 'object'
            ? Object.entries(variant.attributes)
                .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
                .map(([k, v]) => `${k}: ${v}`)
                .join(' • ')
            : '';

        const rawName = String(variant?.name || '').trim();
        const cleanName = rawName && productTitle && rawName.toLowerCase() === String(productTitle).toLowerCase()
            ? ''
            : rawName;

        return attrs || cleanName || 'Variant';
    };

    const productCardPriceText = (product) => {
        const unitLabel = productUnitLabel(product);
        const suffix = unitLabel ? ` / ${unitLabel}` : '';
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        if (product?.has_variants && variants.length > 0) {
            const prices = variants
                .map((v) => Number(v?.price))
                .filter((p) => Number.isFinite(p) && p >= 0);

            if (prices.length > 0) {
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                return min === max ? `${formatCurrency(min)}${suffix}` : `${formatCurrency(min)} - ${formatCurrency(max)}${suffix}`;
            }
        }

        return `${formatCurrency(product?.discounted_price || product?.price || 0)}${suffix}`;
    };

    const quantityStepForProduct = (product) => {
        if (!product?.unit_type?.allows_decimal) return 1;
        return Number(product?.order_increment || 0.001);
    };

    const sellableQuantityForItem = (item) => Math.max(0.001, Number(item?.sellable_quantity || 1));
    const lineQuantityFactor = (item) => Number(item.quantity || 0) / sellableQuantityForItem(item);
    const lineTotal = (item) => parseFloat(item.unit_price || 0) * lineQuantityFactor(item);
    const lineOriginalTotal = (item) => parseFloat(item.original_price || 0) * lineQuantityFactor(item);

    const handleStaffLogout = () => {
        localStorage.removeItem('retail_staff_token');
        localStorage.removeItem('retail_staff_info');
        localStorage.removeItem('retail_staff_location');
        localStorage.removeItem('retail_staff_merchant');
        delete window.axios?.defaults?.headers?.common?.Authorization;
        router.visit(`/${merchant.username}/terminal`);
    };

    const transferStateMeta = (summary) => {
        const state = summary?.state || 'NONE';
        if (state === 'PENDING_DISPATCH') return { label: 'Waiting Store Dispatch', cls: 'bg-amber-100 text-amber-700' };
        if (state === 'DISPATCHED') return { label: 'In Transit to Shop', cls: 'bg-sky-100 text-sky-700' };
        if (state === 'RECEIVED') return { label: 'Arrived at Shop', cls: 'bg-emerald-100 text-emerald-700' };
        if (state === 'IN_PROGRESS') return { label: 'Transfer In Progress', cls: 'bg-violet-100 text-violet-700' };
        return null;
    };

    const transferProgressText = (summary) => {
        if (!summary?.total) return '';
        const state = summary?.state || 'NONE';
        if (state === 'DISPATCHED') return ` (${summary.dispatched}/${summary.total})`;
        return ` (${summary.received}/${summary.total})`;
    };

    const currentReceiptLocationId = () => Number(staffLocationId || selectedLocation || 0);

    const dispatchedTransferTasks = (order) => {
        const tasks = Array.isArray(order?.transfer_tasks) ? order.transfer_tasks : [];
        return tasks.filter((task) => task.status === 'DISPATCHED');
    };

    const receivableTransferTasks = (order) => {
        const targetLocationId = currentReceiptLocationId();
        return dispatchedTransferTasks(order).filter((task) => (
            targetLocationId > 0 && Number(task.to_location_id) === targetLocationId
        ));
    };

    const transferDestinationLabel = (order) => {
        const task = dispatchedTransferTasks(order)[0];
        return task?.to_location?.name || locations.find((loc) => Number(loc.id) === Number(task?.to_location_id))?.name || 'destination shop';
    };

    const fetchInitialData = async () => {
        try {
            // Fetch Locations
            const locRes = await window.axios.get('/api/merchant/locations');
            const locs = locRes.data.data || [];
            setLocations(locs);
            if (locs.length > 0) setSelectedLocation(locs[0].id);

            // Identify Active Staff from Session
            const savedStaff = localStorage.getItem('retail_staff_info');
            if (savedStaff) {
                const staffObj = JSON.parse(savedStaff);
                setActiveStaff(staffObj);
                setSelectedStaff(staffObj.id);
            }
            const savedLocation = localStorage.getItem('retail_staff_location');
            if (savedLocation) {
                const locationObj = JSON.parse(savedLocation);
                setStaffSessionLocation(locationObj);
                if (locationObj?.id) {
                    setSelectedLocation(Number(locationObj.id));
                }
            }

            // Fetch Staff (Only succeeds for Managers/Owners)
            try {
                const staffRes = await window.axios.get('/api/retail/staff');
                const staff = staffRes.data.data || [];
                setStaffList(staff);
                
                // If not already set by session, default to first staff
                if (!selectedStaff && staff.length > 0) {
                    setSelectedStaff(staff[0].id);
                }
            } catch (staffErr) {
                // Silent catch for Cashiers who can't list other staff
                console.warn('Staff list restricted to Managers.');
            }
            
            fetchPendingOrders();
        } catch (err) {
            console.error('Failed to load initial POS data', err);
        }
    };

    const fetchPendingOrders = async () => {
        try {
            setFetchingOrders(true);
            const res = await window.axios.get('/api/retail/pos/pending');
            const newPending = res.data.data || [];

            if (newPending.length > pendingOrders.length) {
                setHasNewUpdate(true);
            }

            setPendingOrders(newPending);
        } catch (err) {
            console.error('Failed to fetch pending orders', err);
        } finally {
            setFetchingOrders(false);
        }
    };

    const handleLookupByCode = async (e) => {
        if (e) e.preventDefault();
        if (!pickupCode) return;

        setSearchingCode(true);
        try {
            const res = await window.axios.post('/api/retail/pos/lookup', { code: pickupCode });
            handleLoadOrder(res.data.data);
            toast.success('Oda imepatikana!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Oda haikupatikana.');
        } finally {
            setSearchingCode(false);
        }
    };

    const confirmReceiptFromPending = async (order) => {
        const receivable = receivableTransferTasks(order);
        if (receivable.length === 0) {
            toast.info(`Verify at ${transferDestinationLabel(order)}.`);
            return;
        }

        setProcessing(true);
        try {
            for (const task of receivable) {
                await window.axios.patch(`/api/retail/transfers/${task.id}/receive`, {});
            }
            toast.success('Bidhaa zimepokelewa kwenye shop.');
            await fetchPendingOrders();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindikana kuthibitisha mapokezi.');
        } finally {
            setProcessing(false);
        }
    };

    const handleLoadOrder = (order) => {
        // Map items to cart format
        const items = order.pos_items || [];
        const newCart = items.map(item => ({
            product_id: item.product_id,
            title: item.product?.title || 'Unknown Product',
            unit_price: item.unit_price,
            original_price: item.unit_price,
            quantity: Number(item.quantity_decimal ?? item.quantity ?? 1),
            variant_id: item.product_variant_id,
            max_stock: item.variant?.inventory_quantity ?? item.variant?.inventory_count ?? item.product?.inventory_quantity ?? item.product?.inventory_count ?? 999,
            image: item.product?.image_url,
            product: item.product,
            unit_type: item.product?.unit_type || null,
            sellable_quantity: item.product?.sellable_quantity || 1,
            order_increment: item.product?.order_increment || null,
        }));

        setCart(newCart);
        setCustomerName(order.customer_name || '');
        setCustomerPhone(order.customer_phone || '');

        // Use counter_total if it exists (Bargaining result)
        const displayTotal = order.counter_total > 0 ? order.counter_total : order.grand_total;
        const transferReceived = order?.transfer_summary?.state === 'RECEIVED';
        const resolvedPaid = transferReceived ? displayTotal : order.total_paid;
        setAmountPaid(String(resolvedPaid || 0));

        if (order.manager_notes) {
            toast.info(`Maelezo ya Meneja: ${order.manager_notes}`);
        }

        setLoadedOrderId(order.id);
        setIsOrdersDrawerOpen(false);
        setPickupCode('');

        if (order.approval_status === 'pending') {
            setApprovalRequested(true);
            setRequireManagerApproval(true);
        } else {
            setApprovalRequested(false);
            setRequireManagerApproval(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('retail_staff_token');
        if (!token) {
            setCheckedTerminalSession(true);
            router.visit(`/${merchant.username}/terminal`, { replace: true });
            return;
        }

        window.axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        setHasTerminalSession(true);
        setCheckedTerminalSession(true);

        return () => {
            delete window.axios.defaults.headers.common.Authorization;
        };
    }, [merchant.username]);

    useEffect(() => {
        if (!hasTerminalSession) return;
        fetchInitialData();
        const interval = setInterval(fetchPendingOrders, 30000);
        return () => clearInterval(interval);
    }, [hasTerminalSession]);

    const totalAmount = cart.reduce((sum, item) => sum + lineTotal(item), 0);
    const totalDiscount = cart.reduce((sum, item) => sum + (lineOriginalTotal(item) - lineTotal(item)), 0);
    const paidAmount = parseFloat(amountPaid) || 0;
    const hasTransferRequests = cart.some((item) => {
        const source = Number(item.source_location_id || 0);
        return source > 0 && source !== Number(selectedLocation || 0);
    });
    const hasOutstandingBalance = isCheckoutModalOpen && !hasTransferRequests && paidAmount < totalAmount;
    const requiresCustomerInfo = paymentMode === 'store_credit' || hasOutstandingBalance;
    const transferLines = cart.filter((item) => {
        const source = Number(item.source_location_id || 0);
        return source > 0 && source !== Number(selectedLocation || 0);
    });

    const validateCustomerInfoForCredit = () => {
        if (!requiresCustomerInfo) return true;

        if (!customerName.trim() || !customerPhone.trim()) {
            toast.error('Customer name and phone are required for Pay Later or any sale with a remaining balance.');
            return false;
        }

        return true;
    };

    // Reactive Approval Check
    useEffect(() => {
        if (!isCheckoutModalOpen) return;

        const settings = merchant.retail_settings || {};
        const maxNoPinDiscount = settings.max_no_pin_discount_percent || 5;

        const totalOriginal = cart.reduce((sum, item) => sum + lineOriginalTotal(item), 0);
        const currentDiscount = cart.reduce((sum, item) => sum + (lineOriginalTotal(item) - lineTotal(item)), 0);

        const discountPercent = totalOriginal > 0 ? (currentDiscount / totalOriginal) * 100 : 0;
        const exceedsDiscount = discountPercent > maxNoPinDiscount;

        const isPayLaterMode = paymentMode === 'store_credit';

        // Final Decision
        const needsApproval = !hasTransferRequests && (exceedsDiscount || isPayLaterMode) && !approvalRequested;

        setRequireManagerApproval(needsApproval);
    }, [isCheckoutModalOpen, cart, merchant.retail_settings, approvalRequested, hasTransferRequests, paymentMode, totalAmount]);

    const searchProducts = async (q) => {
        try {
            const res = await window.axios.get('/api/retail/pos/products', {
                params: { q, location_id: selectedLocation }
            });
            setProducts(res.data.data);
        } catch (err) {
            console.error('Search failed', err);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            searchProducts(searchQuery);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, selectedLocation]);

    const addToCart = (product, variant = null) => {
        // If product has variants but none selected, open details drawer
        if (product.has_variants && !variant && product.variants?.length > 0) {
            setSelectedProductForDetails(product);
            return;
        }

        const effectivePrice = variant ? (variant.price || product.discounted_price || product.price) : (product.discounted_price || product.price);
        const effectiveOriginalPrice = variant ? (variant.price || product.price) : (product.discounted_price || product.price);
        const variantId = variant ? variant.id : null;
        const displayTitle = variant ? `${product.title} (${variantDisplayLabel(variant, product.title)})` : product.title;
        const selectedLoc = locations.find((loc) => Number(loc.id) === Number(selectedLocation));
        const selectedLocType = String(selectedLoc?.type || '').toLowerCase();
        const mappedRoute = routeByShopId[Number(selectedLocation)] || null;
        const defaultSourceLocationId = selectedLocType === 'shop'
            ? (mappedRoute?.serving_store_location_id ?? null)
            : null;

        const variantLocationInventory = variant?.location_inventories?.find((row) => Number(row.merchant_location_id) === Number(selectedLocation));
        const available = variant
            ? Number(variantLocationInventory?.quantity_decimal ?? variantLocationInventory?.quantity ?? variant.inventory_quantity ?? variant.inventory_count ?? 0)
            : Number(product.location_inventories?.[0]?.quantity_decimal ?? product.location_inventories?.[0]?.quantity ?? product.inventory_quantity ?? product.inventory_count ?? 0);
        const initialQuantity = Math.max(0.001, Number(product.min_order_quantity || product.sellable_quantity || 1));

        const existing = cart.find(item => item.product_id === product.id && item.variant_id === variantId);
        const currentInCart = existing ? existing.quantity : 0;

        if (available <= 0 || currentInCart >= available) {
            toast.error(`Stock is insufficient. Available: ${available}`);
            return;
        }

        if (existing) {
            setCart(cart.map(item =>
                (item.product_id === product.id && item.variant_id === variantId)
                    ? { ...item, quantity: Math.min(item.max_stock, Number(item.quantity || 0) + quantityStepForProduct(product)) }
                    : item
            ));
        } else {
            setCart([...cart, {
                product_id: product.id,
                variant_id: variantId,
                title: displayTitle,
                original_price: effectiveOriginalPrice,
                unit_price: effectivePrice,
                quantity: Math.min(available, initialQuantity),
                image: product.image_url,
                max_stock: available,
                is_overridden: false,
                source_location_id: defaultSourceLocationId,
                product,
                unit_type: product.unit_type || null,
                sellable_quantity: product.sellable_quantity || 1,
                order_increment: product.order_increment || null,
            }]);
        }

        if (selectedProductForDetails) {
            setSelectedProductForDetails(null);
            setSelectedVariant(null);
        }
    };

    const updatePrice = (productId, variantId, newPrice) => {
        setCart(cart.map(item => {
            if (item.product_id === productId && (item.variant_id || null) === (variantId || null)) {
                const price = parseFloat(newPrice) || 0;
                return {
                    ...item,
                    unit_price: price,
                    is_overridden: price !== item.original_price
                };
            }
            return item;
        }));
    };

    const updateQuantity = (productId, variantId, delta) => {
        setCart(cart.map(item => {
            if (item.product_id === productId && (item.variant_id || null) === (variantId || null)) {
                const newQty = Math.max(0, Number(item.quantity || 0) + delta);

                // Prevent exceeding available stock
                if (delta > 0 && newQty > item.max_stock) {
                    toast.error(`Cannot exceed available stock (${item.max_stock})`);
                    return item;
                }

                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const updateQuantityValue = (productId, variantId, value) => {
        const parsed = Math.max(0, Number(value || 0));
        setCart(cart.map(item => {
            if (item.product_id === productId && (item.variant_id || null) === (variantId || null)) {
                if (parsed > item.max_stock) {
                    toast.error(`Cannot exceed available stock (${productQuantityLabel(item.product || item, item.max_stock)})`);
                    return item;
                }

                return { ...item, quantity: parsed };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const updateItemSource = (productId, variantId, sourceLocationId) => {
        const parsed = sourceLocationId === '' ? null : Number(sourceLocationId);
        setCart((prev) => prev.map((item) => {
            if (item.product_id === productId && (item.variant_id || null) === (variantId || null)) {
                return { ...item, source_location_id: parsed };
            }
            return item;
        }));
    };

    const autoAllocateShopThenStore = () => {
        const mappedRoute = routeByShopId[Number(selectedLocation)] || null;
        const fallbackStoreId = Number(mappedRoute?.serving_store_location_id || 0) || null;
        if (!selectedLocation) return;

        setCart((prev) => prev.map((item) => {
            const need = Number(item.quantity || 0);
            const availableAtShop = Number(item.max_stock || 0);
            if (need > 0 && availableAtShop >= need) {
                return { ...item, source_location_id: Number(selectedLocation) };
            }
            return { ...item, source_location_id: fallbackStoreId };
        }));

        toast.success('Auto allocation imetumika: Shop kwanza, kisha Store.');
    };

    const openCheckout = () => {
        if (cart.length === 0) return;
        setAmountPaid((hasTransferRequests || paymentMode === 'store_credit') ? '0' : totalAmount.toString());
        setIsCheckoutModalOpen(true);
    };

    const requestRemoteApproval = async () => {
        if (!selectedStaff) return alert('Chagua mhudumu.');
        if (!validateCustomerInfoForCredit()) return;

        setRequestingRemote(true);
        try {
            // We save the "draft" order as a pending approval request
            await window.axios.post('/api/retail/pos/sale', {
                location_id: selectedLocation,
                staff_id: selectedStaff,
                payment_mode: paymentMode,
                customer_name: customerName,
                customer_phone: customerPhone,
                items: cart.map(item => ({
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    source_location_id: item.source_location_id,
                })),
                total_amount: totalAmount,
                amount_paid: parseFloat(amountPaid) || 0,
                discount_amount: totalDiscount,
                status: 'pending_approval' // Flag for backend
            });

            setApprovalRequested(true);
            toast.success('Ombi la idhini limetumwa kwa Meneja!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindwa kutuma ombi.');
        } finally {
            setRequestingRemote(false);
        }
    };

    const handleCheckout = async () => {
        if (!selectedStaff) {
            alert('Tafadhali chagua mhudumu (Staff) kwanza.');
            return;
        }

        if (!validateCustomerInfoForCredit()) return;

        const paid = parseFloat(amountPaid) || 0;
        setProcessing(true);
        try {
            const effectivePaid = hasTransferRequests ? 0 : paid;
            const res = await window.axios.post('/api/retail/pos/sale', {
                location_id: selectedLocation,
                staff_id: selectedStaff,
                payment_mode: paymentMode,
                customer_name: customerName,
                customer_phone: customerPhone,
                items: cart.map(item => ({
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    source_location_id: item.source_location_id,
                })),
                total_amount: totalAmount,
                amount_paid: effectivePaid,
                discount_amount: totalDiscount,
                manager_pin: managerPin,
                order_id: loadedOrderId,
                status: hasTransferRequests ? 'pending_approval' : undefined,
            });

            setLastOrder(res.data);
            setLoadedOrderId(null);
            setCart([]);
            setCustomerName('');
            setCustomerPhone('');
            setManagerPin('');
            setIsCheckoutModalOpen(false);
            if (hasTransferRequests) {
                toast.success('Ombi la bidhaa kutoka Store limetumwa. Oda ipo Pending hadi bidhaa zipokelewe.');
                setIsOrdersDrawerOpen(true);
            } else {
                setIsSuccessModalOpen(true);
            }

            // Refresh products to show updated inventory
            searchProducts(searchQuery);
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Checkout failed';
            alert(msg);
        } finally {
            setProcessing(false);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: merchant.currency?.code || 'TZS',
            minimumFractionDigits: 0,
        }).format(val);
    };

    const StaffContextChips = () => {
        if (!activeStaff) return null;

        return (
            <div className="rounded-2xl border border-brand-100 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="px-2 py-1 rounded-full bg-brand-100 text-brand-700 font-black uppercase">
                        {activeStaff.role || 'STAFF'}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-bold truncate">
                        {activeStaff.user?.name || activeStaff.name || 'Terminal User'}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold truncate">
                        {staffSessionLocation?.name || activeStaff.location?.name || 'No assigned location'}
                    </span>
                    <button
                        type="button"
                        onClick={handleStaffLogout}
                        className="px-2 py-1 rounded-full bg-red-100 text-red-700 font-black uppercase"
                    >
                        Logout
                    </button>
                </div>
            </div>
        );
    };

    const CartUI = ({ isMobile = false } = {}) => (
        <div className={`flex flex-col h-full bg-white ${isMobile ? '' : 'shadow-2xl'}`}>
            <div className="p-6 border-b border-brand-50 flex items-center justify-between">
                <h2 className="font-black text-xl flex items-center gap-2">
                    Current Order <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-600 text-xs flex items-center justify-center">{cart.length}</span>
                </h2>
                {!isMobile ? (
                    <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => setCart([])}>
                        <X className="h-5 w-5" />
                    </Button>
                ) : (
                    <Button variant="ghost" size="sm" className="text-xs font-bold text-red-500" onClick={() => { if(confirm('Clear cart?')) setCart([]); }}>
                        Clear
                    </Button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-[10px] font-black uppercase rounded-full border-brand-200 text-brand-700"
                        onClick={autoAllocateShopThenStore}
                        disabled={cart.length === 0}
                    >
                        Auto: Shop then Store
                    </Button>
                </div>
                {cart.map(item => {
                    const selectedLoc = locations.find((loc) => Number(loc.id) === Number(selectedLocation));
                    const sourceCandidates = locations.filter((loc) => {
                        const t = String(loc.type || '').toLowerCase();
                        return Number(loc.id) === Number(selectedLocation) || t === 'store' || t === 'warehouse';
                    });
                    const quantityStep = Number(item.order_increment || quantityStepForProduct(item.product || item));

                    return (
                    <div key={cartItemKey(item.product_id, item.variant_id)} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-brand-50/30 border border-brand-50">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="number"
                                    value={item.unit_price}
                                    onChange={(e) => updatePrice(item.product_id, item.variant_id, e.target.value)}
                                    className={[
                                        "w-20 text-xs font-black bg-transparent border-b border-dashed focus:border-brand-500 focus:outline-none transition-colors",
                                        item.is_overridden ? "text-amber-600 border-amber-300" : "text-brand-600 border-muted"
                                    ].join(' ')}
                                />
                                {item.is_overridden && (
                                    <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1 rounded">Negotiated</span>
                                )}
                            </div>
                            <div className="mt-2">
                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Toa Stock Kutoka</label>
                                <select
                                    value={item.source_location_id ?? ''}
                                    onChange={(e) => updateItemSource(item.product_id, item.variant_id, e.target.value)}
                                    className="mt-1 h-8 w-full rounded-lg border border-brand-100 bg-white px-2 text-[10px] font-bold"
                                >
                                    <option value="">
                                        {selectedLoc?.name || 'Shop'} (Auto)
                                    </option>
                                    {sourceCandidates.map((loc) => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.name} ({loc.type || 'SHOP'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white rounded-xl border border-brand-100 p-1">
                            <button
                                className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-brand-600"
                                onClick={() => updateQuantity(item.product_id, item.variant_id, -quantityStep)}
                            >
                                <Minus className="h-3 w-3" />
                            </button>
                            <input
                                type="number"
                                min="0"
                                step={quantityStep}
                                value={item.quantity}
                                onChange={(e) => updateQuantityValue(item.product_id, item.variant_id, e.target.value)}
                                className="h-7 w-16 rounded-lg border-0 bg-transparent text-center text-sm font-black focus:outline-none"
                            />
                            <button
                                className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-brand-600"
                                onClick={() => updateQuantity(item.product_id, item.variant_id, quantityStep)}
                            >
                                <Plus className="h-3 w-3" />
                            </button>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 text-right">{productQuantityLabel(item.product || item, item.quantity)}</p>
                    </div>
                )})}
                {cart.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
                        <ShoppingCart className="h-16 w-16 mb-4" />
                        <p className="text-sm font-bold">Cart is empty</p>
                    </div>
                )}
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-brand-100 space-y-6 pb-32 md:pb-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            Customer Information {requiresCustomerInfo ? '(Required)' : '(Optional)'}
                        </p>
                        {requiresCustomerInfo && (
                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                Credit
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Customer Name"
                                    className="pl-9 h-10 rounded-xl text-xs border-brand-100 focus:ring-brand-500"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    required={requiresCustomerInfo}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="relative">
                                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Phone Number"
                                    className="pl-9 h-10 rounded-xl text-xs border-brand-100 focus:ring-brand-500"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    required={requiresCustomerInfo}
                                />
                            </div>
                        </div>
                    </div>
                    {requiresCustomerInfo && (
                        <p className="text-[10px] font-bold text-amber-700 leading-tight">
                            Customer details are needed so this balance can be found and cleared later.
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Payment Method</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold border transition-all ${paymentMode === 'cash' ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white border-brand-100 text-muted-foreground hover:border-brand-300'}`}
                            onClick={() => setPaymentMode('cash')}
                        >
                            <Banknote className="h-4 w-4" /> Cash
                        </button>
                        <button
                            className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold border transition-all ${paymentMode === 'merchant_mm' ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white border-brand-100 text-muted-foreground hover:border-brand-300'}`}
                            onClick={() => setPaymentMode('merchant_mm')}
                        >
                            <Smartphone className="h-4 w-4" /> Mobile
                        </button>
                        <button
                            className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold border transition-all ${paymentMode === 'store_credit' ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white border-brand-100 text-muted-foreground hover:border-brand-300'}`}
                            onClick={() => setPaymentMode('store_credit')}
                        >
                            <UserPlus className="h-4 w-4" /> Pay Later/Advance
                        </button>
                        <button
                            className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold border transition-all ${paymentMode === 'online_escrow' ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white border-brand-100 text-muted-foreground hover:border-brand-300'}`}
                            onClick={() => setPaymentMode('online_escrow')}
                        >
                            <CreditCard className="h-4 w-4" /> Card
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                        <span>Subtotal</span>
                        <span>{formatCurrency(totalAmount + totalDiscount)}</span>
                    </div>
                    {totalDiscount > 0 && (
                        <div className="flex items-center justify-between text-amber-600 text-[10px] font-bold uppercase tracking-widest">
                            <span>Discount</span>
                            <span>- {formatCurrency(totalDiscount)}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-brand-100">
                        <span className="text-muted-foreground text-sm font-bold uppercase tracking-widest">Total</span>
                        <span className="text-2xl font-black text-brand-700">{formatCurrency(totalAmount)}</span>
                    </div>
                    <Button
                        className="w-full h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-lg font-black shadow-xl shadow-brand-600/30 disabled:opacity-50"
                        onClick={openCheckout}
                        disabled={cart.length === 0 || processing}
                    >
                        {processing ? (
                            <div className="animate-spin h-6 w-6 border-2 border-white/30 border-t-white rounded-full"></div>
                        ) : (
                            <>Checkout <CheckCircle className="ml-2 h-5 w-5" /></>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );

    if (!checkedTerminalSession || !hasTerminalSession) {
        return (
            <AppLayout hideTabBar>
                <Head title="Retail POS Terminal" />
            </AppLayout>
        );
    }

    return (
        <AppLayout hideTabBar>
            <Head title="Retail POS Terminal" />
            <div className="relative min-h-screen">
                {/* Desktop Layout */}
                <div className="hidden md:flex min-h-screen">
                    <div className="flex-1 p-6 space-y-5 bg-slate-50">
                        <StaffContextChips />
                        <div className="flex items-center justify-between gap-4">
                            <div className="relative w-full max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search product..."
                                    className="pl-9 h-11 rounded-xl bg-white"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    className="h-11 rounded-xl border border-input bg-white px-3 text-sm font-bold"
                                    value={selectedLocation || ''}
                                    onChange={(e) => setSelectedLocation(Number(e.target.value))}
                                    disabled={!canSwitchLocation}
                                >
                                    {accessibleLocations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                                <select
                                    className="h-11 rounded-xl border border-input bg-white px-3 text-sm font-bold"
                                    value={selectedStaff || ''}
                                    onChange={(e) => setSelectedStaff(Number(e.target.value))}
                                >
                                    {staffList.map((staff) => (
                                        <option key={staff.id} value={staff.id}>{staff.user?.name || staff.name || `Staff #${staff.id}`}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {products.map((product) => (
                                <Card key={product.id} className="border border-brand-100/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    <CardContent className="p-0">
                                        <button
                                            type="button"
                                            onClick={() => addToCart(product)}
                                            className="w-full text-left"
                                        >
                                            <div className="aspect-square bg-white">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                        <Package className="h-12 w-12" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3 space-y-1">
                                                <p className="text-xs font-black line-clamp-2">{product.title}</p>
                                                {product.has_variants && (
                                                    <p className="text-[10px] font-bold text-violet-700 bg-violet-50 inline-flex px-2 py-0.5 rounded-full">
                                                        {product.variants?.length || 0} variants
                                                    </p>
                                                )}
                                                <p className="text-sm font-black text-brand-700">{productCardPriceText(product)}</p>
                                                <p className="text-[10px] text-muted-foreground">{productStockLabel(product, product.location_inventories?.[0]?.quantity_decimal ?? product.location_inventories?.[0]?.quantity ?? product.available_stock ?? product.inventory_quantity ?? product.inventory_count ?? 0)}</p>
                                            </div>
                                        </button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel: Cart & Checkout */}
                    <div className="w-[400px] bg-white border-l border-brand-50 flex-col shadow-2xl z-10">
                        {CartUI()}
                    </div>
                </div>

                {/* Mobile Content */}
                <div className="md:hidden p-4 pb-32 space-y-4">
                    <StaffContextChips />
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search product..."
                            className="pl-9 h-11 rounded-xl bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {products.map((product) => (
                            <button
                                key={product.id}
                                type="button"
                                onClick={() => addToCart(product)}
                                className="rounded-2xl border border-brand-100 bg-white overflow-hidden text-left shadow-sm"
                            >
                                <div className="aspect-square">
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300 bg-white">
                                            <Package className="h-10 w-10" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-2">
                                    <p className="text-[11px] font-black line-clamp-2">{product.title}</p>
                                    <p className="text-xs font-black text-brand-700">{productCardPriceText(product)}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mobile Floating Action Bar */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white border-t border-brand-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50 animate-in slide-in-from-bottom-full duration-500">
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-14 w-14 rounded-2xl border-brand-200 shrink-0"
                            onClick={() => {
                                setIsOrdersDrawerOpen(true);
                                setHasNewUpdate(false);
                            }}
                        >
                            <Inbox className="h-5 w-5 text-brand-600" />
                        </Button>
                        <Button 
                            className="flex-1 h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2"
                            onClick={() => setIsCartDrawerOpen(true)}
                        >
                            Review Order <ShoppingCart className="h-5 w-5" />
                            {cart.length > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-600 text-[10px] font-black">
                                    {cart.length}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Mobile Cart Drawer */}
                <Drawer open={isCartDrawerOpen} onOpenChange={setIsCartDrawerOpen}>
                    <DrawerContent className="h-[90vh] flex flex-col">
                        <div className="flex-1 overflow-hidden flex flex-col pt-4">
                            {CartUI({ isMobile: true })}
                        </div>
                    </DrawerContent>
                </Drawer>
            </div>

            {/* Checkout & Payment Modal */}
            <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
                <DialogContent className="sm:max-w-md rounded-[32px] overflow-hidden p-0 border-none shadow-2xl">
                    <div className="bg-brand-600 p-6 text-white">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black flex items-center gap-2 text-white">
                                <CreditCard className="h-6 w-6" /> Malipo & Uhakiki
                            </DialogTitle>
                            <DialogDescription className="text-white/80 font-medium">
                                Hakiki kiasi kilichopokelewa na idhinisha miamala.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Summary */}
                        <div className="bg-gray-50 p-4 rounded-2xl space-y-2 border border-brand-50">
                            <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                <span>Jumla ya Oda:</span>
                                <span>{formatCurrency(totalAmount)}</span>
                            </div>
                            {!hasTransferRequests && (
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm font-black">Kiasi kilichopokelewa:</span>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">TZS</span>
                                        <input
                                            type="number"
                                            value={amountPaid}
                                            onChange={(e) => setAmountPaid(e.target.value)}
                                            className="w-36 h-12 pl-10 pr-4 rounded-xl border border-brand-200 bg-white font-black text-right text-brand-600 focus:ring-2 focus:ring-brand-500 focus:outline-none shadow-sm"
                                        />
                                    </div>
                                </div>
                            )}
                            {!hasTransferRequests && (parseFloat(amountPaid) || 0) < totalAmount && (
                                <div className="pt-2 border-t border-dashed border-amber-200 mt-2">
                                    <p className="text-[10px] font-bold text-amber-700 leading-tight flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3 shrink-0" />
                                        Salio la {formatCurrency(totalAmount - (parseFloat(amountPaid) || 0))} litawekwa kama deni.
                                    </p>
                                </div>
                            )}
                            {requiresCustomerInfo && (!customerName.trim() || !customerPhone.trim()) && (
                                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1">
                                        <Info className="h-3 w-3 shrink-0" />
                                        Add customer name and phone before confirming this credit sale.
                                    </p>
                                </div>
                            )}
                            {hasTransferRequests && (
                                <div className="pt-2 border-t border-dashed border-sky-200 mt-2">
                                    <p className="text-[10px] font-bold text-sky-700 leading-tight mb-2 uppercase tracking-wider">
                                        Verify Transfer Quantities
                                    </p>
                                    <div className="space-y-1">
                                        {transferLines.map((line, idx) => (
                                            <div key={`${line.product_id}-${line.variant_id || 'na'}-${idx}`} className="flex items-center justify-between text-[11px]">
                                                <span className="font-semibold text-slate-700 truncate pr-2">{line.title}</span>
                                                <span className="font-black text-sky-700">{productQuantityLabel(line.product || line, line.quantity)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* PIN Approval or Remote */}
                        {requireManagerApproval && (
                            <div className="space-y-4 p-5 border-2 border-dashed border-amber-200 rounded-[28px] bg-amber-50/50">
                                {approvalRequested ? (
                                    <div className="text-center py-4 space-y-3">
                                        <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                                            <Smartphone className="h-6 w-6 text-amber-600" />
                                        </div>
                                        <p className="text-xs font-black text-amber-700 uppercase tracking-widest">Inasubiri Idhini...</p>
                                        <p className="text-[10px] text-amber-600 font-medium">Ombi limetumwa kwa Meneja. Unaweza kuendelea na mteja mwingine au kusubiri hapa.</p>
                                        <Button
                                            variant="outline"
                                            className="w-full rounded-xl border-amber-200 text-amber-700 font-bold"
                                            onClick={() => setIsCheckoutModalOpen(false)}
                                        >
                                            Funga na Kusubiri
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 text-amber-700">
                                            <ShieldCheck className="h-5 w-5" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Manager Approval Required</p>
                                        </div>
                                        <p className="text-[10px] text-amber-600 font-medium leading-tight">
                                            Punguzo kubwa au malipo ya advance yanahitaji idhini.
                                        </p>
                                        <Input
                                            type="password"
                                            placeholder="Enter Manager PIN"
                                            value={managerPin}
                                            onChange={(e) => setManagerPin(e.target.value)}
                                            className="h-12 rounded-xl text-center font-black tracking-[0.5em] text-lg border-amber-200 focus:ring-amber-500 bg-white"
                                            maxLength={4}
                                        />

                                        {(merchant.retail_settings?.allow_remote_approval !== false) && (
                                            <div className="pt-2">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="h-px flex-1 bg-amber-200"></div>
                                                    <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">au omba mbali</span>
                                                    <div className="h-px flex-1 bg-amber-200"></div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    className="w-full h-12 rounded-xl border border-amber-200 bg-white text-amber-700 font-black text-[10px] uppercase tracking-widest hover:bg-amber-100"
                                                    onClick={requestRemoteApproval}
                                                    disabled={requestingRemote}
                                                >
                                                    {requestingRemote ? 'Inatuma...' : 'Omba Idhini kwa Meneja (Remote)'}
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="rounded-xl flex-1 h-12 font-bold" onClick={() => setIsCheckoutModalOpen(false)}>
                                Ghairi
                            </Button>
                            <Button
                                className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl flex-1 h-12 font-black shadow-lg shadow-brand-600/20"
                                onClick={handleCheckout}
                                disabled={processing}
                            >
                                {processing ? 'Inachakata...' : (hasTransferRequests ? 'Tuma Ombi la Store' : 'Thibitisha')}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Floating Orders Bubble */}
            <div className="hidden md:block fixed bottom-6 left-6 z-[60]">
                <button
                    onClick={() => {
                        setIsOrdersDrawerOpen(true);
                        setHasNewUpdate(false);
                    }}
                    className={[
                        "h-16 w-16 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 group",
                        hasNewUpdate ? "bg-amber-500 animate-bounce" : "bg-brand-600",
                        pendingOrders.length > 0 ? "scale-110" : "scale-100"
                    ].join(' ')}
                >
                    <div className="relative">
                        <Inbox className="h-7 w-7 text-white" />
                        {pendingOrders.length > 0 && (
                            <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 border-2 border-white text-white text-[10px] font-black flex items-center justify-center shadow-md">
                                {pendingOrders.length}
                            </span>
                        )}
                        {hasNewUpdate && (
                            <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-25"></span>
                        )}
                    </div>
                </button>
            </div>

            {/* Pending Orders Drawer */}
            <Dialog open={isOrdersDrawerOpen} onOpenChange={setIsOrdersDrawerOpen}>
                <DialogContent className="sm:max-w-md h-[80vh] flex flex-col p-0 rounded-t-[40px] sm:rounded-[40px] border-none shadow-2xl overflow-hidden">
                    <div className="p-6 bg-brand-50/50 border-b border-brand-100">
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-xl font-black text-brand-900 flex items-center gap-2">
                                <History className="h-5 w-5 text-brand-600" />
                                Orders Hub
                            </DialogTitle>
                            <DialogDescription className="font-medium">Search pickup codes or manage pending approvals.</DialogDescription>
                        </DialogHeader>

                        {/* Search Pickup Code */}
                        <form onSubmit={handleLookupByCode} className="relative">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-400" />
                            <Input
                                placeholder="Enter Pickup Code (e.g. AB12XY)"
                                value={pickupCode}
                                onChange={(e) => setPickupCode(e.target.value.toUpperCase())}
                                className="h-12 pl-11 pr-24 rounded-xl border-brand-200 bg-white font-black text-brand-900 focus:ring-brand-500"
                            />
                            <Button
                                type="submit"
                                disabled={searchingCode || !pickupCode}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-black text-[10px] uppercase tracking-widest"
                            >
                                {searchingCode ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Search'}
                            </Button>
                        </form>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <div className="px-2 mb-2">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400">Pending Approvals</h4>
                        </div>

                        {fetchingOrders && pendingOrders.length === 0 ? (
                            <div className="py-12 text-center space-y-3">
                                <Loader2 className="h-8 w-8 text-brand-200 animate-spin mx-auto" />
                                <p className="text-xs text-muted-foreground font-medium">Checking for updates...</p>
                            </div>
                        ) : pendingOrders.length === 0 ? (
                            <div className="py-12 text-center space-y-3 border-2 border-dashed border-brand-50 rounded-[32px] bg-brand-50/20">
                                <Inbox className="h-8 w-8 text-brand-100 mx-auto" />
                                <p className="text-xs text-muted-foreground font-medium">Hakuna maombi yanayosubiri.</p>
                            </div>
                        ) : (
                            pendingOrders.map(order => (
                                <Card
                                    key={order.id}
                                    className="border-none shadow-sm hover:shadow-md transition-all rounded-[24px] bg-white border border-brand-50 cursor-pointer group active:scale-[0.98]"
                                    onClick={() => handleLoadOrder(order)}
                                >
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center border border-brand-100 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                                            {order.product?.image_url ? (
                                                <img src={order.product.image_url} className="h-full w-full object-cover rounded-2xl" />
                                            ) : (
                                                <Package className="h-6 w-6" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-brand-900">#POS-{order.public_id}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium truncate">{order.pos_staff?.user?.name || 'Staff'}</p>
                                            {transferStateMeta(order.transfer_summary) && (
                                                <span className={`inline-flex mt-1 text-[9px] font-black px-2 py-0.5 rounded-full ${transferStateMeta(order.transfer_summary).cls}`}>
                                                    {transferStateMeta(order.transfer_summary).label}
                                                    {transferProgressText(order.transfer_summary)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-brand-900">
                                                {formatCurrency(order.counter_total > 0 ? order.counter_total : order.grand_total)}
                                            </p>
                                            {order.approval_status === 'approved' ? (
                                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">Approved</span>
                                            ) : (
                                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase">Pending</span>
                                            )}
                                        </div>
                                        </div>
                                        {order.transfer_summary?.state === 'DISPATCHED' && (
                                            <div className="flex justify-end">
                                                {receivableTransferTasks(order).length > 0 ? (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        className="h-8 rounded-lg text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            confirmReceiptFromPending(order);
                                                        }}
                                                        disabled={processing}
                                                    >
                                                        Confirm Receipt
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        className="h-8 rounded-lg text-[10px] font-black bg-amber-600 hover:bg-amber-700 text-white"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toast.info(`Verify at ${transferDestinationLabel(order)}.`);
                                                        }}
                                                    >
                                                        Verify at {transferDestinationLabel(order)}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Success Modal */}
            <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
                <DialogContent className="sm:max-w-md rounded-[32px] border-none shadow-2xl p-0 overflow-hidden">
                    <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-center text-white">
                        <div className="h-20 w-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="h-10 w-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-black mb-2">Sale Completed!</h2>
                        <p className="text-white/80 text-sm">The transaction has been successfully recorded.</p>
                    </div>
                    <div className="p-8 text-center space-y-6">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Order ID</p>
                            <p className="text-2xl font-black text-brand-700">#POS-{lastOrder?.public_id}</p>
                        </div>

                        <div className="pt-4">
                            <Button
                                className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold"
                                onClick={() => setIsSuccessModalOpen(false)}
                            >
                                Continue to Next Sale
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Product Details & Variant Selection Drawer */}
            <Drawer open={!!selectedProductForDetails} onOpenChange={(open) => !open && setSelectedProductForDetails(null)}>
                <DrawerContent className="max-w-2xl mx-auto h-[85vh] flex flex-col p-0 rounded-t-[40px] border-none shadow-2xl overflow-hidden bg-slate-50">
                    {selectedProductForDetails && (
                        <>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {/* Header with Image */}
                                <div className="h-64 bg-white relative">
                                    <img
                                        src={selectedProductForDetails.image_url}
                                        className="h-full w-full object-contain p-4"
                                    />
                                    <button
                                        className="absolute top-6 right-6 h-10 w-10 rounded-full bg-slate-100/80 backdrop-blur-md flex items-center justify-center text-slate-500"
                                        onClick={() => setSelectedProductForDetails(null)}
                                    >
                                        <Plus className="h-5 w-5 rotate-45" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Title & Price */}
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 leading-tight">{selectedProductForDetails.title}</h2>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-2xl font-black text-brand-600">
                                                {formatCurrency(selectedVariant?.price || selectedProductForDetails.discounted_price || selectedProductForDetails.price)}
                                            </span>
                                            {(selectedProductForDetails.compare_at_price > 0) && (
                                                <span className="text-sm font-bold text-slate-400 line-through">
                                                    {formatCurrency(selectedProductForDetails.compare_at_price)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {selectedProductForDetails.description && (
                                        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-2">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                                <div className="h-1 w-1 rounded-full bg-brand-500" /> Maelezo ya Bidhaa
                                            </h4>
                                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                                {selectedProductForDetails.description}
                                            </p>
                                        </div>
                                    )}

                                    {/* Categorization & Brand Info - Now as Pills */}
                                    <div className="flex flex-wrap gap-2">
                                        {selectedProductForDetails.attributes?.category && (
                                            <div className="px-4 py-2.5 rounded-2xl bg-brand-50/30 border border-brand-100/50 flex items-center gap-2 shadow-sm">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Kategoria:</span>
                                                <span className="text-[11px] font-black text-brand-700">{selectedProductForDetails.attributes.category}</span>
                                            </div>
                                        )}
                                        {selectedProductForDetails.attributes?.brand_name && (
                                            <div className="px-4 py-2.5 rounded-2xl bg-brand-50/30 border border-brand-100/50 flex items-center gap-2 shadow-sm">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Brand:</span>
                                                <span className="text-[11px] font-black text-brand-700">{selectedProductForDetails.attributes.brand_name}</span>
                                            </div>
                                        )}
                                        {selectedProductForDetails.attributes?.model_name && (
                                            <div className="px-4 py-2.5 rounded-2xl bg-brand-50/30 border border-brand-100/50 flex items-center gap-2 shadow-sm">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Model:</span>
                                                <span className="text-[11px] font-black text-brand-700">{selectedProductForDetails.attributes.model_name}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Specs (Premium Pills Layout) */}
                                    {((selectedProductForDetails.category_attribute_values && selectedProductForDetails.category_attribute_values.length > 0) || 
                                      (selectedProductForDetails.attributes?.ai_extracted && Object.keys(selectedProductForDetails.attributes.ai_extracted).length > 0)) && (
                                        <div className="space-y-4 pt-2 border-t border-slate-100 pt-6">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-brand-600 flex items-center gap-2">
                                                SIFA ZA BIDHAA (SPECIFICATION)
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {/* Priority: Category Attribute Values (Verified) */}
                                                {selectedProductForDetails.category_attribute_values?.map((attrVal, idx) => {
                                                    const unit = attrVal.value_json?.unit || '';
                                                    const val = attrVal.value_text || attrVal.value_number || String(attrVal.value_boolean || '');
                                                    
                                                    return (
                                                        <div key={`v-${idx}`} className="px-4 py-2.5 rounded-2xl bg-brand-50/30 border border-brand-100/50 flex items-center gap-2 shadow-sm">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{attrVal.attribute?.label || attrVal.attribute?.key}:</span>
                                                            <span className="text-[11px] font-black text-brand-700">{val} {unit}</span>
                                                        </div>
                                                    );
                                                })}

                                                {/* Fallback/Additional: AI Extracted */}
                                                {(!selectedProductForDetails.category_attribute_values || selectedProductForDetails.category_attribute_values.length === 0) && 
                                                  selectedProductForDetails.attributes?.ai_extracted && 
                                                  Object.entries(selectedProductForDetails.attributes.ai_extracted).map(([key, val], idx) => (
                                                    <div key={`ai-${idx}`} className="px-4 py-2.5 rounded-2xl bg-brand-50/30 border border-brand-100/50 flex items-center gap-2 shadow-sm">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{key.replace(/_/g, ' ')}:</span>
                                                        <span className="text-[11px] font-black text-brand-700">{String(val)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Variant Selection */}
                                    {selectedProductForDetails.has_variants && (
                                        <div className="space-y-4 pt-2">
                                            <div className="flex items-center justify-between ml-1">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-500">Chagua Tofauti (Variants)</h4>
                                                <span className="text-[10px] font-bold text-slate-400">{selectedProductForDetails.variants?.length} Options</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                {selectedProductForDetails.variants.map((variant) => {
                                                    const isSelected = selectedVariant?.id === variant.id;
                                                    const isOutOfStock = (variant.inventory_count || 0) <= 0;

                                                    return (
                                                        <button
                                                            key={variant.id}
                                                            disabled={isOutOfStock}
                                                            onClick={() => setSelectedVariant(variant)}
                                                            className={cn(
                                                                "p-4 rounded-3xl border-2 transition-all flex flex-col items-start gap-1 relative overflow-hidden",
                                                                isSelected
                                                                    ? "border-brand-500 bg-brand-50/50 shadow-md"
                                                                    : "border-slate-100 bg-white hover:border-brand-200",
                                                                isOutOfStock && "opacity-50 grayscale cursor-not-allowed"
                                                            )}
                                                        >
                                                            <span className="text-xs font-black text-slate-900">{variantDisplayLabel(variant, selectedProductForDetails.title)}</span>
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className="text-[10px] font-bold text-brand-600">{formatCurrency(variant.price || selectedProductForDetails.price)}</span>
                                                                <span className={cn(
                                                                    "text-[8px] font-black px-1.5 py-0.5 rounded-lg",
                                                                    isOutOfStock ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"
                                                                )}>
                                                                    {isOutOfStock ? 'OUT' : `${variant.inventory_count} IN`}
                                                                </span>
                                                            </div>
                                                            {isSelected && (
                                                                <div className="absolute top-1 right-1 h-5 w-5 bg-brand-600 rounded-full flex items-center justify-center text-white shadow-sm">
                                                                    <Check className="h-3 w-3" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 bg-white border-t border-slate-100">
                                <Button
                                    className="w-full h-16 rounded-[2rem] bg-brand-600 hover:bg-brand-700 text-white text-lg font-black shadow-xl shadow-brand-600/20 transition-all active:scale-95 disabled:grayscale"
                                    disabled={selectedProductForDetails.has_variants && !selectedVariant}
                                    onClick={() => addToCart(selectedProductForDetails, selectedVariant)}
                                >
                                    {selectedProductForDetails.has_variants && !selectedVariant ? 'Select a Variant' : `ADD TO CART — ${formatCurrency(selectedVariant?.price || selectedProductForDetails.discounted_price || selectedProductForDetails.price)}`}
                                </Button>
                            </div>
                        </>
                    )}
                </DrawerContent>
            </Drawer>
        </AppLayout>
    );
}
