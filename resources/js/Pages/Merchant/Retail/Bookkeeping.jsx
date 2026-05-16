import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Banknote,
    BookOpenCheck,
    Calculator,
    CheckCircle2,
    ClipboardList,
    Download,
    FileCheck2,
    FileText,
    Landmark,
    LockKeyhole,
    Pencil,
    Plus,
    ReceiptText,
    Search,
    SlidersHorizontal,
    ShieldCheck,
    Upload,
    WalletCards,
    X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/Components/ui/Dialog';
import { toast } from 'sonner';

const emptyForm = {
    entry_type: 'expense',
    category: 'Stock Purchases',
    counterparty: '',
    amount: '',
    payment_method: 'cash',
    reference_type: 'efd_receipt',
    reference_number: '',
    tax_type: '',
    tax_period: '',
    transaction_date: new Date().toISOString().slice(0, 10),
    proof_status: '',
    reconciliation_status: 'unmatched',
    statement_reference: '',
    description: '',
    attachment: null,
};

const emptyOpeningBalance = {
    as_of_date: new Date().toISOString().slice(0, 10),
    cash_balance: '',
    bank_balance: '',
    mobile_money_balance: '',
    stock_value: '',
    director_loan_balance: '',
    accounts_receivable: '',
    accounts_payable: '',
    note: '',
};

const emptyAccountItem = {
    item_type: 'receivable',
    counterparty: '',
    category: '',
    amount: '',
    invoice_number: '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    description: '',
    attachment: null,
};

const emptySettlement = {
    paid_amount: '',
    payment_method: 'cash',
    reference_type: 'invoice',
    reference_number: '',
    transaction_date: new Date().toISOString().slice(0, 10),
    proof_status: '',
    reconciliation_status: 'unmatched',
    statement_reference: '',
    description: '',
    attachment: null,
};

const emptyAdjustment = {
    entry_type: 'expense',
    adjustment_reason: 'stock_count',
    adjustment_account: 'Inventory',
    counterparty: '',
    amount: '',
    reference_type: 'other',
    reference_number: '',
    transaction_date: new Date().toISOString().slice(0, 10),
    proof_status: '',
    reconciliation_status: 'needs_review',
    statement_reference: '',
    description: '',
    attachment: null,
};

const emptyStatementImport = {
    source_type: 'bank',
    source_name: '',
    statement: null,
};

const emptyStatementLine = {
    source_type: 'mobile_money',
    source_name: '',
    transaction_date: new Date().toISOString().slice(0, 10),
    line_type: 'credit',
    amount: '',
    reference_number: '',
    counterparty: '',
    description: '',
    attachment: null,
};

const emptyObligation = {
    title: '',
    obligation_type: 'annual_return',
    authority: '',
    due_date: new Date().toISOString().slice(0, 10),
    remind_days_before: 14,
    sms_reminder_enabled: true,
    reference_number: '',
    description: '',
};

const emptyRecurringBill = {
    vendor: '',
    category: 'Rent',
    amount: '',
    frequency: 'monthly',
    next_due_date: new Date().toISOString().slice(0, 10),
    remind_days_before: 7,
    sms_reminder_enabled: true,
    payment_method: 'bank',
    reference_type: 'invoice',
    description: '',
};

const emptyPayroll = {
    worker_name: '',
    worker_type: 'employee',
    role: '',
    gross_amount: '',
    deductions_amount: '',
    pay_period: new Date().toISOString().slice(0, 7),
    pay_date: new Date().toISOString().slice(0, 10),
    payment_method: 'bank',
    reference_number: '',
    tax_type: 'PAYE',
    description: '',
    attachment: null,
};

const emptyShareLink = {
    recipient_name: '',
    recipient_role: 'accountant',
    from_date: '',
    to_date: '',
    expires_at: '',
    pin: '',
    include_proofs: true,
    allow_downloads: false,
};

const typeLabels = {
    income: 'Income',
    expense: 'Expense',
    director_loan: 'Director Loan',
    tax_payment: 'Tax Payment',
};

const paymentMethods = [
    ['cash', 'Cash'],
    ['bank', 'Bank'],
    ['mobile_money', 'Mobile Money'],
    ['card', 'Card'],
    ['takeer_wallet', 'Takeer Wallet'],
    ['director_loan', 'Loan from Director'],
    ['other', 'Other'],
];

const referenceTypes = [
    ['efd_receipt', 'EFD Receipt'],
    ['bank_transaction', 'Bank Transaction'],
    ['mobile_money', 'Mobile Money Ref'],
    ['invoice', 'Invoice'],
    ['tra_payment', 'TRA Payment'],
    ['contract', 'Contract'],
    ['other', 'Other'],
];

const proofStatuses = [
    ['attached', 'Proof attached'],
    ['reference_only', 'Reference only'],
    ['missing', 'Missing proof'],
    ['needs_replacement', 'Needs replacement'],
];

const reviewStatuses = [
    ['pending', 'Pending review'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
];

const reconciliationStatuses = [
    ['unmatched', 'Unmatched'],
    ['matched', 'Matched'],
    ['needs_review', 'Needs review'],
];

export default function Bookkeeping({ merchant }) {
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ q: '', type: '', status: 'active', proof_status: '', review_status: '', reconciliation_status: '' });
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [voidingEntry, setVoidingEntry] = useState(null);
    const [voidReason, setVoidReason] = useState('');
    const [locking, setLocking] = useState(false);
    const [periodKey, setPeriodKey] = useState(new Date().toISOString().slice(0, 7));
    const [isOpeningOpen, setIsOpeningOpen] = useState(false);
    const [openingForm, setOpeningForm] = useState(emptyOpeningBalance);
    const [savingOpening, setSavingOpening] = useState(false);
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [accountForm, setAccountForm] = useState(emptyAccountItem);
    const [savingAccount, setSavingAccount] = useState(false);
    const [settlingItem, setSettlingItem] = useState(null);
    const [settlementForm, setSettlementForm] = useState(emptySettlement);
    const [savingSettlement, setSavingSettlement] = useState(false);
    const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
    const [adjustmentForm, setAdjustmentForm] = useState(emptyAdjustment);
    const [savingAdjustment, setSavingAdjustment] = useState(false);
    const [isStatementOpen, setIsStatementOpen] = useState(false);
    const [statementMode, setStatementMode] = useState('manual');
    const [statementForm, setStatementForm] = useState(emptyStatementImport);
    const [statementLineForm, setStatementLineForm] = useState(emptyStatementLine);
    const [savingStatement, setSavingStatement] = useState(false);
    const [matchingEntryIds, setMatchingEntryIds] = useState({});
    const [accountCategoryCustom, setAccountCategoryCustom] = useState(false);
    const [isObligationOpen, setIsObligationOpen] = useState(false);
    const [obligationForm, setObligationForm] = useState(emptyObligation);
    const [savingObligation, setSavingObligation] = useState(false);
    const [isBillOpen, setIsBillOpen] = useState(false);
    const [billForm, setBillForm] = useState(emptyRecurringBill);
    const [savingBill, setSavingBill] = useState(false);
    const [payingBillId, setPayingBillId] = useState(null);
    const [isPayrollOpen, setIsPayrollOpen] = useState(false);
    const [payrollForm, setPayrollForm] = useState(emptyPayroll);
    const [savingPayroll, setSavingPayroll] = useState(false);
    const [payingPayrollId, setPayingPayrollId] = useState(null);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [shareForm, setShareForm] = useState(emptyShareLink);
    const [savingShare, setSavingShare] = useState(false);

    const currency = merchant.currency?.code || 'TZS';

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const res = await window.axios.get('/api/retail/bookkeeping', {
                params: { merchant_id: merchant.id, ...filters },
            });
            setPayload(res.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load bookkeeping records.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEntries();
    }, [filters.type, filters.status, filters.proof_status, filters.review_status, filters.reconciliation_status]);

    const categories = useMemo(() => payload?.categories?.[form.entry_type] || [], [payload, form.entry_type]);

    const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(Number(value || 0));

    const openCreate = () => {
        setEditingEntry(null);
        setForm({ ...emptyForm });
        setIsFormOpen(true);
    };

    const openTaxPayment = (wizard) => {
        const currentPeriod = new Date().toISOString().slice(0, 7);
        setEditingEntry(null);
        setForm({
            ...emptyForm,
            entry_type: 'tax_payment',
            category: wizard.payment_category || wizard.label || 'Other Tax',
            counterparty: 'Tax Authority',
            payment_method: 'bank',
            reference_type: 'tra_payment',
            tax_type: wizard.tax_type || wizard.label || '',
            tax_period: currentPeriod,
            transaction_date: new Date().toISOString().slice(0, 10),
            description: `${wizard.label} payment for ${currentPeriod}`,
        });
        setIsFormOpen(true);
    };

    const openEdit = (entry) => {
        setEditingEntry(entry);
        setForm({
            entry_type: entry.entry_type,
            category: entry.category,
            counterparty: entry.counterparty || '',
            amount: entry.amount,
            payment_method: entry.payment_method,
            reference_type: entry.reference_type || '',
            reference_number: entry.reference_number || '',
            tax_type: entry.tax_type || '',
            tax_period: entry.tax_period || '',
            transaction_date: entry.transaction_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            proof_status: entry.proof_status || '',
            reconciliation_status: entry.reconciliation_status || 'unmatched',
            statement_reference: entry.statement_reference || '',
            description: entry.description || '',
            attachment: null,
        });
        setIsFormOpen(true);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);

        const formData = new FormData();
        Object.entries(form).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                formData.append(key, value);
            }
        });

        try {
            if (editingEntry) {
                formData.append('_method', 'PUT');
                await window.axios.post(`/api/retail/bookkeeping/${editingEntry.id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                toast.success('Record updated with audit history.');
            } else {
                await window.axios.post('/api/retail/bookkeeping', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                toast.success('Record saved.');
            }
            setIsFormOpen(false);
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not save record.');
        } finally {
            setSaving(false);
        }
    };

    const handleVoid = async () => {
        if (!voidingEntry || !voidReason.trim()) return;
        try {
            await window.axios.post(`/api/retail/bookkeeping/${voidingEntry.id}/void`, {
                reason: voidReason,
                merchant_id: merchant.id,
            });
            toast.success('Record voided and preserved in audit trail.');
            setVoidingEntry(null);
            setVoidReason('');
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not void record.');
        }
    };

    const handleReview = async (entry, reviewStatus) => {
        try {
            await window.axios.post(`/api/retail/bookkeeping/${entry.id}/review`, {
                merchant_id: merchant.id,
                review_status: reviewStatus,
            });
            toast.success('Review status updated.');
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update review status.');
        }
    };

    const handleReconcile = async (entry, reconciliationStatus) => {
        try {
            await window.axios.post(`/api/retail/bookkeeping/${entry.id}/reconcile`, {
                merchant_id: merchant.id,
                reconciliation_status: reconciliationStatus,
                statement_reference: entry.statement_reference || entry.reference_number || '',
            });
            toast.success('Reconciliation status updated.');
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update reconciliation status.');
        }
    };

    const handleLockPeriod = async () => {
        setLocking(true);
        try {
            await window.axios.post('/api/retail/bookkeeping/period-locks', {
                merchant_id: merchant.id,
                period_key: periodKey,
                note: 'Period reviewed and locked from Retail Ops Bookkeeping.',
            });
            toast.success(`${periodKey} locked.`);
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not lock period.');
        } finally {
            setLocking(false);
        }
    };

    const openOpeningBalance = () => {
        const opening = payload?.opening_balance;
        setOpeningForm(opening ? {
            as_of_date: opening.as_of_date?.slice(0, 10) || emptyOpeningBalance.as_of_date,
            cash_balance: opening.cash_balance || '',
            bank_balance: opening.bank_balance || '',
            mobile_money_balance: opening.mobile_money_balance || '',
            stock_value: opening.stock_value || '',
            director_loan_balance: opening.director_loan_balance || '',
            accounts_receivable: opening.accounts_receivable || '',
            accounts_payable: opening.accounts_payable || '',
            note: opening.note || '',
        } : { ...emptyOpeningBalance });
        setIsOpeningOpen(true);
    };

    const handleOpeningSubmit = async (event) => {
        event.preventDefault();
        setSavingOpening(true);
        try {
            await window.axios.post('/api/retail/bookkeeping/opening-balance', {
                merchant_id: merchant.id,
                ...openingForm,
            });
            toast.success('Opening balances saved.');
            setIsOpeningOpen(false);
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not save opening balances.');
        } finally {
            setSavingOpening(false);
        }
    };

    const openAccountItem = (itemType = 'receivable') => {
        const defaultCategory = itemType === 'receivable'
            ? (payload?.categories?.income?.[0] || '')
            : (payload?.categories?.expense?.[0] || '');
        setAccountForm({ ...emptyAccountItem, item_type: itemType, category: defaultCategory });
        setAccountCategoryCustom(false);
        setIsAccountOpen(true);
    };

    const handleAccountSubmit = async (event) => {
        event.preventDefault();
        setSavingAccount(true);

        const formData = new FormData();
        Object.entries(accountForm).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                formData.append(key, value);
            }
        });
        formData.append('merchant_id', merchant.id);

        try {
            await window.axios.post('/api/retail/bookkeeping/account-items', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success(accountForm.item_type === 'receivable' ? 'Receivable saved.' : 'Payable saved.');
            setIsAccountOpen(false);
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not save account item.');
        } finally {
            setSavingAccount(false);
        }
    };

    const openSettlement = (item) => {
        setSettlingItem(item);
        setSettlementForm({
            ...emptySettlement,
            paid_amount: item.balance_due || item.amount,
            reference_number: item.invoice_number || '',
            description: item.item_type === 'receivable' ? `Collection for ${item.invoice_number || item.counterparty}` : `Payment for ${item.invoice_number || item.counterparty}`,
        });
    };

    const handleSettlementSubmit = async (event) => {
        event.preventDefault();
        if (!settlingItem) return;
        setSavingSettlement(true);

        const formData = new FormData();
        Object.entries(settlementForm).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                formData.append(key, value);
            }
        });
        formData.append('merchant_id', merchant.id);

        try {
            await window.axios.post(`/api/retail/bookkeeping/account-items/${settlingItem.id}/settle`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success(settlingItem.item_type === 'receivable' ? 'Collection recorded.' : 'Payment recorded.');
            setSettlingItem(null);
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not settle account item.');
        } finally {
            setSavingSettlement(false);
        }
    };

    const openAdjustment = () => {
        setAdjustmentForm({ ...emptyAdjustment });
        setIsAdjustmentOpen(true);
    };

    const handleAdjustmentSubmit = async (event) => {
        event.preventDefault();
        setSavingAdjustment(true);

        const formData = new FormData();
        Object.entries(adjustmentForm).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                formData.append(key, value);
            }
        });
        formData.append('merchant_id', merchant.id);

        try {
            await window.axios.post('/api/retail/bookkeeping/adjustments', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Adjustment saved for review.');
            setIsAdjustmentOpen(false);
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not save adjustment.');
        } finally {
            setSavingAdjustment(false);
        }
    };

    const handleStatementImport = async (event) => {
        event.preventDefault();
        if (!statementForm.statement) return;
        setSavingStatement(true);

        const formData = new FormData();
        formData.append('merchant_id', merchant.id);
        formData.append('source_type', statementForm.source_type);
        if (statementForm.source_name) formData.append('source_name', statementForm.source_name);
        formData.append('statement', statementForm.statement);

        try {
            const res = await window.axios.post('/api/retail/bookkeeping/statements/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success(res.data?.message || 'Statement imported.');
            setIsStatementOpen(false);
            setStatementForm({ ...emptyStatementImport });
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not import statement.');
        } finally {
            setSavingStatement(false);
        }
    };

    const handleStatementLineSubmit = async (event) => {
        event.preventDefault();
        setSavingStatement(true);

        const formData = new FormData();
        formData.append('merchant_id', merchant.id);
        Object.entries(statementLineForm).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                formData.append(key, value);
            }
        });

        try {
            const res = await window.axios.post('/api/retail/bookkeeping/statements/manual', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success(res.data?.message || 'Statement line added.');
            setIsStatementOpen(false);
            setStatementLineForm({ ...emptyStatementLine });
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not add statement line.');
        } finally {
            setSavingStatement(false);
        }
    };

    const handleStatementMatch = async (line) => {
        const entryId = matchingEntryIds[line.id];
        if (!entryId) return;

        try {
            await window.axios.post(`/api/retail/bookkeeping/statements/${line.id}/match`, {
                merchant_id: merchant.id,
                entry_id: entryId,
            });
            toast.success('Statement line matched.');
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not match statement line.');
        }
    };

    const handleStatementIgnore = async (line) => {
        try {
            await window.axios.post(`/api/retail/bookkeeping/statements/${line.id}/ignore`, {
                merchant_id: merchant.id,
            });
            toast.success('Statement line ignored.');
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not ignore statement line.');
        }
    };

    const handleObligationSubmit = async (event) => {
        event.preventDefault();
        setSavingObligation(true);
        try {
            await window.axios.post('/api/retail/bookkeeping/obligations', {
                merchant_id: merchant.id,
                ...obligationForm,
            });
            toast.success('Business reminder saved.');
            setIsObligationOpen(false);
            setObligationForm({ ...emptyObligation });
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not save reminder.');
        } finally {
            setSavingObligation(false);
        }
    };

    const handleObligationComplete = async (obligation) => {
        try {
            await window.axios.post(`/api/retail/bookkeeping/obligations/${obligation.id}/complete`, {
                merchant_id: merchant.id,
            });
            toast.success('Reminder completed.');
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not complete reminder.');
        }
    };

    const handleBillSubmit = async (event) => {
        event.preventDefault();
        setSavingBill(true);
        try {
            await window.axios.post('/api/retail/bookkeeping/recurring-bills', {
                merchant_id: merchant.id,
                ...billForm,
            });
            toast.success('Recurring bill saved.');
            setIsBillOpen(false);
            setBillForm({ ...emptyRecurringBill });
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not save recurring bill.');
        } finally {
            setSavingBill(false);
        }
    };

    const handleBillPay = async (bill) => {
        setPayingBillId(bill.id);
        try {
            await window.axios.post(`/api/retail/bookkeeping/recurring-bills/${bill.id}/pay`, {
                merchant_id: merchant.id,
                transaction_date: new Date().toISOString().slice(0, 10),
            });
            toast.success('Bill posted to expenses.');
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not post bill.');
        } finally {
            setPayingBillId(null);
        }
    };

    const handlePayrollSubmit = async (event) => {
        event.preventDefault();
        setSavingPayroll(true);

        const formData = new FormData();
        formData.append('merchant_id', merchant.id);
        Object.entries(payrollForm).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                formData.append(key, value);
            }
        });

        try {
            await window.axios.post('/api/retail/bookkeeping/payroll', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Payroll record saved.');
            setIsPayrollOpen(false);
            setPayrollForm({ ...emptyPayroll });
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not save payroll.');
        } finally {
            setSavingPayroll(false);
        }
    };

    const handlePayrollPay = async (payroll) => {
        setPayingPayrollId(payroll.id);
        try {
            await window.axios.post(`/api/retail/bookkeeping/payroll/${payroll.id}/pay`, {
                merchant_id: merchant.id,
            });
            toast.success('Payroll posted to expenses.');
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not post payroll.');
        } finally {
            setPayingPayrollId(null);
        }
    };

    const handleShareSubmit = async (event) => {
        event.preventDefault();
        setSavingShare(true);
        try {
            const res = await window.axios.post('/api/retail/bookkeeping/share-links', {
                merchant_id: merchant.id,
                ...shareForm,
                sections: ['summary', 'records', 'proofs', 'reports'],
            });
            await navigator.clipboard?.writeText(res.data?.url || '');
            toast.success('Share link created and copied.');
            setIsShareOpen(false);
            setShareForm({ ...emptyShareLink });
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not create share link.');
        } finally {
            setSavingShare(false);
        }
    };

    const handleShareRevoke = async (link) => {
        try {
            await window.axios.post(`/api/retail/bookkeeping/share-links/${link.id}/revoke`, {
                merchant_id: merchant.id,
            });
            toast.success('Share link revoked.');
            fetchEntries();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not revoke share link.');
        }
    };

    const openRecommendedReminder = (template) => {
        setObligationForm({
            ...emptyObligation,
            title: template.title || '',
            obligation_type: template.type || 'custom',
            authority: template.authority || '',
            remind_days_before: template.remind_days_before ?? 14,
            description: template.description || '',
        });
        setIsObligationOpen(true);
    };

    const exportParams = new URLSearchParams({ merchant_id: merchant.id });
    Object.entries(filters).forEach(([key, value]) => {
        if (value) exportParams.set(key, value);
    });
    const exportUrl = `/api/retail/bookkeeping/export?${exportParams.toString()}`;
    const reportUrl = (report) => `/api/retail/bookkeeping/reports/${report}?${exportParams.toString()}`;
    const taxWizardUrl = (wizard) => `/api/retail/bookkeeping/tax-wizards/${wizard}/export?${exportParams.toString()}`;
    const auditPackUrl = `/api/retail/bookkeeping/audit-pack?${exportParams.toString()}`;
    const downloadFile = async (url, fallbackName) => {
        try {
            const response = await window.axios.get(url, {
                responseType: 'blob',
                headers: { Accept: 'application/octet-stream' },
            });
            const disposition = response.headers?.['content-disposition'] || '';
            const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
            const filename = match ? decodeURIComponent(match[1]) : fallbackName;
            const blobUrl = window.URL.createObjectURL(new Blob([response.data], {
                type: response.headers?.['content-type'] || 'application/octet-stream',
            }));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not download file.');
        }
    };
    const entries = payload?.entries?.data || [];
    const summary = payload?.summary || {};
    const opening = payload?.opening_balance;
    const accountItems = payload?.accounts?.recent || [];
    const accountSummary = payload?.accounts?.summary || {};
    const adjustmentReasons = payload?.adjustment_reasons || [];
    const statementReconciliation = payload?.statement_reconciliation || {};
    const statementLines = statementReconciliation.unmatched_lines || [];
    const statementCandidates = statementReconciliation.candidate_entries || [];
    const statementSuggestions = statementReconciliation.suggestions || {};
    const statementSummary = statementReconciliation.summary || {};
    const taxWizardPack = payload?.tax_wizards || {};
    const taxWizards = taxWizardPack.wizards || [];
    const taxCountry = taxWizardPack.country;
    const businessTools = payload?.business_tools || {};
    const toolSummary = businessTools.summary || {};
    const obligations = businessTools.obligations || [];
    const recurringBills = businessTools.recurring_bills || [];
    const payrollRecords = businessTools.payroll || [];
    const shareLinks = businessTools.share_links || [];
    const recommendedSetup = businessTools.recommended_setup || [];
    const accountCategoryOptions = accountForm.item_type === 'receivable'
        ? (payload?.categories?.income || [])
        : (payload?.categories?.expense || []);

    return (
        <AppLayout>
            <Head title="Bookkeeping | Takeer Retail Ops" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-xl shrink-0"
                            onClick={() => router.visit(`/merchant/${merchant.username}/retail/dashboard`)}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                                Bookkeeping <BookOpenCheck className="h-8 w-8 text-brand-600" />
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Business records for income, expenses, receipts etc.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white" onClick={openCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Record
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 flex gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white text-emerald-700 grid place-items-center border border-emerald-100 shrink-0">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-emerald-950">Audit-supportive records</p>
                        <p className="text-xs font-semibold text-emerald-800 mt-1">
                            Every create, edit, and void action is written to the business audit trail with user, staff, timestamp, and before/after values.
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quick actions</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mt-3">
                        <QuickAction onClick={openOpeningBalance} icon={Calculator} label="Opening" />
                        <QuickAction onClick={() => openAccountItem('receivable')} icon={ClipboardList} label="Invoice" />
                        <QuickAction onClick={() => openAccountItem('payable')} icon={ReceiptText} label="Bill" />
                        <QuickAction onClick={openAdjustment} icon={SlidersHorizontal} label="Adjust" />
                        <QuickAction onClick={() => setIsStatementOpen(true)} icon={Upload} label="Statement" />
                        <QuickAction onClick={() => setIsObligationOpen(true)} icon={FileCheck2} label="Reminder" />
                        <QuickAction onClick={() => setIsPayrollOpen(true)} icon={WalletCards} label="Payroll" />
                        <QuickAction onClick={() => setIsShareOpen(true)} icon={ShieldCheck} label="Share" />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit readiness</p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                            <ReadinessStat label="Pending review" value={summary.pending_review || 0} />
                            <ReadinessStat label="Unmatched" value={summary.unmatched || 0} />
                            <ReadinessStat label="Missing refs" value={summary.missing_references || 0} />
                            <ReadinessStat label="Adjustments" value={summary.adjustments || 0} />
                            <ReadinessStat label="Statement lines" value={summary.statement_unmatched || 0} />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2">
                            <LockKeyhole className="h-4 w-4 text-slate-600" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lock reviewed month</p>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <Input type="month" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} className="rounded-xl" />
                            <Button variant="outline" className="rounded-xl shrink-0" onClick={handleLockPeriod} disabled={locking}>
                                {locking ? 'Locking...' : 'Lock'}
                            </Button>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-500 mt-2">
                            Locked months reject edits, voids, and back-dated records.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <SummaryTile icon={Banknote} label="Income" value={formatCurrency(summary.income)} color="text-emerald-700" />
                    <SummaryTile icon={ReceiptText} label="Expenses" value={formatCurrency(summary.expenses)} color="text-red-700" />
                    <SummaryTile icon={Landmark} label="Tax Paid" value={formatCurrency(summary.tax_payments)} color="text-sky-700" />
                    <SummaryTile icon={WalletCards} label="Director Loans" value={formatCurrency(summary.director_loans)} color="text-violet-700" />
                    <SummaryTile icon={FileText} label="Missing Proofs" value={`${summary.missing_attachments || 0}`} color="text-amber-700" />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Needs attention</p>
                            <p className="text-xs font-semibold text-slate-500 mt-1">
                                What is due soon, overdue, pending, or shared from the business records.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                        <ReadinessStat label="Due Soon" value={toolSummary.obligations_due_soon || 0} />
                        <ReadinessStat label="Overdue" value={toolSummary.overdue_obligations || 0} />
                        <ReadinessStat label="Bills Due" value={toolSummary.bills_due_soon || 0} />
                        <ReadinessStat label="Payroll Pending" value={toolSummary.pending_payroll || 0} />
                        <ReadinessStat label="Share Links" value={toolSummary.active_share_links || 0} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
                        <BusinessList
                            title="Recommended setup"
                            empty="No setup templates for this country."
                            items={recommendedSetup}
                            render={(item) => (
                                <BusinessRow
                                    key={item.key}
                                    title={item.title}
                                    meta={`${item.authority || 'Authority'} • ${item.suggested_frequency || 'set date'}`}
                                    actionLabel="Set"
                                    onAction={() => openRecommendedReminder(item)}
                                />
                            )}
                        />
                        <BusinessList
                            title="Upcoming obligations"
                            empty="No reminders yet."
                            items={obligations}
                            render={(item) => (
                                <BusinessRow
                                    key={item.id}
                                    title={item.title}
                                    meta={`${item.authority || item.obligation_type} • due ${item.due_date?.slice(0, 10)}`}
                                    actionLabel="Done"
                                    onAction={() => handleObligationComplete(item)}
                                />
                            )}
                        />
                        <BusinessList
                            title="Recurring bills"
                            empty="No recurring bills yet."
                            items={recurringBills}
                            render={(item) => (
                                <BusinessRow
                                    key={item.id}
                                    title={item.vendor}
                                    meta={`${formatCurrency(item.amount)} • ${item.frequency} • next ${item.next_due_date?.slice(0, 10)}`}
                                    actionLabel={payingBillId === item.id ? 'Posting...' : 'Pay'}
                                    onAction={() => handleBillPay(item)}
                                />
                            )}
                        />
                        <BusinessList
                            title="Payroll lite"
                            empty="No payroll records yet."
                            items={payrollRecords}
                            render={(item) => (
                                <BusinessRow
                                    key={item.id}
                                    title={item.worker_name}
                                    meta={`${formatCurrency(item.net_amount)} • ${item.pay_period} • ${item.status}`}
                                    actionLabel={item.status === 'paid' ? 'Paid' : (payingPayrollId === item.id ? 'Posting...' : 'Pay')}
                                    onAction={() => item.status !== 'paid' && handlePayrollPay(item)}
                                    disabled={item.status === 'paid'}
                                />
                            )}
                        />
                        <BusinessList
                            title="Shared access"
                            empty="No share links yet."
                            items={shareLinks}
                            render={(item) => (
                                <BusinessRow
                                    key={item.id}
                                    title={item.recipient_name || item.recipient_role}
                                    meta={`${item.access_count || 0} views • ${item.expires_at ? `expires ${item.expires_at.slice(0, 10)}` : 'no expiry'}`}
                                    actionLabel="Copy"
                                    onAction={() => {
                                        navigator.clipboard?.writeText(item.url);
                                        toast.success('Share link copied.');
                                    }}
                                    secondaryLabel={item.status === 'active' ? 'Revoke' : null}
                                    onSecondary={() => handleShareRevoke(item)}
                                />
                            )}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Receivables & payables</p>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <ReadinessStat label="To Collect" value={formatCurrency(accountSummary.receivable_open)} />
                            <ReadinessStat label="To Pay" value={formatCurrency(accountSummary.payable_open)} />
                            <ReadinessStat label="Overdue AR" value={accountSummary.overdue_receivables || 0} />
                            <ReadinessStat label="Overdue AP" value={accountSummary.overdue_payables || 0} />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recent open items</p>
                            <div className="flex gap-2">
                                <ReportLink onDownload={() => downloadFile(reportUrl('accounts-receivable'), 'accounts-receivable.csv')} label="AR CSV" compact />
                                <ReportLink onDownload={() => downloadFile(reportUrl('accounts-payable'), 'accounts-payable.csv')} label="AP CSV" compact />
                            </div>
                        </div>
                        <div className="divide-y mt-2">
                            {accountItems.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">No receivables or payables yet.</p>
                            ) : accountItems.map((item) => (
                                <div key={item.id} className="py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${item.item_type === 'receivable' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                {item.item_type === 'receivable' ? 'Receivable' : 'Payable'}
                                            </span>
                                            <span className="text-xs font-bold text-slate-400">{item.due_date?.slice(0, 10) || 'No due date'}</span>
                                        </div>
                                        <p className="font-black text-slate-950 mt-1 truncate">{item.counterparty}</p>
                                        <p className="text-xs font-semibold text-muted-foreground truncate">{item.invoice_number || 'No invoice'} • {item.category || 'General'}</p>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-right">
                                            <p className="text-sm font-black text-slate-950">{formatCurrency(item.balance_due)}</p>
                                            <p className="text-[10px] font-bold text-slate-400">{item.status}</p>
                                        </div>
                                        {item.status === 'open' && (
                                            <Button variant="outline" size="sm" className="rounded-xl text-emerald-700" onClick={() => openSettlement(item)}>
                                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                                Settle
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Opening position</p>
                                <p className="text-xs font-semibold text-slate-500 mt-1">
                                    Capture starting cash, bank, stock, receivables, payables, and director loan balances.
                                </p>
                            </div>
                            <Button variant="outline" className="rounded-xl shrink-0" onClick={openOpeningBalance}>
                                Edit
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                            <ReadinessStat label="Cash/Bank/Mobile" value={formatCurrency((Number(opening?.cash_balance || 0) + Number(opening?.bank_balance || 0) + Number(opening?.mobile_money_balance || 0)))} />
                            <ReadinessStat label="Stock Value" value={formatCurrency(opening?.stock_value)} />
                            <ReadinessStat label="Receivable" value={formatCurrency(opening?.accounts_receivable)} />
                            <ReadinessStat label="Payable" value={formatCurrency(opening?.accounts_payable)} />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit exports</p>
                        <button type="button" onClick={() => downloadFile(auditPackUrl, 'retail-bookkeeping-audit-pack.zip')} className="mt-3 h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-3 flex items-center justify-between gap-2 text-xs font-black text-emerald-800 hover:bg-emerald-100 w-full">
                            <span>Download audit pack ZIP</span>
                            <Download className="h-4 w-4 shrink-0" />
                        </button>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                            <ReportLink onDownload={() => downloadFile(reportUrl('profit-loss'), 'profit-loss.csv')} label="Profit & Loss" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('balance-sheet'), 'balance-sheet.csv')} label="Balance Sheet" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('cash-flow'), 'cash-flow.csv')} label="Cash Flow" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('general-ledger'), 'general-ledger.csv')} label="General Ledger" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('trial-balance'), 'trial-balance.csv')} label="Trial Balance" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('ar-aging'), 'ar-aging.csv')} label="AR Aging" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('ap-aging'), 'ap-aging.csv')} label="AP Aging" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('vendor-expenses'), 'vendor-expenses.csv')} label="Vendor Expenses" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('sales-by-channel'), 'sales-by-channel.csv')} label="Sales Channel" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('payroll-summary'), 'payroll-summary.csv')} label="Payroll Summary" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('director-loans'), 'director-loans.csv')} label="Director Loans" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('tax-payments'), 'tax-payments.csv')} label="Tax Payments" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('missing-proofs'), 'missing-proofs.csv')} label="Missing Proofs" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('reconciliation'), 'reconciliation.csv')} label="Reconciliation" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('adjustments'), 'adjustments.csv')} label="Adjustments" />
                            <ReportLink onDownload={() => downloadFile(reportUrl('share-access-logs'), 'share-access-logs.csv')} label="Share Logs" />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statement reconciliation</p>
                            <p className="text-xs font-semibold text-slate-500 mt-1">
                                Import bank statement files or add mobile-money lines from SMS/app history with screenshot proof.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <ReportLink onDownload={() => downloadFile(reportUrl('statement-lines'), 'statement-lines.csv')} label="Statement Lines" compact />
                            <Button variant="outline" className="rounded-xl" onClick={() => setIsStatementOpen(true)}>
                                Add / Import
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                        <ReadinessStat label="Unmatched" value={statementSummary.unmatched || 0} />
                        <ReadinessStat label="Matched" value={statementSummary.matched || 0} />
                        <ReadinessStat label="Ignored" value={statementSummary.ignored || 0} />
                    </div>
                    <div className="divide-y mt-3">
                        {statementLines.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No unmatched statement lines.</p>
                        ) : statementLines.map((line) => (
                            <div key={line.id} className="py-3 grid grid-cols-1 lg:grid-cols-[1fr_280px_auto] gap-3 lg:items-center">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${line.line_type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                            {line.line_type}
                                        </span>
                                        <span className="text-xs font-bold text-slate-400">{line.transaction_date?.slice(0, 10)}</span>
                                        <span className="text-xs font-bold text-slate-400">{line.reference_number || 'No ref'}</span>
                                    </div>
                                    <p className="font-black text-slate-950 mt-1 truncate">{formatCurrency(line.amount)}</p>
                                    <p className="text-xs font-semibold text-muted-foreground truncate">
                                        {line.counterparty || line.description || 'Statement line'}{line.attachment_original_name ? ' • proof attached' : ''}
                                    </p>
                                    {(statementSuggestions[line.id] || []).length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {(statementSuggestions[line.id] || []).map((suggestion) => {
                                                const entry = statementCandidates.find((candidate) => Number(candidate.id) === Number(suggestion.entry_id));
                                                if (!entry) return null;

                                                return (
                                                    <button
                                                        type="button"
                                                        key={`${line.id}-${suggestion.entry_id}`}
                                                        onClick={() => setMatchingEntryIds((prev) => ({ ...prev, [line.id]: suggestion.entry_id }))}
                                                        className="rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-left text-[10px] font-bold text-emerald-800 hover:bg-emerald-100"
                                                    >
                                                        {suggestion.confidence}% • #{entry.id} {entry.category}
                                                        <span className="block text-emerald-700/80">{suggestion.reasons.join(', ')}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <select
                                    value={matchingEntryIds[line.id] || ''}
                                    onChange={(e) => setMatchingEntryIds((prev) => ({ ...prev, [line.id]: e.target.value }))}
                                    className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold bg-white"
                                >
                                    <option value="">Choose bookkeeping record</option>
                                    {statementCandidates.map((entry) => (
                                        <option key={entry.id} value={entry.id}>
                                            #{entry.id} • {entry.transaction_date?.slice(0, 10)} • {entry.category} • {formatCurrency(entry.amount)}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex gap-2 lg:justify-end">
                                    <Button variant="outline" size="sm" className="rounded-xl text-emerald-700" onClick={() => handleStatementMatch(line)} disabled={!matchingEntryIds[line.id]}>
                                        Match
                                    </Button>
                                    <Button variant="outline" size="sm" className="rounded-xl text-slate-600" onClick={() => handleStatementIgnore(line)}>
                                        Ignore
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_150px_150px_150px_150px_150px_auto] gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                value={filters.q}
                                onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && fetchEntries()}
                                className="pl-9 rounded-xl"
                                placeholder="Search reference, vendor, category..."
                            />
                        </div>
                        <select
                            value={filters.type}
                            onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white"
                        >
                            <option value="">All types</option>
                            {Object.entries(typeLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white"
                        >
                            <option value="active">Active</option>
                            <option value="voided">Voided</option>
                            <option value="">All statuses</option>
                        </select>
                        <select
                            value={filters.proof_status}
                            onChange={(e) => setFilters((prev) => ({ ...prev, proof_status: e.target.value }))}
                            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white"
                        >
                            <option value="">All proofs</option>
                            {proofStatuses.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <select
                            value={filters.review_status}
                            onChange={(e) => setFilters((prev) => ({ ...prev, review_status: e.target.value }))}
                            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white"
                        >
                            <option value="">All reviews</option>
                            {reviewStatuses.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <select
                            value={filters.reconciliation_status}
                            onChange={(e) => setFilters((prev) => ({ ...prev, reconciliation_status: e.target.value }))}
                            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white"
                        >
                            <option value="">All matching</option>
                            {reconciliationStatuses.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <Button variant="outline" className="rounded-xl" onClick={fetchEntries}>Apply</Button>
                    </div>
                </div>

                <Card>
                    <CardHeader className="p-5 border-b">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Records</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-10 text-center text-sm text-muted-foreground">Loading records...</div>
                        ) : entries.length === 0 ? (
                            <div className="p-10 text-center text-sm text-muted-foreground">No bookkeeping records yet.</div>
                        ) : (
                            <div className="divide-y">
                                {entries.map((entry) => (
                                    <div key={entry.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                                    {typeLabels[entry.entry_type] || entry.entry_type}
                                                </span>
                                                {entry.status === 'voided' && (
                                                    <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-red-700">
                                                        Voided
                                                    </span>
                                                )}
                                                <StatusPill status={entry.proof_status} labels={Object.fromEntries(proofStatuses)} tone="amber" />
                                                <StatusPill status={entry.review_status} labels={Object.fromEntries(reviewStatuses)} tone="emerald" />
                                                <StatusPill status={entry.reconciliation_status} labels={Object.fromEntries(reconciliationStatuses)} tone="sky" />
                                                <span className="text-xs font-bold text-slate-400">{entry.transaction_date?.slice(0, 10)}</span>
                                            </div>
                                            <p className="font-black text-slate-950 mt-2 truncate">{entry.category}</p>
                                            <p className="text-xs font-semibold text-muted-foreground mt-1 truncate">
                                                {entry.counterparty || 'No counterparty'} • {entry.reference_number || 'No reference number'}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                                Recorded by {entry.staff?.user?.name || entry.user?.name || 'Owner'}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 md:justify-end">
                                            <div className="text-right">
                                                <p className="text-lg font-black text-slate-950">{formatCurrency(entry.amount)}</p>
                                                {entry.attachment_url ? (
                                                    <a href={entry.attachment_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-brand-600 hover:underline">
                                                        View proof
                                                    </a>
                                                ) : (
                                                    <p className="text-[10px] font-bold text-amber-600">No proof attached</p>
                                                )}
                                            </div>
                                            {entry.status === 'active' && (
                                                <div className="flex flex-wrap justify-end gap-1">
                                                    {entry.review_status !== 'approved' && (
                                                        <Button variant="outline" size="sm" className="rounded-xl text-emerald-700" onClick={() => handleReview(entry, 'approved')}>
                                                            Approve
                                                        </Button>
                                                    )}
                                                    {entry.reconciliation_status !== 'matched' && (
                                                        <Button variant="outline" size="sm" className="rounded-xl text-sky-700" onClick={() => handleReconcile(entry, 'matched')}>
                                                            Match
                                                        </Button>
                                                    )}
                                                    <Button variant="outline" size="icon" className="rounded-xl" onClick={() => openEdit(entry)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="outline" size="icon" className="rounded-xl text-red-600" onClick={() => setVoidingEntry(entry)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingEntry ? 'Edit Record' : 'Add Bookkeeping Record'}</DialogTitle>
                            <DialogDescription>
                                Attach EFD receipts, bank references, mobile money refs, invoices, or tax payment proof where available.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                            <Field label="Type">
                                <select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value, category: payload?.categories?.[e.target.value]?.[0] || '' })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Category">
                                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                                </select>
                            </Field>
                            <Field label="Amount">
                                <Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                            </Field>
                            <Field label="Transaction Date">
                                <Input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} required />
                            </Field>
                            <Field label="Payment Method">
                                <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    {paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Counterparty">
                                <Input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} placeholder="Vendor, customer, TRA, director..." />
                            </Field>
                            <Field label="Reference Type">
                                <select value={form.reference_type} onChange={(e) => setForm({ ...form, reference_type: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    <option value="">None</option>
                                    {referenceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Reference Number">
                                <Input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="EFD, bank, mobile money, invoice..." />
                            </Field>
                            <Field label="Tax Type">
                                <Input value={form.tax_type} onChange={(e) => setForm({ ...form, tax_type: e.target.value })} placeholder="VAT, WHT, PAYE..." />
                            </Field>
                            <Field label="Tax Period">
                                <Input value={form.tax_period} onChange={(e) => setForm({ ...form, tax_period: e.target.value })} placeholder="2026-05, Q2 2026..." />
                            </Field>
                            <Field label="Proof Status">
                                <select value={form.proof_status} onChange={(e) => setForm({ ...form, proof_status: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    <option value="">Auto</option>
                                    {proofStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Reconciliation">
                                <select value={form.reconciliation_status} onChange={(e) => setForm({ ...form, reconciliation_status: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    {reconciliationStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Statement Reference">
                                <Input value={form.statement_reference} onChange={(e) => setForm({ ...form, statement_reference: e.target.value })} placeholder="Bank statement line, MNO statement ref..." />
                            </Field>
                            <Field label="Proof Attachment">
                                <label className="h-10 rounded-xl border border-dashed border-slate-300 px-3 flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                    <Upload className="h-4 w-4" />
                                    {form.attachment?.name || 'Upload proof'}
                                    <input type="file" className="hidden" onChange={(e) => setForm({ ...form, attachment: e.target.files?.[0] || null })} />
                                </label>
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Description">
                                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short note for your accountant or auditor..." />
                                </Field>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Record'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isOpeningOpen} onOpenChange={setIsOpeningOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
                    <form onSubmit={handleOpeningSubmit}>
                        <DialogHeader>
                            <DialogTitle>Opening balances</DialogTitle>
                            <DialogDescription>
                                Set the business starting point before tracking daily records and audit exports.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                            <Field label="As Of Date">
                                <Input type="date" value={openingForm.as_of_date} onChange={(e) => setOpeningForm({ ...openingForm, as_of_date: e.target.value })} required />
                            </Field>
                            <Field label="Cash Balance">
                                <Input type="number" min="0" step="0.01" value={openingForm.cash_balance} onChange={(e) => setOpeningForm({ ...openingForm, cash_balance: e.target.value })} />
                            </Field>
                            <Field label="Bank Balance">
                                <Input type="number" min="0" step="0.01" value={openingForm.bank_balance} onChange={(e) => setOpeningForm({ ...openingForm, bank_balance: e.target.value })} />
                            </Field>
                            <Field label="Mobile Money Balance">
                                <Input type="number" min="0" step="0.01" value={openingForm.mobile_money_balance} onChange={(e) => setOpeningForm({ ...openingForm, mobile_money_balance: e.target.value })} />
                            </Field>
                            <Field label="Stock Value">
                                <Input type="number" min="0" step="0.01" value={openingForm.stock_value} onChange={(e) => setOpeningForm({ ...openingForm, stock_value: e.target.value })} />
                            </Field>
                            <Field label="Director Loan Balance">
                                <Input type="number" min="0" step="0.01" value={openingForm.director_loan_balance} onChange={(e) => setOpeningForm({ ...openingForm, director_loan_balance: e.target.value })} />
                            </Field>
                            <Field label="Accounts Receivable">
                                <Input type="number" min="0" step="0.01" value={openingForm.accounts_receivable} onChange={(e) => setOpeningForm({ ...openingForm, accounts_receivable: e.target.value })} />
                            </Field>
                            <Field label="Accounts Payable">
                                <Input type="number" min="0" step="0.01" value={openingForm.accounts_payable} onChange={(e) => setOpeningForm({ ...openingForm, accounts_payable: e.target.value })} />
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Note">
                                    <Textarea value={openingForm.note} onChange={(e) => setOpeningForm({ ...openingForm, note: e.target.value })} placeholder="Where these starting figures came from..." />
                                </Field>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpeningOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={savingOpening}>
                                {savingOpening ? 'Saving...' : 'Save Opening Balances'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isObligationOpen} onOpenChange={setIsObligationOpen}>
                <DialogContent className="sm:max-w-xl">
                    <form onSubmit={handleObligationSubmit}>
                        <DialogHeader>
                            <DialogTitle>Business reminder</DialogTitle>
                            <DialogDescription>Track filings, renewals, returns, and custom company obligations.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                            <Field label="Title">
                                <Input value={obligationForm.title} onChange={(e) => setObligationForm({ ...obligationForm, title: e.target.value })} placeholder="Annual return estimate" required />
                            </Field>
                            <Field label="Type">
                                <select value={obligationForm.obligation_type} onChange={(e) => setObligationForm({ ...obligationForm, obligation_type: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    <option value="annual_return">Annual Return</option>
                                    <option value="tax_filing">Tax Filing</option>
                                    <option value="license_renewal">License Renewal</option>
                                    <option value="payroll_tax">Payroll Tax</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </Field>
                            <Field label="Authority">
                                <Input value={obligationForm.authority} onChange={(e) => setObligationForm({ ...obligationForm, authority: e.target.value })} placeholder="TRA, BRELA, TCRA..." />
                            </Field>
                            <Field label="Due Date">
                                <Input type="date" value={obligationForm.due_date} onChange={(e) => setObligationForm({ ...obligationForm, due_date: e.target.value })} required />
                            </Field>
                            <Field label="Remind Days Before">
                                <Input type="number" min="0" max="365" value={obligationForm.remind_days_before} onChange={(e) => setObligationForm({ ...obligationForm, remind_days_before: e.target.value })} />
                            </Field>
                            <Field label="Reference">
                                <Input value={obligationForm.reference_number} onChange={(e) => setObligationForm({ ...obligationForm, reference_number: e.target.value })} placeholder="Filing ref or account number" />
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Description">
                                    <Textarea value={obligationForm.description} onChange={(e) => setObligationForm({ ...obligationForm, description: e.target.value })} />
                                </Field>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsObligationOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={savingObligation}>{savingObligation ? 'Saving...' : 'Save Reminder'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isBillOpen} onOpenChange={setIsBillOpen}>
                <DialogContent className="sm:max-w-xl">
                    <form onSubmit={handleBillSubmit}>
                        <DialogHeader>
                            <DialogTitle>Recurring bill</DialogTitle>
                            <DialogDescription>Set rent, hosting, utilities, subscriptions, and other repeat expenses.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                            <Field label="Vendor">
                                <Input value={billForm.vendor} onChange={(e) => setBillForm({ ...billForm, vendor: e.target.value })} required />
                            </Field>
                            <Field label="Category">
                                <select value={billForm.category} onChange={(e) => setBillForm({ ...billForm, category: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    {(payload?.categories?.expense || []).map((category) => <option key={category} value={category}>{category}</option>)}
                                </select>
                            </Field>
                            <Field label="Amount">
                                <Input type="number" min="0.01" step="0.01" value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} required />
                            </Field>
                            <Field label="Frequency">
                                <select value={billForm.frequency} onChange={(e) => setBillForm({ ...billForm, frequency: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                    <option value="yearly">Yearly</option>
                                </select>
                            </Field>
                            <Field label="Next Due Date">
                                <Input type="date" value={billForm.next_due_date} onChange={(e) => setBillForm({ ...billForm, next_due_date: e.target.value })} required />
                            </Field>
                            <Field label="Payment Method">
                                <select value={billForm.payment_method} onChange={(e) => setBillForm({ ...billForm, payment_method: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    {paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsBillOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={savingBill}>{savingBill ? 'Saving...' : 'Save Bill'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isPayrollOpen} onOpenChange={setIsPayrollOpen}>
                <DialogContent className="sm:max-w-xl">
                    <form onSubmit={handlePayrollSubmit}>
                        <DialogHeader>
                            <DialogTitle>Payroll lite</DialogTitle>
                            <DialogDescription>Record simple staff or contractor payments and attach payslips, worksheets, or payment proof when available.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                            <Field label="Worker Name">
                                <Input value={payrollForm.worker_name} onChange={(e) => setPayrollForm({ ...payrollForm, worker_name: e.target.value })} required />
                            </Field>
                            <Field label="Worker Type">
                                <select value={payrollForm.worker_type} onChange={(e) => setPayrollForm({ ...payrollForm, worker_type: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    <option value="employee">Employee</option>
                                    <option value="contractor">Contractor</option>
                                    <option value="casual">Casual</option>
                                </select>
                            </Field>
                            <Field label="Gross Amount">
                                <Input type="number" min="0.01" step="0.01" value={payrollForm.gross_amount} onChange={(e) => setPayrollForm({ ...payrollForm, gross_amount: e.target.value })} required />
                            </Field>
                            <Field label="Deductions">
                                <Input type="number" min="0" step="0.01" value={payrollForm.deductions_amount} onChange={(e) => setPayrollForm({ ...payrollForm, deductions_amount: e.target.value })} />
                            </Field>
                            <Field label="Pay Period">
                                <Input value={payrollForm.pay_period} onChange={(e) => setPayrollForm({ ...payrollForm, pay_period: e.target.value })} required />
                            </Field>
                            <Field label="Pay Date">
                                <Input type="date" value={payrollForm.pay_date} onChange={(e) => setPayrollForm({ ...payrollForm, pay_date: e.target.value })} required />
                            </Field>
                            <Field label="Reference">
                                <Input value={payrollForm.reference_number} onChange={(e) => setPayrollForm({ ...payrollForm, reference_number: e.target.value })} placeholder="Bank or mobile money ref" />
                            </Field>
                            <Field label="Tax Type">
                                <Input value={payrollForm.tax_type} onChange={(e) => setPayrollForm({ ...payrollForm, tax_type: e.target.value })} />
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Payroll Proof">
                                    <label className="h-10 rounded-xl border border-dashed border-slate-300 px-3 flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                        <Upload className="h-4 w-4" />
                                        {payrollForm.attachment?.name || 'Attach payslip, worksheet, or payment proof'}
                                        <input type="file" accept="image/*,.pdf,.csv,.xls,.xlsx,.doc,.docx,.txt" className="hidden" onChange={(e) => setPayrollForm({ ...payrollForm, attachment: e.target.files?.[0] || null })} />
                                    </label>
                                </Field>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsPayrollOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={savingPayroll}>{savingPayroll ? 'Saving...' : 'Save Payroll'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
                <DialogContent className="sm:max-w-xl">
                    <form onSubmit={handleShareSubmit}>
                        <DialogHeader>
                            <DialogTitle>Share bookkeeping records</DialogTitle>
                            <DialogDescription>Create a secure read-only link for an accountant, advisor, auditor, or tax officer.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                            <Field label="Recipient Name">
                                <Input value={shareForm.recipient_name} onChange={(e) => setShareForm({ ...shareForm, recipient_name: e.target.value })} />
                            </Field>
                            <Field label="Recipient Role">
                                <select value={shareForm.recipient_role} onChange={(e) => setShareForm({ ...shareForm, recipient_role: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    <option value="accountant">Accountant</option>
                                    <option value="auditor">Auditor</option>
                                    <option value="tax_authority">Tax Authority</option>
                                    <option value="advisor">Advisor</option>
                                    <option value="other">Other</option>
                                </select>
                            </Field>
                            <Field label="From Date">
                                <Input type="date" value={shareForm.from_date} onChange={(e) => setShareForm({ ...shareForm, from_date: e.target.value })} />
                            </Field>
                            <Field label="To Date">
                                <Input type="date" value={shareForm.to_date} onChange={(e) => setShareForm({ ...shareForm, to_date: e.target.value })} />
                            </Field>
                            <Field label="Expires At">
                                <Input type="datetime-local" value={shareForm.expires_at} onChange={(e) => setShareForm({ ...shareForm, expires_at: e.target.value })} />
                            </Field>
                            <Field label="PIN">
                                <Input value={shareForm.pin} onChange={(e) => setShareForm({ ...shareForm, pin: e.target.value })} placeholder="Optional 4+ digit PIN" />
                            </Field>
                            <label className="rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                                <input type="checkbox" checked={shareForm.include_proofs} onChange={(e) => setShareForm({ ...shareForm, include_proofs: e.target.checked })} />
                                Include proof links
                            </label>
                            <label className="rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                                <input type="checkbox" checked={shareForm.allow_downloads} onChange={(e) => setShareForm({ ...shareForm, allow_downloads: e.target.checked })} />
                                Allow CSV download
                            </label>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsShareOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={savingShare}>{savingShare ? 'Creating...' : 'Create Link'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAccountOpen} onOpenChange={setIsAccountOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
                    <form onSubmit={handleAccountSubmit}>
                        <DialogHeader>
                            <DialogTitle>{accountForm.item_type === 'receivable' ? 'New receivable' : 'New payable'}</DialogTitle>
                            <DialogDescription>
                                Track invoices to collect from customers and bills to pay suppliers.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                            <Field label="Type">
                                <select
                                    value={accountForm.item_type}
                                    onChange={(e) => {
                                        const itemType = e.target.value;
                                        const options = itemType === 'receivable' ? (payload?.categories?.income || []) : (payload?.categories?.expense || []);
                                        setAccountCategoryCustom(false);
                                        setAccountForm({ ...accountForm, item_type: itemType, category: options[0] || '' });
                                    }}
                                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full"
                                >
                                    <option value="receivable">Receivable / customer invoice</option>
                                    <option value="payable">Payable / supplier bill</option>
                                </select>
                            </Field>
                            <Field label="Counterparty">
                                <Input value={accountForm.counterparty} onChange={(e) => setAccountForm({ ...accountForm, counterparty: e.target.value })} placeholder="Customer or supplier name" required />
                            </Field>
                            <Field label="Category">
                                {accountCategoryCustom ? (
                                    <Input value={accountForm.category} onChange={(e) => setAccountForm({ ...accountForm, category: e.target.value })} placeholder="Type custom category" autoFocus />
                                ) : (
                                    <select
                                        value={accountForm.category}
                                        onChange={(e) => {
                                            if (e.target.value === '__custom') {
                                                setAccountCategoryCustom(true);
                                                setAccountForm({ ...accountForm, category: '' });
                                                return;
                                            }
                                            setAccountForm({ ...accountForm, category: e.target.value });
                                        }}
                                        className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full"
                                    >
                                        {accountCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                                        <option value="__custom">Add custom category...</option>
                                    </select>
                                )}
                            </Field>
                            <Field label="Amount">
                                <Input type="number" min="0.01" step="0.01" value={accountForm.amount} onChange={(e) => setAccountForm({ ...accountForm, amount: e.target.value })} required />
                            </Field>
                            <Field label="Invoice / Bill Number">
                                <Input value={accountForm.invoice_number} onChange={(e) => setAccountForm({ ...accountForm, invoice_number: e.target.value })} placeholder="INV-001, supplier bill..." />
                            </Field>
                            <Field label="Issue Date">
                                <Input type="date" value={accountForm.issue_date} onChange={(e) => setAccountForm({ ...accountForm, issue_date: e.target.value })} required />
                            </Field>
                            <Field label="Due Date">
                                <Input type="date" value={accountForm.due_date} onChange={(e) => setAccountForm({ ...accountForm, due_date: e.target.value })} />
                            </Field>
                            <Field label="Attachment">
                                <label className="h-10 rounded-xl border border-dashed border-slate-300 px-3 flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                    <Upload className="h-4 w-4" />
                                    {accountForm.attachment?.name || 'Upload invoice/bill'}
                                    <input type="file" className="hidden" onChange={(e) => setAccountForm({ ...accountForm, attachment: e.target.files?.[0] || null })} />
                                </label>
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Description">
                                    <Textarea value={accountForm.description} onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })} placeholder="Short note..." />
                                </Field>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAccountOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={savingAccount}>
                                {savingAccount ? 'Saving...' : 'Save'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(settlingItem)} onOpenChange={(open) => !open && setSettlingItem(null)}>
                <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
                    <form onSubmit={handleSettlementSubmit}>
                        <DialogHeader>
                            <DialogTitle>{settlingItem?.item_type === 'receivable' ? 'Record collection' : 'Record payment'}</DialogTitle>
                            <DialogDescription>
                                This creates a linked bookkeeping record and updates the open balance.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                            <Field label="Amount">
                                <Input type="number" min="0.01" step="0.01" value={settlementForm.paid_amount} onChange={(e) => setSettlementForm({ ...settlementForm, paid_amount: e.target.value })} required />
                            </Field>
                            <Field label="Transaction Date">
                                <Input type="date" value={settlementForm.transaction_date} onChange={(e) => setSettlementForm({ ...settlementForm, transaction_date: e.target.value })} required />
                            </Field>
                            <Field label="Payment Method">
                                <select value={settlementForm.payment_method} onChange={(e) => setSettlementForm({ ...settlementForm, payment_method: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    {paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Reference Type">
                                <select value={settlementForm.reference_type} onChange={(e) => setSettlementForm({ ...settlementForm, reference_type: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    <option value="">None</option>
                                    {referenceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Reference Number">
                                <Input value={settlementForm.reference_number} onChange={(e) => setSettlementForm({ ...settlementForm, reference_number: e.target.value })} placeholder="Receipt, bank, mobile money ref..." />
                            </Field>
                            <Field label="Reconciliation">
                                <select value={settlementForm.reconciliation_status} onChange={(e) => setSettlementForm({ ...settlementForm, reconciliation_status: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    {reconciliationStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Statement Reference">
                                <Input value={settlementForm.statement_reference} onChange={(e) => setSettlementForm({ ...settlementForm, statement_reference: e.target.value })} placeholder="Bank or mobile statement ref..." />
                            </Field>
                            <Field label="Proof Attachment">
                                <label className="h-10 rounded-xl border border-dashed border-slate-300 px-3 flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                    <Upload className="h-4 w-4" />
                                    {settlementForm.attachment?.name || 'Upload proof'}
                                    <input type="file" className="hidden" onChange={(e) => setSettlementForm({ ...settlementForm, attachment: e.target.files?.[0] || null })} />
                                </label>
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Description">
                                    <Textarea value={settlementForm.description} onChange={(e) => setSettlementForm({ ...settlementForm, description: e.target.value })} />
                                </Field>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setSettlingItem(null)}>Cancel</Button>
                            <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={savingSettlement}>
                                {savingSettlement ? 'Saving...' : 'Record Settlement'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
                    <form onSubmit={handleAdjustmentSubmit}>
                        <DialogHeader>
                            <DialogTitle>Adjustment entry</DialogTitle>
                            <DialogDescription>
                                Record accountant corrections, stock differences, write-offs, bank charges, depreciation, and opening corrections.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                            <Field label="Impact">
                                <select value={adjustmentForm.entry_type} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, entry_type: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Reason">
                                <select value={adjustmentForm.adjustment_reason} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustment_reason: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    {adjustmentReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                                </select>
                            </Field>
                            <Field label="Account">
                                <Input value={adjustmentForm.adjustment_account} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustment_account: e.target.value })} placeholder="Inventory, bank, expense, tax..." required />
                            </Field>
                            <Field label="Amount">
                                <Input type="number" min="0.01" step="0.01" value={adjustmentForm.amount} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })} required />
                            </Field>
                            <Field label="Transaction Date">
                                <Input type="date" value={adjustmentForm.transaction_date} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, transaction_date: e.target.value })} required />
                            </Field>
                            <Field label="Counterparty">
                                <Input value={adjustmentForm.counterparty} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, counterparty: e.target.value })} placeholder="Optional vendor, customer, bank..." />
                            </Field>
                            <Field label="Reference Type">
                                <select value={adjustmentForm.reference_type} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reference_type: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    <option value="">None</option>
                                    {referenceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Reference Number">
                                <Input value={adjustmentForm.reference_number} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reference_number: e.target.value })} placeholder="Journal ref, invoice, statement ref..." />
                            </Field>
                            <Field label="Proof Status">
                                <select value={adjustmentForm.proof_status} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, proof_status: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    <option value="">Auto proof status</option>
                                    {proofStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Reconciliation">
                                <select value={adjustmentForm.reconciliation_status} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reconciliation_status: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                    {reconciliationStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <Field label="Statement Reference">
                                <Input value={adjustmentForm.statement_reference} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, statement_reference: e.target.value })} placeholder="Statement line or reconciliation ref..." />
                            </Field>
                            <Field label="Attachment">
                                <label className="h-10 rounded-xl border border-dashed border-slate-300 px-3 flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                    <Upload className="h-4 w-4" />
                                    {adjustmentForm.attachment?.name || 'Upload support'}
                                    <input type="file" className="hidden" onChange={(e) => setAdjustmentForm({ ...adjustmentForm, attachment: e.target.files?.[0] || null })} />
                                </label>
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Reason Note">
                                    <Textarea value={adjustmentForm.description} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, description: e.target.value })} placeholder="Explain why this correction is needed..." required />
                                </Field>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAdjustmentOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={savingAdjustment}>
                                {savingAdjustment ? 'Saving...' : 'Save Adjustment'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add statement lines</DialogTitle>
                        <DialogDescription>
                            Upload a bank/card statement file, or add a mobile-money line from SMS/app history with proof.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                        <button type="button" onClick={() => setStatementMode('manual')} className={`h-9 rounded-lg text-xs font-black ${statementMode === 'manual' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>
                            Manual line
                        </button>
                        <button type="button" onClick={() => setStatementMode('file')} className={`h-9 rounded-lg text-xs font-black ${statementMode === 'file' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>
                            File import
                        </button>
                    </div>

                    {statementMode === 'manual' ? (
                        <form onSubmit={handleStatementLineSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                                <Field label="Source Type">
                                    <select value={statementLineForm.source_type} onChange={(e) => setStatementLineForm({ ...statementLineForm, source_type: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                        <option value="mobile_money">Mobile Money</option>
                                        <option value="bank">Bank</option>
                                        <option value="card">Card</option>
                                        <option value="other">Other</option>
                                    </select>
                                </Field>
                                <Field label="Source Name">
                                    <Input value={statementLineForm.source_name} onChange={(e) => setStatementLineForm({ ...statementLineForm, source_name: e.target.value })} placeholder="M-Pesa, Tigo Pesa, CRDB..." />
                                </Field>
                                <Field label="Date">
                                    <Input type="date" value={statementLineForm.transaction_date} onChange={(e) => setStatementLineForm({ ...statementLineForm, transaction_date: e.target.value })} required />
                                </Field>
                                <Field label="Money Movement">
                                    <select value={statementLineForm.line_type} onChange={(e) => setStatementLineForm({ ...statementLineForm, line_type: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                        <option value="credit">Money In</option>
                                        <option value="debit">Money Out</option>
                                    </select>
                                </Field>
                                <Field label="Amount">
                                    <Input type="number" min="0" step="0.01" value={statementLineForm.amount} onChange={(e) => setStatementLineForm({ ...statementLineForm, amount: e.target.value })} required />
                                </Field>
                                <Field label="Reference">
                                    <Input value={statementLineForm.reference_number} onChange={(e) => setStatementLineForm({ ...statementLineForm, reference_number: e.target.value })} placeholder="Transaction ID or SMS ref..." />
                                </Field>
                                <Field label="Counterparty">
                                    <Input value={statementLineForm.counterparty} onChange={(e) => setStatementLineForm({ ...statementLineForm, counterparty: e.target.value })} placeholder="Customer, supplier, agent..." />
                                </Field>
                                <div className="md:col-span-2">
                                    <Field label="Note">
                                        <Textarea value={statementLineForm.description} onChange={(e) => setStatementLineForm({ ...statementLineForm, description: e.target.value })} placeholder="Paste a short narration from the SMS or app history..." />
                                    </Field>
                                </div>
                                <div className="md:col-span-2">
                                    <Field label="Screenshot / Proof">
                                        <label className="h-11 rounded-xl border border-dashed border-slate-300 px-3 flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                            <Upload className="h-4 w-4" />
                                            {statementLineForm.attachment?.name || 'Attach SMS or statement screenshot'}
                                            <input type="file" accept="image/*,.pdf,.csv,.xls,.xlsx,.txt" className="hidden" onChange={(e) => setStatementLineForm({ ...statementLineForm, attachment: e.target.files?.[0] || null })} />
                                        </label>
                                    </Field>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsStatementOpen(false)}>Cancel</Button>
                                <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={savingStatement}>
                                    {savingStatement ? 'Saving...' : 'Add Statement Line'}
                                </Button>
                            </DialogFooter>
                        </form>
                    ) : (
                        <form onSubmit={handleStatementImport}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                                <Field label="Source Type">
                                    <select value={statementForm.source_type} onChange={(e) => setStatementForm({ ...statementForm, source_type: e.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full">
                                        <option value="bank">Bank</option>
                                        <option value="mobile_money">Mobile Money</option>
                                        <option value="card">Card</option>
                                        <option value="other">Other</option>
                                    </select>
                                </Field>
                                <Field label="Source Name">
                                    <Input value={statementForm.source_name} onChange={(e) => setStatementForm({ ...statementForm, source_name: e.target.value })} placeholder="CRDB, NMB, M-Pesa..." />
                                </Field>
                                <div className="md:col-span-2">
                                    <Field label="Statement File">
                                        <label className="h-11 rounded-xl border border-dashed border-slate-300 px-3 flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                            <Upload className="h-4 w-4" />
                                            {statementForm.statement?.name || 'Upload CSV/TXT statement'}
                                            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => setStatementForm({ ...statementForm, statement: e.target.files?.[0] || null })} />
                                        </label>
                                    </Field>
                                    <p className="mt-2 text-xs font-semibold text-slate-500">
                                        Supported headers include date, amount, debit, credit, reference, counterparty, description, and narration.
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsStatementOpen(false)}>Cancel</Button>
                                <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={savingStatement || !statementForm.statement}>
                                    {savingStatement ? 'Importing...' : 'Import Statement File'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(voidingEntry)} onOpenChange={(open) => !open && setVoidingEntry(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Void record</DialogTitle>
                        <DialogDescription>
                            Voided records stay visible in exports and audit history. Add the reason for traceability.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason for voiding this record..." />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setVoidingEntry(null)}>Cancel</Button>
                        <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleVoid} disabled={!voidReason.trim()}>
                            Void Record
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

function ReportLink({ onDownload, label, compact = false }) {
    return (
        <button type="button" onClick={onDownload} className={`${compact ? 'h-8' : 'h-10'} rounded-xl border border-slate-200 px-3 flex items-center justify-between gap-2 text-xs font-black text-slate-700 hover:bg-slate-50 w-full`}>
            <span className="truncate">{label}</span>
            <Download className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
    );
}

function SummaryTile({ icon: Icon, label, value, color }) {
    return (
        <Card className="shadow-sm">
            <CardContent className="p-4">
                <Icon className={`h-5 w-5 ${color}`} />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3">{label}</p>
                <p className={`text-lg font-black mt-1 ${color}`}>{value}</p>
            </CardContent>
        </Card>
    );
}

function QuickAction({ onClick, icon: Icon, label }) {
    return (
        <button type="button" onClick={onClick} className="h-20 rounded-xl border border-slate-200 bg-slate-50 px-3 flex flex-col items-center justify-center gap-2 text-xs font-black text-slate-700 hover:bg-white hover:border-brand-200">
            <Icon className="h-5 w-5 text-brand-600" />
            <span>{label}</span>
        </button>
    );
}

function ReadinessStat({ label, value }) {
    return (
        <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <p className="text-lg font-black text-slate-950">{value}</p>
            <p className="text-[10px] font-bold text-slate-500 mt-1">{label}</p>
        </div>
    );
}

function BusinessList({ title, empty, items, render }) {
    return (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
            <div className="divide-y divide-slate-200/70 mt-2">
                {items.length === 0 ? (
                    <p className="py-5 text-center text-xs font-semibold text-slate-500">{empty}</p>
                ) : items.map(render)}
            </div>
        </div>
    );
}

function BusinessRow({ title, meta, actionLabel, onAction, disabled = false, secondaryLabel = null, onSecondary = null }) {
    return (
        <div className="py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
                <p className="text-sm font-black text-slate-950 truncate">{title}</p>
                <p className="text-[10px] font-bold text-slate-500 truncate">{meta}</p>
            </div>
            <div className="flex gap-1 shrink-0">
                {secondaryLabel && (
                    <Button type="button" variant="outline" size="sm" className="rounded-xl text-red-600" onClick={onSecondary}>
                        {secondaryLabel}
                    </Button>
                )}
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={onAction} disabled={disabled}>
                    {actionLabel}
                </Button>
            </div>
        </div>
    );
}

function StatusPill({ status, labels, tone }) {
    if (!status) return null;

    const tones = {
        amber: 'bg-amber-50 text-amber-700',
        emerald: 'bg-emerald-50 text-emerald-700',
        sky: 'bg-sky-50 text-sky-700',
    };

    return (
        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${tones[tone] || 'bg-slate-100 text-slate-600'}`}>
            {labels[status] || status}
        </span>
    );
}

function Field({ label, children }) {
    return (
        <label className="space-y-1.5 block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
            {children}
        </label>
    );
}
