<?php

namespace App\Http\Controllers;

use App\Models\SupportEnquiry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class SupportEnquiryController extends Controller
{
    public function show(Request $request): InertiaResponse
    {
        return Inertia::render('Help', [
            'categories' => collect(SupportEnquiry::CATEGORIES)
                ->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])
                ->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category' => ['required', 'string', 'in:'.implode(',', array_keys(SupportEnquiry::CATEGORIES))],
            'name' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:255', 'required_without:phone'],
            'phone' => ['nullable', 'string', 'max:40', 'required_without:email'],
            'order_reference' => ['nullable', 'string', 'max:80'],
            'subject' => ['nullable', 'string', 'max:160'],
            'message' => ['required', 'string', 'min:10', 'max:5000'],
        ]);

        $user = $request->user();
        $reference = $this->makeReference();

        $enquiry = SupportEnquiry::create([
            ...$validated,
            'user_id' => $user?->id,
            'reference' => $reference,
            'status' => 'new',
            'priority' => $validated['category'] === 'safety' ? 'high' : 'normal',
            'name' => $validated['name'] ?? $user?->name,
            'email' => $validated['email'] ?? $user?->email,
            'phone' => $validated['phone'] ?? $user?->phone_number,
            'metadata' => [
                'ip' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 500, ''),
            ],
        ]);

        $this->notifySupport($enquiry);

        return response()->json([
            'message' => 'Tumepokea ujumbe wako. Tutakujibu hivi karibuni.',
            'reference' => $enquiry->reference,
        ], 201);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $status = (string) $request->input('status', 'all');
        $category = (string) $request->input('category', 'all');
        $search = trim((string) $request->input('search', ''));
        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);

        $query = SupportEnquiry::query()
            ->with(['user:id,name,email,phone_number', 'resolvedBy:id,name'])
            ->latest();

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if ($category !== 'all') {
            $query->where('category', $category);
        }

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('reference', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('order_reference', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%");
            });
        }

        return response()->json([
            'summary' => $this->summary(),
            'categories' => SupportEnquiry::CATEGORIES,
            'statuses' => SupportEnquiry::STATUSES,
            'enquiries' => $query->paginate($perPage),
        ]);
    }

    public function adminUpdate(Request $request, SupportEnquiry $supportEnquiry): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', SupportEnquiry::STATUSES)],
            'priority' => ['nullable', 'string', 'in:normal,high,urgent'],
            'internal_note' => ['nullable', 'string', 'max:5000'],
        ]);

        $status = $validated['status'];
        $wasResolved = in_array($supportEnquiry->status, ['resolved', 'closed'], true);
        $isResolved = in_array($status, ['resolved', 'closed'], true);

        $supportEnquiry->fill([
            'status' => $status,
            'priority' => $validated['priority'] ?? $supportEnquiry->priority,
            'internal_note' => $validated['internal_note'] ?? null,
            'resolved_by_id' => $isResolved ? $request->user()?->id : null,
            'resolved_at' => $isResolved ? ($wasResolved ? $supportEnquiry->resolved_at : now()) : null,
        ])->save();

        return response()->json([
            'message' => 'Enquiry updated.',
            'enquiry' => $supportEnquiry->fresh(['user:id,name,email,phone_number', 'resolvedBy:id,name']),
            'summary' => $this->summary(),
        ]);
    }

    private function summary(): array
    {
        $base = SupportEnquiry::query();

        return [
            'total' => (clone $base)->count(),
            'new' => (clone $base)->where('status', 'new')->count(),
            'open' => (clone $base)->where('status', 'open')->count(),
            'resolved' => (clone $base)->where('status', 'resolved')->count(),
            'closed' => (clone $base)->where('status', 'closed')->count(),
            'urgent' => (clone $base)->where('priority', 'urgent')->count(),
            'high' => (clone $base)->where('priority', 'high')->count(),
        ];
    }

    private function makeReference(): string
    {
        do {
            $reference = 'TKR-HLP-'.now()->format('ymd').'-'.Str::upper(Str::random(5));
        } while (SupportEnquiry::where('reference', $reference)->exists());

        return $reference;
    }

    private function notifySupport(SupportEnquiry $enquiry): void
    {
        $recipient = config('mail.support_address')
            ?: env('SUPPORT_EMAIL')
            ?: config('mail.from.address');

        if (! $recipient) {
            return;
        }

        try {
            Mail::raw($this->emailBody($enquiry), function ($message) use ($recipient, $enquiry) {
                $message->to($recipient)
                    ->subject("New Takeer support enquiry {$enquiry->reference}");

                if ($enquiry->email) {
                    $message->replyTo($enquiry->email, $enquiry->name ?: null);
                }
            });
        } catch (\Throwable) {
            // The database record is the system of record; mail is only an alert.
        }
    }

    private function emailBody(SupportEnquiry $enquiry): string
    {
        return implode(PHP_EOL, [
            "Reference: {$enquiry->reference}",
            'Category: '.(SupportEnquiry::CATEGORIES[$enquiry->category] ?? $enquiry->category),
            "Priority: {$enquiry->priority}",
            "Name: {$enquiry->name}",
            "Email: {$enquiry->email}",
            "Phone: {$enquiry->phone}",
            "Order/reference: {$enquiry->order_reference}",
            "Subject: {$enquiry->subject}",
            '',
            $enquiry->message,
            '',
            url('/admin/enquiries'),
        ]);
    }
}
