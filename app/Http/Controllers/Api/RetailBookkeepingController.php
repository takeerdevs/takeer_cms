<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\RetailBookkeepingShareAccessLog;
use App\Models\RetailBookkeepingShareLink;
use App\Models\RetailAuditLog;
use App\Models\RetailBusinessObligation;
use App\Models\RetailBookkeepingAccountItem;
use App\Models\RetailBookkeepingEntry;
use App\Models\RetailBookkeepingOpeningBalance;
use App\Models\RetailBookkeepingPeriodLock;
use App\Models\RetailBookkeepingStatementLine;
use App\Models\RetailPayrollRecord;
use App\Models\RetailRecurringBill;
use Illuminate\Support\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;
use ZipArchive;

class RetailBookkeepingController extends Controller
{
    private const ENTRY_TYPES = ['income', 'expense', 'director_loan', 'tax_payment'];
    private const PAYMENT_METHODS = ['cash', 'bank', 'mobile_money', 'card', 'takeer_wallet', 'director_loan', 'other'];
    private const REFERENCE_TYPES = ['efd_receipt', 'bank_transaction', 'mobile_money', 'invoice', 'tra_payment', 'contract', 'other'];
    private const PROOF_STATUSES = ['attached', 'reference_only', 'missing', 'needs_replacement'];
    private const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];
    private const RECONCILIATION_STATUSES = ['unmatched', 'matched', 'needs_review'];
    private const ADJUSTMENT_REASONS = ['stock_count', 'bank_charge', 'write_off', 'depreciation', 'opening_correction', 'tax_adjustment', 'rounding', 'other'];

    public function index(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $query = RetailBookkeepingEntry::query()
            ->where('merchant_id', $merchant->id)
            ->with(['staff.user:id,name', 'user:id,name', 'reviewedBy:id,name', 'reconciledBy:id,name'])
            ->latest('transaction_date')
            ->latest('id');

        if ($request->filled('type')) {
            $query->where('entry_type', $request->input('type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('proof_status')) {
            $query->where('proof_status', $request->input('proof_status'));
        }

        if ($request->filled('review_status')) {
            $query->where('review_status', $request->input('review_status'));
        }

        if ($request->filled('reconciliation_status')) {
            $query->where('reconciliation_status', $request->input('reconciliation_status'));
        }

        if ($request->filled('from')) {
            $query->whereDate('transaction_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('transaction_date', '<=', $request->input('to'));
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->input('q'));
            $query->where(function ($q) use ($term) {
                $q->where('category', 'like', "%{$term}%")
                    ->orWhere('counterparty', 'like', "%{$term}%")
                    ->orWhere('reference_number', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%");
            });
        }

        $entries = $query->paginate(30);
        $summary = $this->summary($merchant->id, $request);

        return response()->json([
            'entries' => $entries,
            'summary' => $summary,
            'categories' => $this->categories(),
            'opening_balance' => $this->openingBalance($merchant->id),
            'accounts' => $this->accountItems($merchant->id),
            'adjustment_reasons' => $this->adjustmentReasons(),
            'statement_reconciliation' => $this->statementReconciliation($merchant->id),
            'tax_wizards' => $this->taxWizardPack($merchant, $request),
            'business_tools' => $this->businessTools($merchant),
            'locks' => $this->periodLocks($merchant->id),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $validated = $this->validatedPayload($request);
        $this->abortIfPeriodLocked($merchant->id, $validated['transaction_date']);

        return DB::transaction(function () use ($request, $merchant, $validated) {
            $filePayload = $this->storeAttachment($request, $merchant->id);
            $proofStatus = $validated['proof_status'] ?? $this->inferProofStatus($filePayload, $validated);
            unset($validated['proof_status']);

            $entry = RetailBookkeepingEntry::create(array_merge($validated, $filePayload, [
                'merchant_id' => $merchant->id,
                'staff_id' => $request->attributes->get('active_staff')?->id,
                'user_id' => $request->user()?->id,
                'currency_code' => $merchant->currency?->code ?? $validated['currency_code'] ?? 'TZS',
                'status' => 'active',
                'proof_status' => $proofStatus,
                'review_status' => 'approved',
                'reviewed_by_user_id' => $request->user()?->id,
                'reviewed_at' => now(),
                'reconciliation_status' => $validated['reconciliation_status'] ?? 'unmatched',
            ]));

            $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_ENTRY_CREATED', 'Bookkeeping record created.', [
                'entry_id' => $entry->id,
                'entry' => Arr::only($entry->toArray(), $this->auditedFields()),
            ]);

            return response()->json([
                'message' => 'Bookkeeping record saved.',
                'data' => $entry->fresh(['staff.user:id,name', 'user:id,name', 'reviewedBy:id,name', 'reconciledBy:id,name']),
            ], 201);
        });
    }

    public function update(Request $request, RetailBookkeepingEntry $entry): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $entry->merchant_id === (int) $merchant->id, 403);
        abort_if($entry->status === 'voided', 422, 'Voided records cannot be edited.');

        $validated = $this->validatedPayload($request);
        $this->abortIfPeriodLocked($merchant->id, $entry->transaction_date);
        $this->abortIfPeriodLocked($merchant->id, $validated['transaction_date']);

        return DB::transaction(function () use ($request, $merchant, $entry, $validated) {
            $before = Arr::only($entry->toArray(), $this->auditedFields());
            $filePayload = $this->storeAttachment($request, $merchant->id);
            $proofStatus = $validated['proof_status'] ?? $this->inferProofStatus($filePayload, $validated, $entry);
            unset($validated['proof_status']);
            $entry->update(array_merge($validated, $filePayload, [
                'proof_status' => $proofStatus,
            ]));
            $entry->refresh();

            $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_ENTRY_UPDATED', 'Bookkeeping record updated.', [
                'entry_id' => $entry->id,
                'before' => $before,
                'after' => Arr::only($entry->toArray(), $this->auditedFields()),
            ]);

            return response()->json([
                'message' => 'Bookkeeping record updated.',
                'data' => $entry->fresh(['staff.user:id,name', 'user:id,name', 'reviewedBy:id,name', 'reconciledBy:id,name']),
            ]);
        });
    }

    public function void(Request $request, RetailBookkeepingEntry $entry): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $entry->merchant_id === (int) $merchant->id, 403);
        abort_if($entry->status === 'voided', 422, 'Record is already voided.');
        $this->abortIfPeriodLocked($merchant->id, $entry->transaction_date);

        $validated = $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        return DB::transaction(function () use ($request, $merchant, $entry, $validated) {
            $before = Arr::only($entry->toArray(), $this->auditedFields());
            $entry->update([
                'status' => 'voided',
                'voided_by_user_id' => $request->user()?->id,
                'voided_at' => now(),
                'void_reason' => $validated['reason'],
            ]);

            $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_ENTRY_VOIDED', 'Bookkeeping record voided.', [
                'entry_id' => $entry->id,
                'reason' => $validated['reason'],
                'before' => $before,
                'after' => Arr::only($entry->fresh()->toArray(), $this->auditedFields()),
            ]);

            return response()->json([
                'message' => 'Bookkeeping record voided and kept in the audit trail.',
                'data' => $entry->fresh(['staff.user:id,name', 'user:id,name', 'reviewedBy:id,name', 'reconciledBy:id,name']),
            ]);
        });
    }

    public function review(Request $request, RetailBookkeepingEntry $entry): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $entry->merchant_id === (int) $merchant->id, 403);
        abort_if($entry->status === 'voided', 422, 'Voided records cannot be reviewed.');
        $this->abortIfPeriodLocked($merchant->id, $entry->transaction_date);

        $validated = $request->validate([
            'review_status' => ['required', Rule::in(self::REVIEW_STATUSES)],
            'review_note' => 'nullable|string|max:1000',
        ]);

        $before = Arr::only($entry->toArray(), $this->auditedFields());
        $entry->update([
            'review_status' => $validated['review_status'],
            'review_note' => $validated['review_note'] ?? null,
            'reviewed_by_user_id' => $request->user()?->id,
            'reviewed_at' => now(),
        ]);

        $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_ENTRY_REVIEWED', 'Bookkeeping record reviewed.', [
            'entry_id' => $entry->id,
            'before' => $before,
            'after' => Arr::only($entry->fresh()->toArray(), $this->auditedFields()),
        ]);

        return response()->json([
            'message' => 'Review status updated.',
            'data' => $entry->fresh(['staff.user:id,name', 'user:id,name', 'reviewedBy:id,name', 'reconciledBy:id,name']),
        ]);
    }

    public function reconcile(Request $request, RetailBookkeepingEntry $entry): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $entry->merchant_id === (int) $merchant->id, 403);
        abort_if($entry->status === 'voided', 422, 'Voided records cannot be reconciled.');
        $this->abortIfPeriodLocked($merchant->id, $entry->transaction_date);

        $validated = $request->validate([
            'reconciliation_status' => ['required', Rule::in(self::RECONCILIATION_STATUSES)],
            'statement_reference' => 'nullable|string|max:160',
        ]);

        $before = Arr::only($entry->toArray(), $this->auditedFields());
        $entry->update([
            'reconciliation_status' => $validated['reconciliation_status'],
            'statement_reference' => $validated['statement_reference'] ?? null,
            'reconciled_by_user_id' => $validated['reconciliation_status'] === 'matched' ? $request->user()?->id : null,
            'reconciled_at' => $validated['reconciliation_status'] === 'matched' ? now() : null,
        ]);

        $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_ENTRY_RECONCILED', 'Bookkeeping reconciliation status updated.', [
            'entry_id' => $entry->id,
            'before' => $before,
            'after' => Arr::only($entry->fresh()->toArray(), $this->auditedFields()),
        ]);

        return response()->json([
            'message' => 'Reconciliation status updated.',
            'data' => $entry->fresh(['staff.user:id,name', 'user:id,name', 'reviewedBy:id,name', 'reconciledBy:id,name']),
        ]);
    }

    public function reportPack(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $query = $this->summaryQuery($merchant->id, $request);

        $byCategory = (clone $query)
            ->selectRaw('entry_type, category, sum(amount) as total, count(*) as count')
            ->groupBy('entry_type', 'category')
            ->orderBy('entry_type')
            ->orderByDesc('total')
            ->get();

        return response()->json([
            'summary' => $this->summary($merchant->id, $request),
            'by_category' => $byCategory,
            'director_loans' => (clone $query)->where('entry_type', 'director_loan')->latest('transaction_date')->get(),
            'tax_payments' => (clone $query)->where('entry_type', 'tax_payment')->latest('transaction_date')->get(),
            'missing_proofs' => (clone $query)->whereIn('proof_status', ['missing', 'needs_replacement'])->latest('transaction_date')->get(),
            'unmatched' => (clone $query)->where('reconciliation_status', '!=', 'matched')->latest('transaction_date')->get(),
            'locked_periods' => $this->periodLocks($merchant->id),
        ]);
    }

    public function lockPeriod(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $validated = $request->validate([
            'period_key' => ['required', 'date_format:Y-m'],
            'note' => 'nullable|string|max:1000',
        ]);

        $lock = RetailBookkeepingPeriodLock::firstOrCreate(
            ['merchant_id' => $merchant->id, 'period_key' => $validated['period_key']],
            [
                'locked_by_user_id' => $request->user()?->id,
                'locked_at' => now(),
                'note' => $validated['note'] ?? null,
            ]
        );

        $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_PERIOD_LOCKED', "Bookkeeping period {$validated['period_key']} locked.", [
            'period_key' => $validated['period_key'],
            'lock_id' => $lock->id,
            'note' => $lock->note,
        ]);

        return response()->json([
            'message' => 'Bookkeeping period locked.',
            'data' => $lock,
        ]);
    }

    public function openingBalanceStore(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $validated = $request->validate([
            'as_of_date' => 'required|date',
            'cash_balance' => 'nullable|numeric|min:0',
            'bank_balance' => 'nullable|numeric|min:0',
            'mobile_money_balance' => 'nullable|numeric|min:0',
            'stock_value' => 'nullable|numeric|min:0',
            'director_loan_balance' => 'nullable|numeric|min:0',
            'accounts_receivable' => 'nullable|numeric|min:0',
            'accounts_payable' => 'nullable|numeric|min:0',
            'note' => 'nullable|string|max:1000',
        ]);

        $balance = RetailBookkeepingOpeningBalance::updateOrCreate(
            ['merchant_id' => $merchant->id],
            array_merge($validated, [
                'user_id' => $request->user()?->id,
                'currency_code' => $merchant->currency?->code ?? 'TZS',
            ])
        );

        $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_OPENING_BALANCE_SAVED', 'Bookkeeping opening balance saved.', [
            'opening_balance_id' => $balance->id,
            'opening_balance' => $balance->fresh()->toArray(),
        ]);

        return response()->json([
            'message' => 'Opening balances saved.',
            'data' => $balance->fresh(),
        ]);
    }

    public function accountItemStore(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $validated = $request->validate([
            'item_type' => ['required', Rule::in(['receivable', 'payable'])],
            'counterparty' => 'required|string|max:160',
            'category' => 'nullable|string|max:120',
            'amount' => 'required|numeric|min:0.01|max:999999999999.99',
            'invoice_number' => 'nullable|string|max:160',
            'issue_date' => 'required|date',
            'due_date' => 'nullable|date|after_or_equal:issue_date',
            'description' => 'nullable|string|max:2000',
            'attachment' => 'nullable|file|max:10240|mimes:jpg,jpeg,png,webp,pdf,csv,xls,xlsx,doc,docx,txt',
            'metadata' => 'nullable|array',
        ]);

        $this->abortIfPeriodLocked($merchant->id, $validated['issue_date']);

        return DB::transaction(function () use ($request, $merchant, $validated) {
            $filePayload = $this->storeAttachment($request, $merchant->id);

            $item = RetailBookkeepingAccountItem::create(array_merge($validated, $filePayload, [
                'merchant_id' => $merchant->id,
                'staff_id' => $request->attributes->get('active_staff')?->id,
                'user_id' => $request->user()?->id,
                'currency_code' => $merchant->currency?->code ?? 'TZS',
                'status' => 'open',
                'paid_amount' => 0,
            ]));

            $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_ACCOUNT_ITEM_CREATED', 'Bookkeeping account item created.', [
                'account_item_id' => $item->id,
                'item' => Arr::only($item->toArray(), $this->accountItemAuditedFields()),
            ]);

            return response()->json([
                'message' => $item->item_type === 'receivable' ? 'Receivable saved.' : 'Payable saved.',
                'data' => $item->fresh(['staff.user:id,name', 'user:id,name']),
            ], 201);
        });
    }

    public function accountItemSettle(Request $request, RetailBookkeepingAccountItem $item): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $item->merchant_id === (int) $merchant->id, 403);
        abort_if($item->status !== 'open', 422, 'Only open account items can be settled.');

        $validated = $request->validate([
            'paid_amount' => 'nullable|numeric|min:0.01|max:999999999999.99',
            'payment_method' => ['required', Rule::in(self::PAYMENT_METHODS)],
            'reference_type' => ['nullable', Rule::in(self::REFERENCE_TYPES)],
            'reference_number' => 'nullable|string|max:160',
            'transaction_date' => 'required|date',
            'proof_status' => ['nullable', Rule::in(self::PROOF_STATUSES)],
            'reconciliation_status' => ['nullable', Rule::in(self::RECONCILIATION_STATUSES)],
            'statement_reference' => 'nullable|string|max:160',
            'description' => 'nullable|string|max:2000',
            'attachment' => 'nullable|file|max:10240|mimes:jpg,jpeg,png,webp,pdf,csv,xls,xlsx,doc,docx,txt',
        ]);

        $this->abortIfPeriodLocked($merchant->id, $validated['transaction_date']);

        return DB::transaction(function () use ($request, $merchant, $item, $validated) {
            $before = Arr::only($item->toArray(), $this->accountItemAuditedFields());
            $filePayload = $this->storeAttachment($request, $merchant->id);
            $paidAmount = (float) ($validated['paid_amount'] ?? $item->balance_due);
            $paidAmount = min($paidAmount, (float) $item->balance_due);
            $proofStatus = $validated['proof_status'] ?? $this->inferProofStatus($filePayload, $validated);

            $entry = RetailBookkeepingEntry::create(array_merge($filePayload, [
                'merchant_id' => $merchant->id,
                'staff_id' => $request->attributes->get('active_staff')?->id,
                'user_id' => $request->user()?->id,
                'entry_type' => $item->item_type === 'receivable' ? 'income' : 'expense',
                'category' => $item->item_type === 'receivable' ? 'Accounts Receivable Collection' : 'Accounts Payable Payment',
                'counterparty' => $item->counterparty,
                'amount' => $paidAmount,
                'currency_code' => $merchant->currency?->code ?? $item->currency_code,
                'payment_method' => $validated['payment_method'],
                'reference_type' => $validated['reference_type'] ?? 'invoice',
                'reference_number' => $validated['reference_number'] ?? $item->invoice_number,
                'transaction_date' => $validated['transaction_date'],
                'description' => $validated['description'] ?? "Settlement for {$item->invoice_number}",
                'status' => 'active',
                'proof_status' => $proofStatus,
                'review_status' => 'approved',
                'reviewed_by_user_id' => $request->user()?->id,
                'reviewed_at' => now(),
                'reconciliation_status' => $validated['reconciliation_status'] ?? 'unmatched',
                'statement_reference' => $validated['statement_reference'] ?? null,
                'metadata' => [
                    'source' => 'account_item_settlement',
                    'account_item_id' => $item->id,
                    'account_item_type' => $item->item_type,
                ],
            ]));

            $newPaidAmount = (float) $item->paid_amount + $paidAmount;
            $item->update([
                'paid_amount' => $newPaidAmount,
                'status' => $newPaidAmount >= (float) $item->amount ? 'paid' : 'open',
                'paid_at' => $newPaidAmount >= (float) $item->amount ? $validated['transaction_date'] : null,
                'settlement_entry_id' => $entry->id,
            ]);

            $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_ACCOUNT_ITEM_SETTLED', 'Bookkeeping account item settled.', [
                'account_item_id' => $item->id,
                'settlement_entry_id' => $entry->id,
                'before' => $before,
                'after' => Arr::only($item->fresh()->toArray(), $this->accountItemAuditedFields()),
            ]);

            return response()->json([
                'message' => $item->item_type === 'receivable' ? 'Receivable collection recorded.' : 'Payable payment recorded.',
                'data' => $item->fresh(['staff.user:id,name', 'user:id,name', 'settlementEntry']),
                'entry' => $entry->fresh(['staff.user:id,name', 'user:id,name']),
            ]);
        });
    }

    public function accountItemVoid(Request $request, RetailBookkeepingAccountItem $item): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $item->merchant_id === (int) $merchant->id, 403);
        abort_if($item->status === 'paid', 422, 'Paid account items cannot be voided here. Void the settlement entry first.');
        abort_if($item->status === 'voided', 422, 'Account item is already voided.');
        $this->abortIfPeriodLocked($merchant->id, $item->issue_date);

        $validated = $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $before = Arr::only($item->toArray(), $this->accountItemAuditedFields());
        $item->update([
            'status' => 'voided',
            'void_reason' => $validated['reason'],
        ]);

        $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_ACCOUNT_ITEM_VOIDED', 'Bookkeeping account item voided.', [
            'account_item_id' => $item->id,
            'reason' => $validated['reason'],
            'before' => $before,
            'after' => Arr::only($item->fresh()->toArray(), $this->accountItemAuditedFields()),
        ]);

        return response()->json([
            'message' => 'Account item voided.',
            'data' => $item->fresh(['staff.user:id,name', 'user:id,name']),
        ]);
    }

    public function adjustmentStore(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $validated = $request->validate([
            'entry_type' => ['required', Rule::in(self::ENTRY_TYPES)],
            'adjustment_reason' => ['required', Rule::in(self::ADJUSTMENT_REASONS)],
            'adjustment_account' => 'required|string|max:120',
            'counterparty' => 'nullable|string|max:160',
            'amount' => 'required|numeric|min:0.01|max:999999999999.99',
            'reference_type' => ['nullable', Rule::in(self::REFERENCE_TYPES)],
            'reference_number' => 'nullable|string|max:160',
            'transaction_date' => 'required|date',
            'description' => 'required|string|max:2000',
            'proof_status' => ['nullable', Rule::in(self::PROOF_STATUSES)],
            'reconciliation_status' => ['nullable', Rule::in(self::RECONCILIATION_STATUSES)],
            'statement_reference' => 'nullable|string|max:160',
            'attachment' => 'nullable|file|max:10240|mimes:jpg,jpeg,png,webp,pdf,csv,xls,xlsx,doc,docx,txt',
        ]);

        $this->abortIfPeriodLocked($merchant->id, $validated['transaction_date']);

        return DB::transaction(function () use ($request, $merchant, $validated) {
            $filePayload = $this->storeAttachment($request, $merchant->id);
            $proofStatus = $validated['proof_status'] ?? $this->inferProofStatus($filePayload, $validated);

            $entry = RetailBookkeepingEntry::create(array_merge($filePayload, [
                'merchant_id' => $merchant->id,
                'staff_id' => $request->attributes->get('active_staff')?->id,
                'user_id' => $request->user()?->id,
                'entry_type' => $validated['entry_type'],
                'category' => 'Adjustment Entry',
                'counterparty' => $validated['counterparty'] ?? null,
                'amount' => $validated['amount'],
                'currency_code' => $merchant->currency?->code ?? 'TZS',
                'payment_method' => 'other',
                'reference_type' => $validated['reference_type'] ?? 'other',
                'reference_number' => $validated['reference_number'] ?? null,
                'transaction_date' => $validated['transaction_date'],
                'description' => $validated['description'],
                'status' => 'active',
                'proof_status' => $proofStatus,
                'review_status' => 'pending',
                'reconciliation_status' => $validated['reconciliation_status'] ?? 'needs_review',
                'statement_reference' => $validated['statement_reference'] ?? null,
                'metadata' => [
                    'source' => 'adjustment_entry',
                    'adjustment_reason' => $validated['adjustment_reason'],
                    'adjustment_account' => $validated['adjustment_account'],
                ],
            ]));

            $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_ADJUSTMENT_CREATED', 'Bookkeeping adjustment entry created.', [
                'entry_id' => $entry->id,
                'entry' => Arr::only($entry->toArray(), $this->auditedFields()),
                'adjustment_reason' => $validated['adjustment_reason'],
                'adjustment_account' => $validated['adjustment_account'],
            ]);

            return response()->json([
                'message' => 'Adjustment entry saved for review.',
                'data' => $entry->fresh(['staff.user:id,name', 'user:id,name', 'reviewedBy:id,name', 'reconciledBy:id,name']),
            ], 201);
        });
    }

    public function statementImport(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $validated = $request->validate([
            'source_type' => ['required', Rule::in(['bank', 'mobile_money', 'card', 'other'])],
            'source_name' => 'nullable|string|max:120',
            'statement' => 'required|file|max:10240|mimes:csv,txt',
        ]);

        $file = $request->file('statement');
        $handle = fopen($file->getRealPath(), 'r');
        abort_unless($handle, 422, 'Could not read statement file.');

        $header = fgetcsv($handle);
        abort_if(!$header, 422, 'Statement file must include a header row.');

        $header = array_map(fn($value) => $this->normalizeCsvKey((string) $value), $header);
        $created = 0;
        $skipped = 0;

        DB::transaction(function () use ($handle, $header, $merchant, $request, $validated, &$created, &$skipped) {
            while (($row = fgetcsv($handle)) !== false) {
                $data = [];
                foreach ($header as $index => $key) {
                    $data[$key] = $row[$index] ?? null;
                }

                $parsed = $this->parseStatementLine($data);
                if (!$parsed) {
                    $skipped++;
                    continue;
                }

                RetailBookkeepingStatementLine::create(array_merge($parsed, [
                    'merchant_id' => $merchant->id,
                    'user_id' => $request->user()?->id,
                    'source_type' => $validated['source_type'],
                    'source_name' => $validated['source_name'] ?? null,
                    'currency_code' => $merchant->currency?->code ?? 'TZS',
                    'status' => 'unmatched',
                    'raw_payload' => $data,
                ]));
                $created++;
            }

            $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_STATEMENT_IMPORTED', 'Statement file imported for reconciliation.', [
                'source_type' => $validated['source_type'],
                'source_name' => $validated['source_name'] ?? null,
                'created' => $created,
                'skipped' => $skipped,
            ]);
        });

        fclose($handle);

        return response()->json([
            'message' => "Imported {$created} statement lines.",
            'created' => $created,
            'skipped' => $skipped,
            'data' => $this->statementReconciliation($merchant->id),
        ], 201);
    }

    public function statementStore(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $validated = $request->validate([
            'source_type' => ['required', Rule::in(['bank', 'mobile_money', 'card', 'other'])],
            'source_name' => 'nullable|string|max:120',
            'transaction_date' => 'required|date',
            'line_type' => ['required', Rule::in(['credit', 'debit'])],
            'amount' => 'required|numeric|min:0.01|max:999999999999.99',
            'reference_number' => 'nullable|string|max:160',
            'counterparty' => 'nullable|string|max:160',
            'description' => 'nullable|string|max:2000',
            'attachment' => 'nullable|file|max:10240|mimes:jpg,jpeg,png,webp,pdf,csv,xls,xlsx,doc,docx,txt',
        ]);

        $line = DB::transaction(function () use ($merchant, $request, $validated) {
            $filePayload = $this->storeAttachment($request, $merchant->id);

            $line = RetailBookkeepingStatementLine::create(array_merge([
                'merchant_id' => $merchant->id,
                'user_id' => $request->user()?->id,
                'source_type' => $validated['source_type'],
                'source_name' => $validated['source_name'] ?? null,
                'transaction_date' => $validated['transaction_date'],
                'reference_number' => $validated['reference_number'] ?? null,
                'counterparty' => $validated['counterparty'] ?? null,
                'description' => $validated['description'] ?? null,
                'line_type' => $validated['line_type'],
                'amount' => $validated['amount'],
                'currency_code' => $merchant->currency?->code ?? 'TZS',
                'status' => 'unmatched',
                'raw_payload' => [
                    'source' => 'manual_entry',
                    'captured_fields' => Arr::only($validated, [
                        'source_type',
                        'source_name',
                        'transaction_date',
                        'line_type',
                        'amount',
                        'reference_number',
                        'counterparty',
                        'description',
                    ]),
                ],
            ], $filePayload));

            $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_STATEMENT_LINE_CREATED', 'Statement line added manually for reconciliation.', [
                'line_id' => $line->id,
                'source_type' => $validated['source_type'],
                'source_name' => $validated['source_name'] ?? null,
                'amount' => $validated['amount'],
                'line_type' => $validated['line_type'],
                'proof_attached' => !empty($filePayload['attachment_path']),
            ]);

            return $line;
        });

        return response()->json([
            'message' => 'Statement line added.',
            'data' => $this->statementReconciliation($merchant->id),
            'line' => $line,
        ], 201);
    }

    public function statementMatch(Request $request, RetailBookkeepingStatementLine $line): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $line->merchant_id === (int) $merchant->id, 403);
        abort_if($line->status === 'matched', 422, 'Statement line is already matched.');

        $validated = $request->validate([
            'entry_id' => 'required|integer|exists:retail_bookkeeping_entries,id',
        ]);

        $entry = RetailBookkeepingEntry::query()
            ->where('merchant_id', $merchant->id)
            ->where('id', $validated['entry_id'])
            ->where('status', 'active')
            ->firstOrFail();

        $this->abortIfPeriodLocked($merchant->id, $entry->transaction_date);

        return DB::transaction(function () use ($request, $merchant, $line, $entry) {
            $before = Arr::only($entry->toArray(), $this->auditedFields());
            $statementReference = $line->reference_number ?: 'statement-line-' . $line->id;

            $entry->update([
                'reconciliation_status' => 'matched',
                'statement_reference' => $statementReference,
                'reconciled_by_user_id' => $request->user()?->id,
                'reconciled_at' => now(),
            ]);

            $line->update([
                'matched_entry_id' => $entry->id,
                'status' => 'matched',
                'matched_at' => now(),
            ]);

            $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_STATEMENT_LINE_MATCHED', 'Statement line matched to bookkeeping record.', [
                'statement_line_id' => $line->id,
                'entry_id' => $entry->id,
                'before' => $before,
                'after' => Arr::only($entry->fresh()->toArray(), $this->auditedFields()),
            ]);

            return response()->json([
                'message' => 'Statement line matched.',
                'line' => $line->fresh(['matchedEntry:id,entry_type,category,amount,transaction_date,reference_number']),
                'entry' => $entry->fresh(['staff.user:id,name', 'user:id,name', 'reviewedBy:id,name', 'reconciledBy:id,name']),
            ]);
        });
    }

    public function statementIgnore(Request $request, RetailBookkeepingStatementLine $line): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $line->merchant_id === (int) $merchant->id, 403);
        abort_if($line->status === 'matched', 422, 'Matched statement lines cannot be ignored.');

        $line->update(['status' => 'ignored']);

        $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_STATEMENT_LINE_IGNORED', 'Statement line ignored during reconciliation.', [
            'statement_line_id' => $line->id,
            'reference_number' => $line->reference_number,
        ]);

        return response()->json([
            'message' => 'Statement line ignored.',
            'data' => $line->fresh(),
        ]);
    }

    public function obligationStore(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $validated = $request->validate([
            'title' => 'required|string|max:160',
            'obligation_type' => ['required', Rule::in(['annual_return', 'tax_filing', 'license_renewal', 'payroll_tax', 'custom'])],
            'authority' => 'nullable|string|max:120',
            'due_date' => 'required|date',
            'remind_days_before' => 'nullable|integer|min:0|max:365',
            'sms_reminder_enabled' => 'nullable|boolean',
            'reference_number' => 'nullable|string|max:160',
            'description' => 'nullable|string|max:2000',
        ]);

        $obligation = RetailBusinessObligation::create(array_merge($validated, [
            'merchant_id' => $merchant->id,
            'user_id' => $request->user()?->id,
            'status' => 'open',
            'remind_days_before' => $validated['remind_days_before'] ?? 14,
            'sms_reminder_enabled' => $request->boolean('sms_reminder_enabled', true),
        ]));

        $this->writeAuditLog($request, $merchant->id, 'BUSINESS_OBLIGATION_CREATED', 'Business obligation reminder created.', [
            'obligation_id' => $obligation->id,
            'title' => $obligation->title,
            'due_date' => $obligation->due_date?->toDateString(),
        ]);

        return response()->json(['message' => 'Business reminder saved.', 'data' => $obligation], 201);
    }

    public function obligationComplete(Request $request, RetailBusinessObligation $obligation): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $obligation->merchant_id === (int) $merchant->id, 403);

        $obligation->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        $this->writeAuditLog($request, $merchant->id, 'BUSINESS_OBLIGATION_COMPLETED', 'Business obligation marked completed.', [
            'obligation_id' => $obligation->id,
            'title' => $obligation->title,
        ]);

        return response()->json(['message' => 'Reminder completed.', 'data' => $obligation->fresh()]);
    }

    public function recurringBillStore(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $validated = $request->validate([
            'vendor' => 'required|string|max:160',
            'category' => 'required|string|max:120',
            'amount' => 'required|numeric|min:0.01|max:999999999999.99',
            'frequency' => ['required', Rule::in(['weekly', 'monthly', 'quarterly', 'yearly'])],
            'next_due_date' => 'required|date',
            'remind_days_before' => 'nullable|integer|min:0|max:365',
            'sms_reminder_enabled' => 'nullable|boolean',
            'payment_method' => ['required', Rule::in(self::PAYMENT_METHODS)],
            'reference_type' => ['nullable', Rule::in(self::REFERENCE_TYPES)],
            'description' => 'nullable|string|max:2000',
        ]);

        $bill = RetailRecurringBill::create(array_merge($validated, [
            'merchant_id' => $merchant->id,
            'user_id' => $request->user()?->id,
            'currency_code' => $merchant->currency?->code ?? 'TZS',
            'status' => 'active',
            'remind_days_before' => $validated['remind_days_before'] ?? 7,
            'sms_reminder_enabled' => $request->boolean('sms_reminder_enabled', true),
        ]));

        $this->writeAuditLog($request, $merchant->id, 'RECURRING_BILL_CREATED', 'Recurring bill created.', [
            'bill_id' => $bill->id,
            'vendor' => $bill->vendor,
            'next_due_date' => $bill->next_due_date?->toDateString(),
        ]);

        return response()->json(['message' => 'Recurring bill saved.', 'data' => $bill], 201);
    }

    public function recurringBillPay(Request $request, RetailRecurringBill $bill): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $bill->merchant_id === (int) $merchant->id, 403);

        $validated = $request->validate([
            'amount' => 'nullable|numeric|min:0.01|max:999999999999.99',
            'transaction_date' => 'required|date',
            'reference_number' => 'nullable|string|max:160',
            'proof_status' => ['nullable', Rule::in(self::PROOF_STATUSES)],
            'attachment' => 'nullable|file|max:10240|mimes:jpg,jpeg,png,webp,pdf,csv,xls,xlsx,doc,docx,txt',
        ]);

        $this->abortIfPeriodLocked($merchant->id, $validated['transaction_date']);

        return DB::transaction(function () use ($request, $merchant, $bill, $validated) {
            $filePayload = $this->storeAttachment($request, $merchant->id);
            $amount = $validated['amount'] ?? $bill->amount;
            $entry = RetailBookkeepingEntry::create(array_merge($filePayload, [
                'merchant_id' => $merchant->id,
                'staff_id' => $request->attributes->get('active_staff')?->id,
                'user_id' => $request->user()?->id,
                'entry_type' => 'expense',
                'category' => $bill->category,
                'counterparty' => $bill->vendor,
                'amount' => $amount,
                'currency_code' => $merchant->currency?->code ?? $bill->currency_code,
                'payment_method' => $bill->payment_method,
                'reference_type' => $bill->reference_type,
                'reference_number' => $validated['reference_number'] ?? null,
                'transaction_date' => $validated['transaction_date'],
                'description' => $bill->description ?: "Recurring bill payment for {$bill->vendor}",
                'status' => 'active',
                'proof_status' => $validated['proof_status'] ?? $this->inferProofStatus($filePayload, $validated),
                'review_status' => 'approved',
                'reviewed_by_user_id' => $request->user()?->id,
                'reviewed_at' => now(),
                'reconciliation_status' => 'unmatched',
                'metadata' => ['source' => 'recurring_bill', 'recurring_bill_id' => $bill->id],
            ]));

            $bill->update([
                'last_paid_at' => $validated['transaction_date'],
                'next_due_date' => $this->nextDueDate($bill->frequency, $bill->next_due_date)->toDateString(),
            ]);

            $this->writeAuditLog($request, $merchant->id, 'RECURRING_BILL_PAID', 'Recurring bill paid and posted to bookkeeping.', [
                'bill_id' => $bill->id,
                'entry_id' => $entry->id,
            ]);

            return response()->json([
                'message' => 'Bill payment recorded.',
                'data' => $bill->fresh(),
                'entry' => $entry->fresh(['staff.user:id,name', 'user:id,name']),
            ]);
        });
    }

    public function payrollStore(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $validated = $request->validate([
            'worker_name' => 'required|string|max:160',
            'worker_type' => ['required', Rule::in(['employee', 'contractor', 'casual'])],
            'role' => 'nullable|string|max:120',
            'gross_amount' => 'required|numeric|min:0.01|max:999999999999.99',
            'deductions_amount' => 'nullable|numeric|min:0|max:999999999999.99',
            'pay_period' => 'required|string|max:40',
            'pay_date' => 'required|date',
            'payment_method' => ['required', Rule::in(self::PAYMENT_METHODS)],
            'reference_number' => 'nullable|string|max:160',
            'tax_type' => 'nullable|string|max:80',
            'description' => 'nullable|string|max:2000',
            'attachment' => 'nullable|file|max:10240|mimes:jpg,jpeg,png,webp,pdf,csv,xls,xlsx,doc,docx,txt',
        ]);

        $deductions = (float) ($validated['deductions_amount'] ?? 0);
        $gross = (float) $validated['gross_amount'];
        $filePayload = $this->storeAttachment($request, $merchant->id);

        $payroll = RetailPayrollRecord::create(array_merge($validated, $filePayload, [
            'merchant_id' => $merchant->id,
            'user_id' => $request->user()?->id,
            'currency_code' => $merchant->currency?->code ?? 'TZS',
            'deductions_amount' => $deductions,
            'net_amount' => max(0, $gross - $deductions),
            'status' => 'pending',
        ]));

        $this->writeAuditLog($request, $merchant->id, 'PAYROLL_RECORD_CREATED', 'Payroll-lite record created.', [
            'payroll_id' => $payroll->id,
            'worker_name' => $payroll->worker_name,
            'pay_period' => $payroll->pay_period,
            'proof_attached' => !empty($filePayload['attachment_path']),
        ]);

        return response()->json(['message' => 'Payroll record saved.', 'data' => $payroll], 201);
    }

    public function payrollPay(Request $request, RetailPayrollRecord $payroll): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $payroll->merchant_id === (int) $merchant->id, 403);
        abort_if($payroll->status === 'paid', 422, 'Payroll record is already paid.');
        $this->abortIfPeriodLocked($merchant->id, $payroll->pay_date);

        return DB::transaction(function () use ($request, $merchant, $payroll) {
            $proofStatus = $payroll->attachment_path ? 'attached' : ($payroll->reference_number ? 'reference_only' : 'missing');

            $entry = RetailBookkeepingEntry::create([
                'merchant_id' => $merchant->id,
                'staff_id' => $request->attributes->get('active_staff')?->id,
                'user_id' => $request->user()?->id,
                'entry_type' => 'expense',
                'category' => 'Payroll',
                'counterparty' => $payroll->worker_name,
                'amount' => $payroll->net_amount,
                'currency_code' => $merchant->currency?->code ?? $payroll->currency_code,
                'payment_method' => $payroll->payment_method,
                'reference_type' => 'bank_transaction',
                'reference_number' => $payroll->reference_number,
                'tax_type' => $payroll->tax_type,
                'tax_period' => $payroll->pay_period,
                'transaction_date' => $payroll->pay_date,
                'description' => $payroll->description ?: "Payroll payment for {$payroll->worker_name} ({$payroll->pay_period})",
                'status' => 'active',
                'proof_status' => $proofStatus,
                'review_status' => 'approved',
                'reviewed_by_user_id' => $request->user()?->id,
                'reviewed_at' => now(),
                'reconciliation_status' => 'unmatched',
                'attachment_disk' => $payroll->attachment_disk,
                'attachment_path' => $payroll->attachment_path,
                'attachment_original_name' => $payroll->attachment_original_name,
                'attachment_mime' => $payroll->attachment_mime,
                'attachment_size' => $payroll->attachment_size,
                'metadata' => ['source' => 'payroll_lite', 'payroll_record_id' => $payroll->id],
            ]);

            $payroll->update([
                'status' => 'paid',
                'bookkeeping_entry_id' => $entry->id,
            ]);

            $this->writeAuditLog($request, $merchant->id, 'PAYROLL_RECORD_PAID', 'Payroll-lite record posted to bookkeeping.', [
                'payroll_id' => $payroll->id,
                'entry_id' => $entry->id,
            ]);

            return response()->json([
                'message' => 'Payroll payment posted.',
                'data' => $payroll->fresh('bookkeepingEntry'),
                'entry' => $entry->fresh(['staff.user:id,name', 'user:id,name']),
            ]);
        });
    }

    public function shareLinkStore(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $validated = $request->validate([
            'recipient_name' => 'nullable|string|max:160',
            'recipient_role' => ['required', Rule::in(['accountant', 'auditor', 'tax_authority', 'advisor', 'other'])],
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date|after_or_equal:from_date',
            'expires_at' => 'nullable|date|after:now',
            'sections' => 'nullable|array',
            'pin' => 'nullable|string|min:4|max:40',
            'include_proofs' => 'nullable|boolean',
            'allow_downloads' => 'nullable|boolean',
        ]);

        $link = RetailBookkeepingShareLink::create(array_merge(Arr::except($validated, ['pin']), [
            'merchant_id' => $merchant->id,
            'user_id' => $request->user()?->id,
            'token' => Str::random(48),
            'password_hash' => !empty($validated['pin']) ? Hash::make($validated['pin']) : null,
            'sections' => $validated['sections'] ?? ['summary', 'records', 'proofs', 'reports'],
            'include_proofs' => $request->boolean('include_proofs', true),
            'allow_downloads' => $request->boolean('allow_downloads', false),
            'status' => 'active',
        ]));

        $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_SHARE_LINK_CREATED', 'Bookkeeping read-only share link created.', [
            'share_link_id' => $link->id,
            'recipient_role' => $link->recipient_role,
            'from_date' => $link->from_date?->toDateString(),
            'to_date' => $link->to_date?->toDateString(),
            'expires_at' => $link->expires_at?->toIso8601String(),
        ]);

        return response()->json([
            'message' => 'Secure share link created.',
            'data' => $link,
            'url' => url("/bookkeeping-share/{$link->token}"),
        ], 201);
    }

    public function shareLinkRevoke(Request $request, RetailBookkeepingShareLink $shareLink): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $shareLink->merchant_id === (int) $merchant->id, 403);

        $shareLink->update([
            'status' => 'revoked',
            'revoked_at' => now(),
        ]);

        $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_SHARE_LINK_REVOKED', 'Bookkeeping share link revoked.', [
            'share_link_id' => $shareLink->id,
            'recipient_role' => $shareLink->recipient_role,
        ]);

        return response()->json(['message' => 'Share link revoked.', 'data' => $shareLink->fresh()]);
    }

    public function publicShare(Request $request, string $token): Response
    {
        $link = RetailBookkeepingShareLink::query()
            ->where('token', $token)
            ->where('status', 'active')
            ->with('merchant.currency')
            ->firstOrFail();

        abort_if($link->revoked_at, 410, 'This bookkeeping share link has been revoked.');
        abort_if($link->expires_at && $link->expires_at->isPast(), 410, 'This bookkeeping share link has expired.');

        $shareSessionKey = $this->shareSessionKey($link);
        $hasShareSession = $request->session()->get($shareSessionKey) === true;

        if ($link->password_hash && !$hasShareSession && (!$request->isMethod('post') || !Hash::check((string) $request->input('pin'), $link->password_hash))) {
            $this->logShareAccess($link, $request, $request->isMethod('post') ? 'pin_failed' : 'pin_required');

            return response($this->sharePinForm($link, $request->isMethod('post')));
        }

        if ($link->password_hash && !$hasShareSession) {
            $request->session()->put($shareSessionKey, true);
            $request->session()->put($shareSessionKey . ':authorized_at', now()->toIso8601String());
            $hasShareSession = true;
            $this->logShareAccess($link, $request, 'pin_verified');
        }

        $link->increment('access_count');
        $link->forceFill(['last_accessed_at' => now()])->save();
        $this->logShareAccess($link, $request, 'viewed');

        $shareRequest = new Request(array_filter([
            'from' => $link->from_date?->toDateString(),
            'to' => $link->to_date?->toDateString(),
        ]));
        $merchant = $link->merchant;
        $entries = $this->summaryQuery($merchant->id, $shareRequest)
            ->latest('transaction_date')
            ->limit(200)
            ->get();
        $summary = $this->summary($merchant->id, $shareRequest);
        $currency = e($merchant->currency?->code ?? 'TZS');
        $merchantName = e($merchant->name ?? $merchant->username);

        $rows = $entries->map(function (RetailBookkeepingEntry $entry) use ($currency, $link) {
            $proof = e($entry->proof_status);
            if ($link->include_proofs && $entry->attachment_url) {
                $proof = '<a href="' . e($entry->attachment_url) . '" target="_blank" rel="noreferrer">View proof</a>';
            }

            return '<tr>'
                . '<td>' . e($entry->transaction_date?->toDateString()) . '</td>'
                . '<td>' . e($entry->entry_type) . '</td>'
                . '<td>' . e($entry->category) . '</td>'
                . '<td>' . e($entry->counterparty ?: '-') . '</td>'
                . '<td>' . e($currency . ' ' . number_format((float) $entry->amount, 2)) . '</td>'
                . '<td>' . e($entry->reference_number ?: '-') . '</td>'
                . '<td>' . $proof . '</td>'
                . '</tr>';
        })->implode('');

        $downloadButton = $link->allow_downloads && (!$link->password_hash || $hasShareSession)
            ? '<a class="button" href="/bookkeeping-share/' . e($link->token) . '/download">Download CSV</a>'
            : '';
        $html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>Bookkeeping Share</title><style>body{font-family:Inter,Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px}main{max-width:1100px;margin:auto}.panel{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin-bottom:16px}h1{margin:0 0 6px;font-size:26px}.muted{color:#64748b;font-size:13px}.button{display:inline-block;margin-top:12px;border-radius:10px;background:#2563eb;color:white;padding:10px 14px;text-decoration:none}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px}.stat strong{display:block;font-size:18px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left}th{font-size:11px;text-transform:uppercase;color:#64748b}a{color:#2563eb;font-weight:700}</style></head><body><main>'
            . '<section class="panel"><h1>' . $merchantName . ' Bookkeeping Records</h1><p class="muted">Read-only share for ' . e($link->recipient_name ?: $link->recipient_role) . '. Generated by Takeer Retail Ops. Accountant/auditor review still applies.</p>' . $downloadButton . '</section>'
            . '<section class="panel grid">'
            . '<div class="stat"><strong>' . e($currency . ' ' . number_format((float) $summary['income'], 2)) . '</strong><span class="muted">Income</span></div>'
            . '<div class="stat"><strong>' . e($currency . ' ' . number_format((float) $summary['expenses'], 2)) . '</strong><span class="muted">Expenses</span></div>'
            . '<div class="stat"><strong>' . e($currency . ' ' . number_format((float) $summary['tax_payments'], 2)) . '</strong><span class="muted">Tax paid</span></div>'
            . '<div class="stat"><strong>' . e($summary['missing_attachments']) . '</strong><span class="muted">Proof gaps</span></div>'
            . '</section>'
            . '<section class="panel"><table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Counterparty</th><th>Amount</th><th>Reference</th><th>Proof</th></tr></thead><tbody>'
            . ($rows ?: '<tr><td colspan="7">No records in this period.</td></tr>')
            . '</tbody></table></section>'
            . '</main></body></html>';

        return response($html);
    }

    public function publicShareDownload(Request $request, string $token): Response
    {
        $link = RetailBookkeepingShareLink::query()
            ->where('token', $token)
            ->where('status', 'active')
            ->firstOrFail();

        abort_unless($link->allow_downloads, 403);
        abort_if($link->revoked_at || ($link->expires_at && $link->expires_at->isPast()), 410);
        abort_if($link->password_hash && $request->session()->get($this->shareSessionKey($link)) !== true, 403);

        $shareRequest = new Request(array_filter([
            'from' => $link->from_date?->toDateString(),
            'to' => $link->to_date?->toDateString(),
        ]));
        $this->logShareAccess($link, $request, 'downloaded');

        return response()->streamDownload(function () use ($link, $shareRequest) {
            echo $this->ledgerCsv($link->merchant_id, $shareRequest);
        }, 'bookkeeping-share-' . now()->format('Y-m-d-His') . '.csv', ['Content-Type' => 'text/csv']);
    }

    private function sharePinForm(RetailBookkeepingShareLink $link, bool $failed = false): string
    {
        $error = $failed ? '<p class="error">Incorrect PIN. Please try again.</p>' : '';

        return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>Protected Bookkeeping Share</title><style>body{font-family:Inter,Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px;display:grid;min-height:100vh;place-items:center}.panel{width:min(420px,100%);background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px}h1{margin:0 0 8px;font-size:22px}.muted{color:#64748b;font-size:13px}.error{color:#b91c1c;font-size:13px;font-weight:700}input{width:100%;height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px;font-size:16px;box-sizing:border-box}button{height:42px;border:0;border-radius:10px;background:#2563eb;color:white;font-weight:800;padding:0 16px;margin-top:12px;width:100%}</style></head><body>'
            . '<form class="panel" method="POST" action="/bookkeeping-share/' . e($link->token) . '"><h1>Protected bookkeeping records</h1><p class="muted">Enter the PIN provided by the business owner.</p>'
            . csrf_field()
            . $error
            . '<input name="pin" type="password" inputmode="numeric" autocomplete="one-time-code" autofocus required><button type="submit">View Records</button></form></body></html>';
    }

    private function shareSessionKey(RetailBookkeepingShareLink $link): string
    {
        return "bookkeeping_share:{$link->id}:authorized";
    }

    private function logShareAccess(RetailBookkeepingShareLink $link, Request $request, string $event): void
    {
        RetailBookkeepingShareAccessLog::create([
            'retail_bookkeeping_share_link_id' => $link->id,
            'merchant_id' => $link->merchant_id,
            'event' => $event,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
            'metadata' => [
                'recipient_role' => $link->recipient_role,
            ],
        ]);
    }

    public function export(Request $request): Response
    {
        $merchant = $request->attributes->get('active_merchant');
        $query = RetailBookkeepingEntry::query()
            ->where('merchant_id', $merchant->id)
            ->with(['staff.user:id,name', 'user:id,name'])
            ->orderBy('transaction_date')
            ->orderBy('id');

        if ($request->filled('type')) {
            $query->where('entry_type', $request->input('type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('from')) {
            $query->whereDate('transaction_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('transaction_date', '<=', $request->input('to'));
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->input('q'));
            $query->where(function ($q) use ($term) {
                $q->where('category', 'like', "%{$term}%")
                    ->orWhere('counterparty', 'like', "%{$term}%")
                    ->orWhere('reference_number', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%");
            });
        }

        $entries = $query->get();

        $headers = [
            'Date', 'Type', 'Category', 'Counterparty', 'Amount', 'Currency', 'Payment Method',
            'Reference Type', 'Reference Number', 'Tax Type', 'Tax Period', 'Status', 'Proof Status',
            'Review Status', 'Reconciliation Status', 'Statement Reference', 'Recorded By', 'Recorded At',
            'Attachment', 'Description',
        ];

        $callback = function () use ($entries, $headers) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers);

            foreach ($entries as $entry) {
                fputcsv($handle, [
                    $entry->transaction_date?->toDateString(),
                    $entry->entry_type,
                    $entry->category,
                    $entry->counterparty,
                    $entry->amount,
                    $entry->currency_code,
                    $entry->payment_method,
                    $entry->reference_type,
                    $entry->reference_number,
                    $entry->tax_type,
                    $entry->tax_period,
                    $entry->status,
                    $entry->proof_status,
                    $entry->review_status,
                    $entry->reconciliation_status,
                    $entry->statement_reference,
                    $entry->staff?->user?->name ?? $entry->user?->name,
                    $entry->created_at?->toDateTimeString(),
                    $entry->attachment_original_name,
                    $entry->description,
                ]);
            }

            fclose($handle);
        };

        $filename = 'retail-bookkeeping-' . now()->format('Y-m-d-His') . '.csv';

        return response()->streamDownload($callback, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function exportReport(Request $request, string $report): Response
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless(in_array($report, $this->reportSlugs(), true), 404);

        $filename = "retail-bookkeeping-{$report}-" . now()->format('Y-m-d-His') . '.csv';

        return response()->streamDownload(function () use ($merchant, $request, $report) {
            echo $this->reportCsv($merchant->id, $request, $report);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function exportTaxWizard(Request $request, string $wizard): Response
    {
        $merchant = $request->attributes->get('active_merchant');
        $merchant->loadMissing('country');
        $definitions = collect($this->taxWizardDefinitions($merchant->country))->keyBy('key');
        abort_unless($definitions->has($wizard), 404);

        $filename = "retail-bookkeeping-tax-{$wizard}-" . now()->format('Y-m-d-His') . '.csv';

        return response()->streamDownload(function () use ($merchant, $request, $definitions, $wizard) {
            echo $this->taxWizardCsv($merchant->id, $request, $definitions->get($wizard));
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function auditPack(Request $request): Response
    {
        $merchant = $request->attributes->get('active_merchant');
        $timestamp = now()->format('Y-m-d-His');
        $safeMerchant = preg_replace('/[^A-Za-z0-9_-]+/', '-', $merchant->username ?? 'merchant');
        $filename = "retail-bookkeeping-audit-pack-{$safeMerchant}-{$timestamp}.zip";
        $path = storage_path("app/{$filename}");

        $zip = new ZipArchive();
        abort_unless($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true, 500, 'Could not create audit pack.');

        $proofFiles = $this->addProofFilesToZip($zip, $merchant->id, $request);

        $zip->addFromString('manifest.json', json_encode([
            'merchant_id' => $merchant->id,
            'merchant' => $merchant->name ?? $merchant->username,
            'generated_at' => now()->toIso8601String(),
            'from' => $request->input('from'),
            'to' => $request->input('to'),
            'reports' => $this->reportSlugs(),
            'proof_files' => count($proofFiles),
            'note' => 'Management bookkeeping export. Accountant/auditor review is still required.',
        ], JSON_PRETTY_PRINT));

        $zip->addFromString('reports/full-ledger.csv', $this->ledgerCsv($merchant->id, $request));
        foreach ($this->reportSlugs() as $report) {
            $zip->addFromString("reports/{$report}.csv", $this->reportCsv($merchant->id, $request, $report));
        }
        $zip->addFromString('proofs/proof-index.csv', $this->csvString(array_merge([[
            'Record Type', 'Record ID', 'Date', 'Category', 'Counterparty', 'Amount', 'Original Name', 'Zip Path',
        ]], $proofFiles)));

        $zip->close();

        $this->writeAuditLog($request, $merchant->id, 'BOOKKEEPING_AUDIT_PACK_EXPORTED', 'Bookkeeping audit pack exported.', [
            'filename' => $filename,
            'from' => $request->input('from'),
            'to' => $request->input('to'),
            'proof_files' => count($proofFiles),
        ]);

        return response()->download($path, $filename, [
            'Content-Type' => 'application/zip',
        ])->deleteFileAfterSend(true);
    }

    private function validatedPayload(Request $request): array
    {
        return $request->validate([
            'entry_type' => ['required', Rule::in(self::ENTRY_TYPES)],
            'category' => 'required|string|max:120',
            'counterparty' => 'nullable|string|max:160',
            'amount' => 'required|numeric|min:0.01|max:999999999999.99',
            'currency_code' => 'nullable|string|max:8',
            'payment_method' => ['required', Rule::in(self::PAYMENT_METHODS)],
            'reference_type' => ['nullable', Rule::in(self::REFERENCE_TYPES)],
            'reference_number' => 'nullable|string|max:160',
            'tax_type' => 'nullable|string|max:80',
            'tax_period' => 'nullable|string|max:80',
            'transaction_date' => 'required|date',
            'description' => 'nullable|string|max:2000',
            'proof_status' => ['nullable', Rule::in(self::PROOF_STATUSES)],
            'reconciliation_status' => ['nullable', Rule::in(self::RECONCILIATION_STATUSES)],
            'statement_reference' => 'nullable|string|max:160',
            'attachment' => 'nullable|file|max:10240|mimes:jpg,jpeg,png,webp,pdf,csv,xls,xlsx,doc,docx,txt',
            'metadata' => 'nullable|array',
        ]);
    }

    private function ledgerCsv(int $merchantId, Request $request): string
    {
        $query = RetailBookkeepingEntry::query()
            ->where('merchant_id', $merchantId)
            ->with(['staff.user:id,name', 'user:id,name'])
            ->orderBy('transaction_date')
            ->orderBy('id');

        if ($request->filled('type')) {
            $query->where('entry_type', $request->input('type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('from')) {
            $query->whereDate('transaction_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('transaction_date', '<=', $request->input('to'));
        }

        $rows = [[
            'Date', 'Type', 'Category', 'Counterparty', 'Amount', 'Currency', 'Payment Method',
            'Reference Type', 'Reference Number', 'Tax Type', 'Tax Period', 'Status', 'Proof Status',
            'Review Status', 'Reconciliation Status', 'Statement Reference', 'Recorded By', 'Recorded At',
            'Attachment', 'Description',
        ]];

        foreach ($query->get() as $entry) {
            $rows[] = [
                $entry->transaction_date?->toDateString(),
                $entry->entry_type,
                $entry->category,
                $entry->counterparty,
                $entry->amount,
                $entry->currency_code,
                $entry->payment_method,
                $entry->reference_type,
                $entry->reference_number,
                $entry->tax_type,
                $entry->tax_period,
                $entry->status,
                $entry->proof_status,
                $entry->review_status,
                $entry->reconciliation_status,
                $entry->statement_reference,
                $entry->staff?->user?->name ?? $entry->user?->name,
                $entry->created_at?->toDateTimeString(),
                $entry->attachment_original_name,
                $entry->description,
            ];
        }

        return $this->csvString($rows);
    }

    private function reportCsv(int $merchantId, Request $request, string $report): string
    {
        $rows = $this->reportRows($merchantId, $request, $report);

        if (in_array($report, ['profit-loss', 'balance-sheet', 'cash-flow', 'trial-balance'], true)) {
            return $this->csvString(array_merge([['Line', 'Amount']], array_map(
                fn($row) => array_values($row),
                $rows
            )));
        }

        if (in_array($report, ['sales-by-channel', 'vendor-expenses', 'payroll-summary', 'share-access-logs'], true)) {
            $headers = [
                'sales-by-channel' => ['Channel', 'Amount', 'Count'],
                'vendor-expenses' => ['Vendor', 'Amount', 'Count'],
                'payroll-summary' => ['Pay Period', 'Gross', 'Deductions', 'Net', 'Count'],
                'share-access-logs' => ['Date', 'Recipient', 'Event', 'IP Address', 'User Agent'],
            ][$report];

            return $this->csvString(array_merge([$headers], array_map(fn($row) => array_values($row), $rows)));
        }

        if (in_array($report, ['ar-aging', 'ap-aging'], true)) {
            return $this->csvString(array_merge([['Bucket', 'Balance', 'Count']], array_map(
                fn($row) => [$row['bucket'], $row['balance'], $row['count']],
                $rows
            )));
        }

        if ($report === 'statement-lines') {
            $csvRows = [['Date', 'Source', 'Status', 'Type', 'Amount', 'Reference', 'Counterparty', 'Matched Entry', 'Proof File', 'Description']];
            foreach ($rows as $line) {
                $csvRows[] = [
                    $line->transaction_date?->toDateString(),
                    $line->source_name ?: $line->source_type,
                    $line->status,
                    $line->line_type,
                    $line->amount,
                    $line->reference_number,
                    $line->counterparty,
                    $line->matched_entry_id,
                    $line->attachment_original_name,
                    $line->description,
                ];
            }

            return $this->csvString($csvRows);
        }

        if (in_array($report, ['accounts-receivable', 'accounts-payable'], true)) {
            $csvRows = [['Issue Date', 'Due Date', 'Status', 'Counterparty', 'Category', 'Invoice', 'Amount', 'Paid Amount', 'Balance Due', 'Description']];
            foreach ($rows as $item) {
                $csvRows[] = [
                    $item->issue_date?->toDateString(),
                    $item->due_date?->toDateString(),
                    $item->status,
                    $item->counterparty,
                    $item->category,
                    $item->invoice_number,
                    $item->amount,
                    $item->paid_amount,
                    $item->balance_due,
                    $item->description,
                ];
            }

            return $this->csvString($csvRows);
        }

        $csvRows = [['Date', 'Type', 'Category', 'Counterparty', 'Amount', 'Reference', 'Proof Status', 'Review Status', 'Reconciliation', 'Description']];
        foreach ($rows as $entry) {
            $csvRows[] = [
                $entry->transaction_date?->toDateString(),
                $entry->entry_type,
                $entry->category,
                $entry->counterparty,
                $entry->amount,
                $entry->reference_number,
                $entry->proof_status,
                $entry->review_status,
                $entry->reconciliation_status,
                $entry->description,
            ];
        }

        return $this->csvString($csvRows);
    }

    private function reportRows(int $merchantId, Request $request, string $report)
    {
        $query = $this->summaryQuery($merchantId, $request);

        return match ($report) {
            'profit-loss' => $this->profitLossRows($merchantId, $request),
            'balance-sheet' => $this->balanceSheetRows($merchantId, $request),
            'cash-flow' => $this->cashFlowRows($merchantId, $request),
            'general-ledger' => (clone $query)->orderBy('transaction_date')->orderBy('id')->get(),
            'trial-balance' => $this->trialBalanceRows($merchantId, $request),
            'ar-aging' => $this->agingRows($merchantId, 'receivable'),
            'ap-aging' => $this->agingRows($merchantId, 'payable'),
            'vendor-expenses' => $this->vendorExpenseRows($merchantId, $request),
            'sales-by-channel' => $this->salesByChannelRows($merchantId, $request),
            'payroll-summary' => $this->payrollSummaryRows($merchantId, $request),
            'share-access-logs' => $this->shareAccessLogRows($merchantId),
            'director-loans' => (clone $query)->where('entry_type', 'director_loan')->latest('transaction_date')->get(),
            'tax-payments' => (clone $query)->where('entry_type', 'tax_payment')->latest('transaction_date')->get(),
            'missing-proofs' => (clone $query)->whereIn('proof_status', ['missing', 'needs_replacement'])->latest('transaction_date')->get(),
            'reconciliation' => (clone $query)->where('reconciliation_status', '!=', 'matched')->latest('transaction_date')->get(),
            'adjustments' => (clone $query)->where('category', 'Adjustment Entry')->latest('transaction_date')->get(),
            'statement-lines' => RetailBookkeepingStatementLine::query()->where('merchant_id', $merchantId)->latest('transaction_date')->get(),
            'accounts-receivable' => RetailBookkeepingAccountItem::query()->where('merchant_id', $merchantId)->where('item_type', 'receivable')->latest('due_date')->get(),
            'accounts-payable' => RetailBookkeepingAccountItem::query()->where('merchant_id', $merchantId)->where('item_type', 'payable')->latest('due_date')->get(),
            default => [],
        };
    }

    private function reportSlugs(): array
    {
        return [
            'profit-loss',
            'balance-sheet',
            'cash-flow',
            'general-ledger',
            'trial-balance',
            'ar-aging',
            'ap-aging',
            'vendor-expenses',
            'sales-by-channel',
            'payroll-summary',
            'share-access-logs',
            'director-loans',
            'tax-payments',
            'missing-proofs',
            'reconciliation',
            'adjustments',
            'statement-lines',
            'accounts-receivable',
            'accounts-payable',
        ];
    }

    private function taxWizardPack($merchant, Request $request): array
    {
        $merchant->loadMissing('country');
        $country = $merchant->country;
        $definitions = $this->taxWizardDefinitions($country);

        return [
            'country' => $country ? [
                'id' => $country->id,
                'name' => $country->name,
                'iso_alpha2' => $country->iso_alpha2,
                'tax_label' => $country->tax_label,
                'default_tax_rate' => $country->default_tax_rate,
            ] : null,
            'period' => [
                'from' => $request->input('from'),
                'to' => $request->input('to'),
            ],
            'note' => 'Bookkeeping support only. Accountant review and local tax filing rules still apply.',
            'wizards' => array_map(function (array $definition) use ($merchant, $request) {
                return array_merge($definition, [
                    'summary' => $this->taxWizardSummary($merchant->id, $request, $definition),
                ]);
            }, $definitions),
        ];
    }

    private function taxWizardDefinitions(?Country $country): array
    {
        $iso = strtoupper((string) ($country?->iso_alpha2 ?? ''));
        $rate = $country?->default_tax_rate !== null ? (float) $country->default_tax_rate : null;

        if ($iso === 'TZ') {
            return [
                [
                    'key' => 'vat',
                    'label' => 'VAT',
                    'tax_type' => 'VAT',
                    'payment_category' => 'VAT',
                    'base' => 'income_minus_expenses',
                    'rate' => $rate,
                    'applies_when' => 'Usually only if the business is VAT registered or advised to file VAT.',
                    'income_categories' => ['POS Sales', 'Online Orders', 'Direct Income', 'Commission', 'Premium Post Fees', 'Service Income', 'Accounts Receivable Collection'],
                    'expense_categories' => ['Stock Purchases', 'Digital Services', 'Utilities', 'Repairs', 'Professional Fees', 'Accounts Payable Payment'],
                    'tax_types' => ['VAT'],
                    'checklist' => [
                        'Sales entries captured from POS and online orders',
                        'EFD/VFD receipt references attached where applicable',
                        'Purchase expense proofs attached or referenced',
                        'Bank or mobile-money statement lines reconciled',
                        'VAT payment record attached after filing',
                    ],
                ],
                [
                    'key' => 'wht',
                    'label' => 'Withholding Tax',
                    'tax_type' => 'Withholding Tax',
                    'payment_category' => 'Withholding Tax',
                    'base' => 'expenses',
                    'rate' => null,
                    'applies_when' => 'May apply to specific supplier, rent, service, or contractor payments.',
                    'expense_categories' => ['Rent', 'Professional Fees', 'Transport', 'Marketing', 'Digital Services', 'Other Expense'],
                    'tax_types' => ['Withholding Tax', 'WHT'],
                    'checklist' => [
                        'Supplier invoices and contracts captured',
                        'Withholding certificates or TRA payment references attached',
                        'Payment method and statement reference reconciled',
                        'Tax period added to each payment entry',
                    ],
                ],
                [
                    'key' => 'payroll',
                    'label' => 'PAYE / SDL',
                    'tax_type' => 'PAYE',
                    'payment_category' => 'PAYE',
                    'base' => 'expenses',
                    'rate' => null,
                    'applies_when' => 'Only relevant when the business has employees or payroll obligations.',
                    'expense_categories' => ['Payroll'],
                    'tax_types' => ['PAYE', 'SDL'],
                    'checklist' => [
                        'Payroll expense summary recorded',
                        'PAYE and SDL payment proofs attached',
                        'Employee payroll worksheet stored as proof where available',
                        'Payment month locked after review',
                    ],
                ],
                [
                    'key' => 'tcra_fee',
                    'label' => 'TCRA Fee Support',
                    'tax_type' => 'TCRA',
                    'payment_category' => 'TRA Payment',
                    'base' => 'income',
                    'rate' => null,
                    'applies_when' => 'Only relevant for businesses with TCRA-regulated activities or licence fees.',
                    'income_categories' => ['Commission', 'Premium Post Fees', 'Service Income', 'Direct Income'],
                    'tax_types' => ['TCRA', 'TRA Payment'],
                    'checklist' => [
                        'Regulated service income separated from ordinary sales',
                        'TCRA or TRA payment reference attached',
                        'Annual support file exported for accountant review',
                    ],
                ],
            ];
        }

        $taxLabel = $country?->tax_label ?: 'Sales Tax';

        return [
            [
                'key' => 'sales_tax',
                'label' => $taxLabel,
                'tax_type' => $taxLabel,
                'payment_category' => 'Other Tax',
                'base' => 'income',
                'rate' => $rate,
                'applies_when' => 'Use when the business is required to file sales tax, VAT, or similar tax in its country.',
                'income_categories' => ['POS Sales', 'Online Orders', 'Direct Income', 'Service Income', 'Accounts Receivable Collection'],
                'tax_types' => [$taxLabel, 'VAT', 'Sales Tax'],
                'checklist' => [
                    'Sales entries captured for the selected period',
                    'Fiscal or invoice references attached where applicable',
                    'Payment proof attached after filing',
                    'Period locked after accountant review',
                ],
            ],
            [
                'key' => 'withholding',
                'label' => 'Withholding Tax',
                'tax_type' => 'Withholding Tax',
                'payment_category' => 'Withholding Tax',
                'base' => 'expenses',
                'rate' => null,
                'applies_when' => 'Use only where withholding applies to the business payments.',
                'expense_categories' => ['Professional Fees', 'Rent', 'Transport', 'Digital Services', 'Other Expense'],
                'tax_types' => ['Withholding Tax', 'WHT'],
                'checklist' => [
                    'Supplier records captured',
                    'Payment references attached',
                    'Tax period added to each payment entry',
                ],
            ],
        ];
    }

    private function taxWizardSummary(int $merchantId, Request $request, array $definition): array
    {
        $income = $this->taxWizardEntrySum($merchantId, $request, 'income', $definition['income_categories'] ?? []);
        $expenses = $this->taxWizardEntrySum($merchantId, $request, 'expense', $definition['expense_categories'] ?? []);
        $base = match ($definition['base'] ?? 'income') {
            'expenses' => $expenses,
            'income_minus_expenses' => max(0, $income - $expenses),
            default => $income,
        };

        $taxTypes = array_map('strtolower', $definition['tax_types'] ?? [$definition['tax_type'] ?? $definition['label']]);
        $paymentsQuery = $this->summaryQuery($merchantId, $request)
            ->where('entry_type', 'tax_payment')
            ->where(function ($query) use ($taxTypes, $definition) {
                foreach ($taxTypes as $type) {
                    $query->orWhereRaw('LOWER(tax_type) = ?', [$type])
                        ->orWhereRaw('LOWER(category) = ?', [$type]);
                }

                if (!empty($definition['payment_category'])) {
                    $query->orWhere('category', $definition['payment_category']);
                }
            });
        $payments = (float) (clone $paymentsQuery)->sum('amount');
        $paymentCount = (clone $paymentsQuery)->count();
        $scopeQuery = $this->taxWizardScopeQuery($merchantId, $request, $definition);
        $rate = $definition['rate'] ?? null;
        $estimated = $rate !== null ? max(0, ($base * ((float) $rate / 100)) - $payments) : null;
        $scopeCount = (clone $scopeQuery)->count();
        $missingProofs = (clone $scopeQuery)->whereIn('proof_status', ['missing', 'needs_replacement'])->count();
        $missingReferences = (clone $scopeQuery)->whereNull('reference_number')->count();
        $unmatched = (clone $scopeQuery)->where('reconciliation_status', '!=', 'matched')->count();
        $recordCount = $scopeCount + $paymentCount;
        $readinessScore = $recordCount > 0
            ? $this->taxWizardReadinessScore($missingProofs, $missingReferences, $unmatched, $paymentCount)
            : null;

        return [
            'income_base' => $income,
            'expense_base' => $expenses,
            'taxable_base' => $base,
            'recorded_payments' => $payments,
            'payment_count' => $paymentCount,
            'record_count' => $recordCount,
            'estimated_balance' => $estimated,
            'missing_proofs' => $missingProofs,
            'missing_references' => $missingReferences,
            'unmatched_records' => $unmatched,
            'readiness_score' => $readinessScore,
            'readiness_label' => $this->taxWizardReadinessLabel($readinessScore, $recordCount, $missingProofs, $missingReferences, $unmatched),
        ];
    }

    private function taxWizardEntrySum(int $merchantId, Request $request, string $entryType, array $categories): float
    {
        $query = $this->summaryQuery($merchantId, $request)->where('entry_type', $entryType);

        if (count($categories) > 0) {
            $query->whereIn('category', $categories);
        }

        return (float) $query->sum('amount');
    }

    private function taxWizardScopeQuery(int $merchantId, Request $request, array $definition)
    {
        $incomeCategories = $definition['income_categories'] ?? [];
        $expenseCategories = $definition['expense_categories'] ?? [];

        return $this->summaryQuery($merchantId, $request)
            ->where(function ($query) use ($incomeCategories, $expenseCategories) {
                if (count($incomeCategories) > 0) {
                    $query->orWhere(function ($incomeQuery) use ($incomeCategories) {
                        $incomeQuery->where('entry_type', 'income')->whereIn('category', $incomeCategories);
                    });
                }

                if (count($expenseCategories) > 0) {
                    $query->orWhere(function ($expenseQuery) use ($expenseCategories) {
                        $expenseQuery->where('entry_type', 'expense')->whereIn('category', $expenseCategories);
                    });
                }
            });
    }

    private function taxWizardReadinessScore(int $missingProofs, int $missingReferences, int $unmatched, int $paymentCount): int
    {
        $score = 100;
        $score -= min(35, $missingProofs * 8);
        $score -= min(25, $missingReferences * 5);
        $score -= min(25, $unmatched * 5);

        if ($paymentCount === 0) {
            $score -= 10;
        }

        return max(0, $score);
    }

    private function taxWizardReadinessLabel(?int $score, int $recordCount, int $missingProofs, int $missingReferences, int $unmatched): string
    {
        if ($recordCount === 0) {
            return 'No records yet';
        }

        if ($missingProofs > 0 || $missingReferences > 0 || $unmatched > 0) {
            return 'Needs cleanup';
        }

        if (($score ?? 0) >= 90) {
            return 'Records look organized';
        }

        return 'Review records';
    }

    private function taxWizardCsv(int $merchantId, Request $request, array $definition): string
    {
        $summary = $this->taxWizardSummary($merchantId, $request, $definition);
        $rows = [
            ['Tax Helper', $definition['label']],
            ['Period From', $request->input('from')],
            ['Period To', $request->input('to')],
            ['Income Base', $summary['income_base']],
            ['Expense Base', $summary['expense_base']],
            ['Taxable Base', $summary['taxable_base']],
            ['Recorded Payments', $summary['recorded_payments']],
            ['Estimated Balance', $summary['estimated_balance']],
            ['Missing Proofs', $summary['missing_proofs']],
            ['Missing References', $summary['missing_references']],
            ['Unmatched Records', $summary['unmatched_records']],
            ['Readiness Score', $summary['readiness_score']],
            [],
            ['Checklist'],
        ];

        foreach ($definition['checklist'] ?? [] as $item) {
            $rows[] = [$item];
        }

        $rows[] = [];
        $rows[] = ['Date', 'Type', 'Category', 'Counterparty', 'Amount', 'Reference', 'Tax Type', 'Tax Period', 'Proof Status', 'Reconciliation', 'Description'];

        foreach ($this->taxWizardScopeQuery($merchantId, $request, $definition)->orderBy('transaction_date')->orderBy('id')->get() as $entry) {
            $rows[] = [
                $entry->transaction_date?->toDateString(),
                $entry->entry_type,
                $entry->category,
                $entry->counterparty,
                $entry->amount,
                $entry->reference_number,
                $entry->tax_type,
                $entry->tax_period,
                $entry->proof_status,
                $entry->reconciliation_status,
                $entry->description,
            ];
        }

        return $this->csvString($rows);
    }

    private function csvString(array $rows): string
    {
        $handle = fopen('php://temp', 'r+');
        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }
        rewind($handle);
        $contents = stream_get_contents($handle) ?: '';
        fclose($handle);

        return $contents;
    }

    private function addProofFilesToZip(ZipArchive $zip, int $merchantId, Request $request): array
    {
        $indexRows = [];

        $entryQuery = RetailBookkeepingEntry::query()
            ->where('merchant_id', $merchantId)
            ->whereNotNull('attachment_disk')
            ->whereNotNull('attachment_path')
            ->orderBy('transaction_date')
            ->orderBy('id');

        if ($request->filled('from')) {
            $entryQuery->whereDate('transaction_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $entryQuery->whereDate('transaction_date', '<=', $request->input('to'));
        }

        foreach ($entryQuery->get() as $entry) {
            $zipPath = $this->addStoredProofToZip(
                $zip,
                $entry->attachment_disk,
                $entry->attachment_path,
                'proofs/bookkeeping-entries',
                "entry-{$entry->id}",
                $entry->attachment_original_name
            );

            if (!$zipPath) {
                continue;
            }

            $indexRows[] = [
                'bookkeeping_entry',
                $entry->id,
                $entry->transaction_date?->toDateString(),
                $entry->category,
                $entry->counterparty,
                $entry->amount,
                $entry->attachment_original_name,
                $zipPath,
            ];
        }

        $accountQuery = RetailBookkeepingAccountItem::query()
            ->where('merchant_id', $merchantId)
            ->whereNotNull('attachment_disk')
            ->whereNotNull('attachment_path')
            ->orderBy('issue_date')
            ->orderBy('id');

        if ($request->filled('from')) {
            $accountQuery->whereDate('issue_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $accountQuery->whereDate('issue_date', '<=', $request->input('to'));
        }

        foreach ($accountQuery->get() as $item) {
            $zipPath = $this->addStoredProofToZip(
                $zip,
                $item->attachment_disk,
                $item->attachment_path,
                'proofs/account-items',
                "{$item->item_type}-{$item->id}",
                $item->attachment_original_name
            );

            if (!$zipPath) {
                continue;
            }

            $indexRows[] = [
                'account_item',
                $item->id,
                $item->issue_date?->toDateString(),
                $item->category,
                $item->counterparty,
                $item->amount,
                $item->attachment_original_name,
                $zipPath,
            ];
        }

        $statementQuery = RetailBookkeepingStatementLine::query()
            ->where('merchant_id', $merchantId)
            ->whereNotNull('attachment_disk')
            ->whereNotNull('attachment_path')
            ->orderBy('transaction_date')
            ->orderBy('id');

        if ($request->filled('from')) {
            $statementQuery->whereDate('transaction_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $statementQuery->whereDate('transaction_date', '<=', $request->input('to'));
        }

        foreach ($statementQuery->get() as $line) {
            $zipPath = $this->addStoredProofToZip(
                $zip,
                $line->attachment_disk,
                $line->attachment_path,
                'proofs/statement-lines',
                "statement-line-{$line->id}",
                $line->attachment_original_name
            );

            if (!$zipPath) {
                continue;
            }

            $indexRows[] = [
                'statement_line',
                $line->id,
                $line->transaction_date?->toDateString(),
                $line->source_name ?: $line->source_type,
                $line->counterparty,
                $line->amount,
                $line->attachment_original_name,
                $zipPath,
            ];
        }

        return $indexRows;
    }

    private function addStoredProofToZip(
        ZipArchive $zip,
        ?string $disk,
        ?string $path,
        string $directory,
        string $prefix,
        ?string $originalName
    ): ?string {
        if (!$disk || !$path || !Storage::disk($disk)->exists($path)) {
            return null;
        }

        $extension = pathinfo((string) $originalName, PATHINFO_EXTENSION)
            ?: pathinfo($path, PATHINFO_EXTENSION)
            ?: 'bin';
        $baseName = pathinfo((string) $originalName, PATHINFO_FILENAME) ?: 'proof';
        $safeBaseName = $this->safeZipSegment($baseName);
        $safePrefix = $this->safeZipSegment($prefix);
        $zipPath = "{$directory}/{$safePrefix}-{$safeBaseName}.{$extension}";

        $zip->addFromString($zipPath, Storage::disk($disk)->get($path));

        return $zipPath;
    }

    private function safeZipSegment(string $value): string
    {
        $safe = preg_replace('/[^A-Za-z0-9_-]+/', '-', $value) ?: 'file';
        return trim($safe, '-') ?: 'file';
    }

    private function storeAttachment(Request $request, int $merchantId): array
    {
        if (!$request->hasFile('attachment')) {
            return [];
        }

        $file = $request->file('attachment');
        $path = $file->store("retail-bookkeeping/{$merchantId}", 'public');

        return [
            'attachment_disk' => 'public',
            'attachment_path' => $path,
            'attachment_original_name' => $file->getClientOriginalName(),
            'attachment_mime' => $file->getClientMimeType(),
            'attachment_size' => $file->getSize(),
        ];
    }

    private function writeAuditLog(Request $request, int $merchantId, string $action, string $description, array $metadata): void
    {
        RetailAuditLog::create([
            'merchant_id' => $merchantId,
            'staff_id' => $request->attributes->get('active_staff')?->id,
            'user_id' => $request->user()?->id,
            'action' => $action,
            'description' => $description,
            'metadata' => $metadata,
        ]);
    }

    private function summary(int $merchantId, Request $request): array
    {
        $rows = $this->summaryQuery($merchantId, $request)
            ->selectRaw('entry_type, sum(amount) as total, count(*) as count')
            ->groupBy('entry_type')
            ->get()
            ->keyBy('entry_type');

        $income = (float) ($rows->get('income')->total ?? 0);
        $expenses = (float) ($rows->get('expense')->total ?? 0);
        $tax = (float) ($rows->get('tax_payment')->total ?? 0);
        $directorLoans = (float) ($rows->get('director_loan')->total ?? 0);
        $accountSummary = $this->accountItemsSummary($merchantId);

        return [
            'income' => $income,
            'expenses' => $expenses,
            'tax_payments' => $tax,
            'director_loans' => $directorLoans,
            'profit_estimate' => $income - $expenses - $tax,
            'opening_balance' => $this->openingBalance($merchantId),
            'missing_references' => $this->summaryQuery($merchantId, $request)->whereNull('reference_number')->count(),
            'missing_attachments' => $this->summaryQuery($merchantId, $request)->whereIn('proof_status', ['missing', 'needs_replacement'])->count(),
            'unmatched' => $this->summaryQuery($merchantId, $request)->where('reconciliation_status', '!=', 'matched')->count(),
            'pending_review' => $this->summaryQuery($merchantId, $request)->where('review_status', 'pending')->count(),
            'adjustments' => $this->summaryQuery($merchantId, $request)->where('category', 'Adjustment Entry')->count(),
            'statement_unmatched' => RetailBookkeepingStatementLine::query()->where('merchant_id', $merchantId)->where('status', 'unmatched')->count(),
            'accounts_receivable_open' => $accountSummary['receivable_open'],
            'accounts_payable_open' => $accountSummary['payable_open'],
            'overdue_receivables' => $accountSummary['overdue_receivables'],
            'overdue_payables' => $accountSummary['overdue_payables'],
        ];
    }

    private function summaryQuery(int $merchantId, Request $request)
    {
        $query = RetailBookkeepingEntry::query()
            ->where('merchant_id', $merchantId)
            ->where('status', 'active');

        if ($request->filled('from')) {
            $query->whereDate('transaction_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('transaction_date', '<=', $request->input('to'));
        }

        return $query;
    }

    private function openingBalance(int $merchantId): ?RetailBookkeepingOpeningBalance
    {
        return RetailBookkeepingOpeningBalance::query()
            ->where('merchant_id', $merchantId)
            ->first();
    }

    private function accountItems(int $merchantId): array
    {
        $items = RetailBookkeepingAccountItem::query()
            ->where('merchant_id', $merchantId)
            ->with(['staff.user:id,name', 'user:id,name', 'settlementEntry:id,entry_type,category,amount,transaction_date'])
            ->latest('due_date')
            ->latest('id')
            ->limit(12)
            ->get();

        return [
            'recent' => $items,
            'summary' => $this->accountItemsSummary($merchantId),
        ];
    }

    private function accountItemsSummary(int $merchantId): array
    {
        $open = RetailBookkeepingAccountItem::query()
            ->where('merchant_id', $merchantId)
            ->where('status', 'open')
            ->selectRaw('item_type, sum(amount - paid_amount) as balance, count(*) as count')
            ->groupBy('item_type')
            ->get()
            ->keyBy('item_type');

        return [
            'receivable_open' => (float) ($open->get('receivable')->balance ?? 0),
            'payable_open' => (float) ($open->get('payable')->balance ?? 0),
            'receivable_count' => (int) ($open->get('receivable')->count ?? 0),
            'payable_count' => (int) ($open->get('payable')->count ?? 0),
            'overdue_receivables' => RetailBookkeepingAccountItem::query()
                ->where('merchant_id', $merchantId)
                ->where('item_type', 'receivable')
                ->where('status', 'open')
                ->whereDate('due_date', '<', now()->toDateString())
                ->count(),
            'overdue_payables' => RetailBookkeepingAccountItem::query()
                ->where('merchant_id', $merchantId)
                ->where('item_type', 'payable')
                ->where('status', 'open')
                ->whereDate('due_date', '<', now()->toDateString())
                ->count(),
        ];
    }

    private function statementReconciliation(int $merchantId): array
    {
        $unmatchedLines = RetailBookkeepingStatementLine::query()
            ->where('merchant_id', $merchantId)
            ->where('status', 'unmatched')
            ->latest('transaction_date')
            ->latest('id')
            ->limit(12)
            ->get();

        $candidateEntries = RetailBookkeepingEntry::query()
            ->where('merchant_id', $merchantId)
            ->where('status', 'active')
            ->where('reconciliation_status', '!=', 'matched')
            ->orderByDesc('transaction_date')
            ->limit(100)
            ->get(['id', 'entry_type', 'category', 'counterparty', 'amount', 'transaction_date', 'reference_number', 'description']);

        return [
            'unmatched_lines' => $unmatchedLines,
            'candidate_entries' => $candidateEntries,
            'suggestions' => $this->statementMatchSuggestions($unmatchedLines, $candidateEntries),
            'summary' => [
                'unmatched' => RetailBookkeepingStatementLine::query()->where('merchant_id', $merchantId)->where('status', 'unmatched')->count(),
                'matched' => RetailBookkeepingStatementLine::query()->where('merchant_id', $merchantId)->where('status', 'matched')->count(),
                'ignored' => RetailBookkeepingStatementLine::query()->where('merchant_id', $merchantId)->where('status', 'ignored')->count(),
            ],
        ];
    }

    private function businessTools($merchant): array
    {
        $merchant->loadMissing('country');
        $merchantId = $merchant->id;
        $today = now()->toDateString();
        $soon = now()->addDays(30)->toDateString();

        $obligations = RetailBusinessObligation::query()
            ->where('merchant_id', $merchantId)
            ->where('status', 'open')
            ->orderBy('due_date')
            ->limit(8)
            ->get();

        $bills = RetailRecurringBill::query()
            ->where('merchant_id', $merchantId)
            ->where('status', 'active')
            ->orderBy('next_due_date')
            ->limit(8)
            ->get();

        $payroll = RetailPayrollRecord::query()
            ->where('merchant_id', $merchantId)
            ->latest('pay_date')
            ->limit(8)
            ->get();

        $shareLinks = RetailBookkeepingShareLink::query()
            ->where('merchant_id', $merchantId)
            ->latest()
            ->limit(5)
            ->get()
            ->map(function (RetailBookkeepingShareLink $link) {
                $link->setAttribute('url', url("/bookkeeping-share/{$link->token}"));
                return $link;
            });

        return [
            'summary' => [
                'obligations_due_soon' => RetailBusinessObligation::query()->where('merchant_id', $merchantId)->where('status', 'open')->whereBetween('due_date', [$today, $soon])->count(),
                'overdue_obligations' => RetailBusinessObligation::query()->where('merchant_id', $merchantId)->where('status', 'open')->whereDate('due_date', '<', $today)->count(),
                'bills_due_soon' => RetailRecurringBill::query()->where('merchant_id', $merchantId)->where('status', 'active')->whereBetween('next_due_date', [$today, $soon])->count(),
                'pending_payroll' => RetailPayrollRecord::query()->where('merchant_id', $merchantId)->where('status', 'pending')->count(),
                'active_share_links' => RetailBookkeepingShareLink::query()->where('merchant_id', $merchantId)->where('status', 'active')->count(),
            ],
            'obligations' => $obligations,
            'recurring_bills' => $bills,
            'payroll' => $payroll,
            'share_links' => $shareLinks,
            'recommended_setup' => $this->countrySetupTemplates($merchant->country),
        ];
    }

    private function countrySetupTemplates(?Country $country): array
    {
        $configured = $country?->settings['tax_calendar_defaults'] ?? null;
        if (is_array($configured) && count($configured) > 0) {
            return array_values($configured);
        }

        if (strtoupper((string) ($country?->iso_alpha2 ?? '')) === 'TZ') {
            return [
                [
                    'key' => 'annual_return_estimate',
                    'title' => 'Annual return estimate',
                    'type' => 'annual_return',
                    'authority' => 'TRA / Accountant',
                    'remind_days_before' => 30,
                    'suggested_frequency' => 'yearly',
                    'description' => 'Set this once your accountant gives you the expected filing or return date.',
                ],
                [
                    'key' => 'pdpc_registration',
                    'title' => 'PDPC data protection registration',
                    'type' => 'license_renewal',
                    'authority' => 'PDPC',
                    'remind_days_before' => 90,
                    'suggested_frequency' => 'every 5 years',
                    'description' => 'For businesses collecting or processing personal data. Registration validity is generally five years from certificate issue.',
                ],
                [
                    'key' => 'tcra_certificate',
                    'title' => 'TCRA certificate / licence renewal',
                    'type' => 'license_renewal',
                    'authority' => 'TCRA',
                    'remind_days_before' => 45,
                    'suggested_frequency' => 'yearly or licence-specific',
                    'description' => 'Use the due date and fee schedule shown on the issued certificate or licence.',
                ],
                [
                    'key' => 'vat_payment',
                    'title' => 'VAT filing/payment reminder',
                    'type' => 'tax_filing',
                    'authority' => 'TRA',
                    'remind_days_before' => 7,
                    'suggested_frequency' => 'monthly where registered',
                    'description' => 'Enable only if the business is registered or advised to file VAT.',
                ],
                [
                    'key' => 'paye_sdl',
                    'title' => 'PAYE / SDL payroll tax reminder',
                    'type' => 'payroll_tax',
                    'authority' => 'TRA',
                    'remind_days_before' => 7,
                    'suggested_frequency' => 'monthly where applicable',
                    'description' => 'Use when the business has employees or payroll obligations.',
                ],
            ];
        }

        return [
            [
                'key' => 'annual_return',
                'title' => 'Annual return / filing reminder',
                'type' => 'annual_return',
                'authority' => 'Tax Authority',
                'remind_days_before' => 30,
                'suggested_frequency' => 'yearly',
                'description' => 'Set the date provided by the accountant or local authority.',
            ],
            [
                'key' => 'business_license',
                'title' => 'Business licence renewal',
                'type' => 'license_renewal',
                'authority' => 'Local Authority',
                'remind_days_before' => 30,
                'suggested_frequency' => 'licence-specific',
                'description' => 'Use the expiry date shown on the issued licence.',
            ],
        ];
    }

    private function nextDueDate(string $frequency, string|Carbon $current): Carbon
    {
        $date = $current instanceof Carbon ? $current->copy() : Carbon::parse($current);

        return match ($frequency) {
            'weekly' => $date->addWeek(),
            'quarterly' => $date->addMonthsNoOverflow(3),
            'yearly' => $date->addYearNoOverflow(),
            default => $date->addMonthNoOverflow(),
        };
    }

    private function statementMatchSuggestions($lines, $entries): array
    {
        $suggestions = [];

        foreach ($lines as $line) {
            $lineSuggestions = [];

            foreach ($entries as $entry) {
                $score = 0;
                $reasons = [];

                if (abs((float) $line->amount - (float) $entry->amount) < 0.01) {
                    $score += 45;
                    $reasons[] = 'same amount';
                }

                $directionMatches = (
                    $line->line_type === 'credit' && in_array($entry->entry_type, ['income', 'director_loan'], true)
                ) || (
                    $line->line_type === 'debit' && in_array($entry->entry_type, ['expense', 'tax_payment'], true)
                );

                if ($directionMatches) {
                    $score += 15;
                    $reasons[] = 'same money direction';
                }

                if ($line->reference_number && $entry->reference_number && strcasecmp($line->reference_number, $entry->reference_number) === 0) {
                    $score += 25;
                    $reasons[] = 'same reference';
                }

                $daysApart = abs($line->transaction_date->diffInDays($entry->transaction_date));
                if ($daysApart === 0) {
                    $score += 15;
                    $reasons[] = 'same date';
                } elseif ($daysApart <= 3) {
                    $score += 10;
                    $reasons[] = "{$daysApart} days apart";
                } elseif ($daysApart <= 7) {
                    $score += 5;
                    $reasons[] = "{$daysApart} days apart";
                }

                $similarity = $this->statementTextSimilarity($line, $entry);
                if ($similarity >= 70) {
                    $score += 15;
                    $reasons[] = 'similar description';
                } elseif ($similarity >= 45) {
                    $score += 8;
                    $reasons[] = 'partly similar description';
                }

                if ($score < 45) {
                    continue;
                }

                $lineSuggestions[] = [
                    'entry_id' => $entry->id,
                    'confidence' => min(100, $score),
                    'reasons' => $reasons,
                ];
            }

            usort($lineSuggestions, fn($a, $b) => $b['confidence'] <=> $a['confidence']);
            $suggestions[$line->id] = array_slice($lineSuggestions, 0, 3);
        }

        return $suggestions;
    }

    private function statementTextSimilarity(RetailBookkeepingStatementLine $line, RetailBookkeepingEntry $entry): float
    {
        $lineText = strtolower(trim(implode(' ', array_filter([
            $line->counterparty,
            $line->description,
            $line->reference_number,
        ]))));
        $entryText = strtolower(trim(implode(' ', array_filter([
            $entry->counterparty,
            $entry->description,
            $entry->reference_number,
            $entry->category,
        ]))));

        if ($lineText === '' || $entryText === '') {
            return 0;
        }

        similar_text($lineText, $entryText, $percent);

        return (float) $percent;
    }

    private function normalizeCsvKey(string $key): string
    {
        $normalized = strtolower(trim($key));
        $normalized = preg_replace('/[^a-z0-9]+/', '_', $normalized) ?: '';
        return trim($normalized, '_');
    }

    private function parseStatementLine(array $data): ?array
    {
        $date = $this->firstCsvValue($data, ['date', 'transaction_date', 'posted_date', 'value_date', 'time']);
        $amount = $this->firstCsvValue($data, ['amount', 'transaction_amount', 'paid_in', 'paid_out']);
        $debit = $this->firstCsvValue($data, ['debit', 'withdrawal', 'money_out', 'paid_out', 'dr']);
        $credit = $this->firstCsvValue($data, ['credit', 'deposit', 'money_in', 'paid_in', 'cr']);

        $lineType = 'debit';
        if ($credit !== null && $this->parseMoney($credit) > 0) {
            $amount = $credit;
            $lineType = 'credit';
        } elseif ($debit !== null && $this->parseMoney($debit) > 0) {
            $amount = $debit;
            $lineType = 'debit';
        } elseif ($amount !== null && $this->parseMoney($amount) < 0) {
            $lineType = 'debit';
        } elseif ($amount !== null) {
            $lineType = 'credit';
        }

        if (!$date || $amount === null || $this->parseMoney($amount) == 0.0) {
            return null;
        }

        try {
            $transactionDate = Carbon::parse($date)->toDateString();
        } catch (\Throwable) {
            return null;
        }

        return [
            'transaction_date' => $transactionDate,
            'reference_number' => $this->firstCsvValue($data, ['reference', 'reference_number', 'ref', 'transaction_id', 'receipt', 'receipt_number']),
            'counterparty' => $this->firstCsvValue($data, ['counterparty', 'name', 'customer', 'vendor', 'sender', 'recipient']),
            'description' => $this->firstCsvValue($data, ['description', 'details', 'narration', 'memo', 'particulars']),
            'line_type' => $lineType,
            'amount' => abs($this->parseMoney($amount)),
        ];
    }

    private function firstCsvValue(array $data, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (isset($data[$key]) && trim((string) $data[$key]) !== '') {
                return trim((string) $data[$key]);
            }
        }

        return null;
    }

    private function parseMoney(string|int|float|null $value): float
    {
        if ($value === null) {
            return 0.0;
        }

        $clean = preg_replace('/[^\d.\-]/', '', (string) $value);
        return (float) $clean;
    }

    private function profitLossRows(int $merchantId, Request $request): array
    {
        $summary = $this->summary($merchantId, $request);
        $opening = $this->openingBalance($merchantId);

        return [
            ['line' => 'Opening cash/bank/mobile balance', 'amount' => (float) (($opening?->cash_balance ?? 0) + ($opening?->bank_balance ?? 0) + ($opening?->mobile_money_balance ?? 0))],
            ['line' => 'Income', 'amount' => (float) $summary['income']],
            ['line' => 'Expenses', 'amount' => (float) $summary['expenses']],
            ['line' => 'Tax payments', 'amount' => (float) $summary['tax_payments']],
            ['line' => 'Estimated profit', 'amount' => (float) $summary['profit_estimate']],
            ['line' => 'Director loan balance', 'amount' => (float) (($opening?->director_loan_balance ?? 0) + $summary['director_loans'])],
            ['line' => 'Stock opening value', 'amount' => (float) ($opening?->stock_value ?? 0)],
            ['line' => 'Accounts receivable opening balance', 'amount' => (float) ($opening?->accounts_receivable ?? 0)],
            ['line' => 'Accounts payable opening balance', 'amount' => (float) ($opening?->accounts_payable ?? 0)],
            ['line' => 'Open accounts receivable', 'amount' => (float) $summary['accounts_receivable_open']],
            ['line' => 'Open accounts payable', 'amount' => (float) $summary['accounts_payable_open']],
        ];
    }

    private function balanceSheetRows(int $merchantId, Request $request): array
    {
        $summary = $this->summary($merchantId, $request);
        $opening = $this->openingBalance($merchantId);
        $cashMovement = $this->cashMovement($merchantId, $request);
        $openingCash = (float) (($opening?->cash_balance ?? 0) + ($opening?->bank_balance ?? 0) + ($opening?->mobile_money_balance ?? 0));
        $openReceivables = (float) ($opening?->accounts_receivable ?? 0) + (float) $summary['accounts_receivable_open'];
        $openPayables = (float) ($opening?->accounts_payable ?? 0) + (float) $summary['accounts_payable_open'];
        $directorLoanBalance = (float) ($opening?->director_loan_balance ?? 0) + (float) $summary['director_loans'];
        $estimatedCash = $openingCash + $cashMovement['cash_in'] - $cashMovement['cash_out'];
        $estimatedAssets = $estimatedCash + (float) ($opening?->stock_value ?? 0) + $openReceivables;
        $estimatedLiabilities = $openPayables + $directorLoanBalance;
        $estimatedEquity = $estimatedAssets - $estimatedLiabilities;

        return [
            ['line' => 'Assets: estimated cash/bank/mobile balance', 'amount' => $estimatedCash],
            ['line' => 'Assets: stock opening value', 'amount' => (float) ($opening?->stock_value ?? 0)],
            ['line' => 'Assets: open accounts receivable', 'amount' => $openReceivables],
            ['line' => 'Assets: estimated total assets', 'amount' => $estimatedAssets],
            ['line' => 'Liabilities: open accounts payable', 'amount' => $openPayables],
            ['line' => 'Liabilities: director loan balance', 'amount' => $directorLoanBalance],
            ['line' => 'Liabilities: estimated total liabilities', 'amount' => $estimatedLiabilities],
            ['line' => 'Equity: estimated retained position', 'amount' => $estimatedEquity],
            ['line' => 'Check: assets minus liabilities and equity', 'amount' => $estimatedAssets - $estimatedLiabilities - $estimatedEquity],
        ];
    }

    private function cashFlowRows(int $merchantId, Request $request): array
    {
        $opening = $this->openingBalance($merchantId);
        $movement = $this->cashMovement($merchantId, $request);
        $openingCash = (float) (($opening?->cash_balance ?? 0) + ($opening?->bank_balance ?? 0) + ($opening?->mobile_money_balance ?? 0));
        $netCash = $movement['cash_in'] - $movement['cash_out'];

        return [
            ['line' => 'Opening cash/bank/mobile balance', 'amount' => $openingCash],
            ['line' => 'Cash in: income received', 'amount' => $movement['income_cash_in']],
            ['line' => 'Cash in: director loan funding', 'amount' => $movement['director_loan_cash_in']],
            ['line' => 'Cash in: total cash in', 'amount' => $movement['cash_in']],
            ['line' => 'Cash out: operating expenses', 'amount' => $movement['expense_cash_out']],
            ['line' => 'Cash out: tax payments', 'amount' => $movement['tax_cash_out']],
            ['line' => 'Cash out: total cash out', 'amount' => $movement['cash_out']],
            ['line' => 'Net cash movement', 'amount' => $netCash],
            ['line' => 'Estimated ending cash/bank/mobile balance', 'amount' => $openingCash + $netCash],
        ];
    }

    private function trialBalanceRows(int $merchantId, Request $request): array
    {
        $opening = $this->openingBalance($merchantId);
        $summary = $this->summary($merchantId, $request);
        $cash = $this->cashMovement($merchantId, $request);
        $openingCash = (float) (($opening?->cash_balance ?? 0) + ($opening?->bank_balance ?? 0) + ($opening?->mobile_money_balance ?? 0));
        $endingCash = $openingCash + $cash['cash_in'] - $cash['cash_out'];

        return [
            ['line' => 'Assets: cash/bank/mobile', 'amount' => $endingCash],
            ['line' => 'Assets: stock opening value', 'amount' => (float) ($opening?->stock_value ?? 0)],
            ['line' => 'Assets: accounts receivable', 'amount' => (float) (($opening?->accounts_receivable ?? 0) + $summary['accounts_receivable_open'])],
            ['line' => 'Liabilities: accounts payable', 'amount' => (float) (($opening?->accounts_payable ?? 0) + $summary['accounts_payable_open'])],
            ['line' => 'Liabilities: director loan balance', 'amount' => (float) (($opening?->director_loan_balance ?? 0) + $summary['director_loans'])],
            ['line' => 'Revenue: income', 'amount' => (float) $summary['income']],
            ['line' => 'Expense: operating expenses', 'amount' => (float) $summary['expenses']],
            ['line' => 'Expense: tax payments', 'amount' => (float) $summary['tax_payments']],
        ];
    }

    private function agingRows(int $merchantId, string $itemType): array
    {
        $items = RetailBookkeepingAccountItem::query()
            ->where('merchant_id', $merchantId)
            ->where('item_type', $itemType)
            ->where('status', 'open')
            ->get();
        $buckets = [
            'Current' => ['bucket' => 'Current', 'balance' => 0, 'count' => 0],
            '1-30 days' => ['bucket' => '1-30 days', 'balance' => 0, 'count' => 0],
            '31-60 days' => ['bucket' => '31-60 days', 'balance' => 0, 'count' => 0],
            '61-90 days' => ['bucket' => '61-90 days', 'balance' => 0, 'count' => 0],
            '90+ days' => ['bucket' => '90+ days', 'balance' => 0, 'count' => 0],
        ];

        foreach ($items as $item) {
            $days = $item->due_date ? now()->startOfDay()->diffInDays($item->due_date, false) : 0;
            $bucket = 'Current';
            if ($days < -90) {
                $bucket = '90+ days';
            } elseif ($days < -60) {
                $bucket = '61-90 days';
            } elseif ($days < -30) {
                $bucket = '31-60 days';
            } elseif ($days < 0) {
                $bucket = '1-30 days';
            }

            $buckets[$bucket]['balance'] += (float) $item->balance_due;
            $buckets[$bucket]['count']++;
        }

        return array_values($buckets);
    }

    private function vendorExpenseRows(int $merchantId, Request $request): array
    {
        return $this->summaryQuery($merchantId, $request)
            ->where('entry_type', 'expense')
            ->selectRaw("coalesce(nullif(counterparty, ''), 'Unspecified') as vendor, sum(amount) as amount, count(*) as count")
            ->groupBy('vendor')
            ->orderByDesc('amount')
            ->get()
            ->map(fn($row) => ['vendor' => $row->vendor, 'amount' => (float) $row->amount, 'count' => (int) $row->count])
            ->all();
    }

    private function salesByChannelRows(int $merchantId, Request $request): array
    {
        return $this->summaryQuery($merchantId, $request)
            ->where('entry_type', 'income')
            ->selectRaw('category as channel, sum(amount) as amount, count(*) as count')
            ->groupBy('category')
            ->orderByDesc('amount')
            ->get()
            ->map(fn($row) => ['channel' => $row->channel, 'amount' => (float) $row->amount, 'count' => (int) $row->count])
            ->all();
    }

    private function payrollSummaryRows(int $merchantId, Request $request): array
    {
        $query = RetailPayrollRecord::query()->where('merchant_id', $merchantId);

        if ($request->filled('from')) {
            $query->whereDate('pay_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('pay_date', '<=', $request->input('to'));
        }

        return $query->selectRaw('pay_period, sum(gross_amount) as gross, sum(deductions_amount) as deductions, sum(net_amount) as net, count(*) as count')
            ->groupBy('pay_period')
            ->orderByDesc('pay_period')
            ->get()
            ->map(fn($row) => [
                'pay_period' => $row->pay_period,
                'gross' => (float) $row->gross,
                'deductions' => (float) $row->deductions,
                'net' => (float) $row->net,
                'count' => (int) $row->count,
            ])
            ->all();
    }

    private function shareAccessLogRows(int $merchantId): array
    {
        return RetailBookkeepingShareAccessLog::query()
            ->where('merchant_id', $merchantId)
            ->with('shareLink:id,recipient_name,recipient_role')
            ->latest()
            ->limit(500)
            ->get()
            ->map(fn($log) => [
                'date' => $log->created_at?->toDateTimeString(),
                'recipient' => $log->shareLink?->recipient_name ?: $log->shareLink?->recipient_role,
                'event' => $log->event,
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
            ])
            ->all();
    }

    private function cashMovement(int $merchantId, Request $request): array
    {
        $cashMethods = ['cash', 'bank', 'mobile_money', 'card', 'takeer_wallet'];
        $base = $this->summaryQuery($merchantId, $request)
            ->whereIn('payment_method', $cashMethods);

        $income = (float) (clone $base)->where('entry_type', 'income')->sum('amount');
        $directorLoans = (float) (clone $base)->where('entry_type', 'director_loan')->sum('amount');
        $expenses = (float) (clone $base)->where('entry_type', 'expense')->sum('amount');
        $tax = (float) (clone $base)->where('entry_type', 'tax_payment')->sum('amount');

        return [
            'income_cash_in' => $income,
            'director_loan_cash_in' => $directorLoans,
            'expense_cash_out' => $expenses,
            'tax_cash_out' => $tax,
            'cash_in' => $income + $directorLoans,
            'cash_out' => $expenses + $tax,
        ];
    }

    private function inferProofStatus(array $filePayload, array $validated, ?RetailBookkeepingEntry $entry = null): string
    {
        if (!empty($filePayload['attachment_path']) || $entry?->attachment_path) {
            return 'attached';
        }

        if (!empty($validated['reference_number'])) {
            return 'reference_only';
        }

        return 'missing';
    }

    private function abortIfPeriodLocked(int $merchantId, string|Carbon $date): void
    {
        $periodKey = $date instanceof Carbon
            ? $date->format('Y-m')
            : Carbon::parse($date)->format('Y-m');

        $locked = RetailBookkeepingPeriodLock::query()
            ->where('merchant_id', $merchantId)
            ->where('period_key', $periodKey)
            ->exists();

        abort_if($locked, 423, "Bookkeeping period {$periodKey} is locked. Add an adjustment in an open period instead.");
    }

    private function periodLocks(int $merchantId)
    {
        return RetailBookkeepingPeriodLock::query()
            ->where('merchant_id', $merchantId)
            ->with('lockedBy:id,name')
            ->latest('period_key')
            ->limit(12)
            ->get();
    }

    private function categories(): array
    {
        return [
            'income' => ['POS Sales', 'Online Orders', 'Direct Income', 'Commission', 'Premium Post Fees', 'Service Income', 'Accounts Receivable Collection', 'Adjustment Entry', 'Other Income'],
            'expense' => ['Stock Purchases', 'Startup Costs', 'Digital Services', 'Rent', 'Transport', 'Payroll', 'Marketing', 'Utilities', 'Repairs', 'Professional Fees', 'Accounts Payable Payment', 'Adjustment Entry', 'Other Expense'],
            'director_loan' => ['Director Loan Account'],
            'tax_payment' => ['VAT', 'Withholding Tax', 'PAYE', 'SDL', 'TRA Payment', 'Other Tax'],
        ];
    }

    private function adjustmentReasons(): array
    {
        return [
            ['value' => 'stock_count', 'label' => 'Stock count difference'],
            ['value' => 'bank_charge', 'label' => 'Bank charge'],
            ['value' => 'write_off', 'label' => 'Write-off'],
            ['value' => 'depreciation', 'label' => 'Depreciation'],
            ['value' => 'opening_correction', 'label' => 'Opening balance correction'],
            ['value' => 'tax_adjustment', 'label' => 'Tax adjustment'],
            ['value' => 'rounding', 'label' => 'Rounding difference'],
            ['value' => 'other', 'label' => 'Other adjustment'],
        ];
    }

    private function auditedFields(): array
    {
        return [
            'entry_type', 'category', 'counterparty', 'amount', 'currency_code', 'payment_method',
            'reference_type', 'reference_number', 'tax_type', 'tax_period', 'transaction_date',
            'description', 'attachment_original_name', 'proof_status', 'review_status',
            'review_note', 'reconciliation_status', 'statement_reference', 'status', 'void_reason',
        ];
    }

    private function accountItemAuditedFields(): array
    {
        return [
            'item_type', 'status', 'counterparty', 'category', 'amount', 'paid_amount',
            'currency_code', 'invoice_number', 'issue_date', 'due_date', 'paid_at',
            'settlement_entry_id', 'attachment_original_name', 'description', 'void_reason',
        ];
    }
}
