<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantServiceIntegration;
use App\Models\Product;
use App\Models\ServiceAvailabilityRule;
use App\Models\ServiceRequest;
use App\Models\ServiceRequestNotification;
use App\Models\ServiceSession;
use App\Services\MediaUploadService;
use App\Services\ServiceAppointmentSlotService;
use App\Services\ServiceCalendarIntegrationService;
use App\Services\ServiceRequestNotificationService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;

class ServiceRequestController extends Controller
{
    public function __construct(
        private readonly ServiceRequestNotificationService $notificationService,
        private readonly ServiceAppointmentSlotService $slotService,
        private readonly ServiceCalendarIntegrationService $calendarService,
    )
    {
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'request_type' => ['nullable', 'string', Rule::in(['contact_request', 'quote_request', 'appointment_request'])],
            'customer_name' => ['required', 'string', 'max:120'],
            'customer_phone' => ['nullable', 'string', 'max:40'],
            'customer_email' => ['nullable', 'email', 'max:160'],
            'preferred_date' => ['nullable', 'date', 'after_or_equal:today'],
            'preferred_time' => ['nullable', 'string', 'max:32'],
            'selected_slot_start' => ['nullable', 'date', 'after_or_equal:now'],
            'selected_slot_end' => ['nullable', 'date', 'after:selected_slot_start'],
            'selected_session_id' => ['nullable', 'integer', 'exists:service_sessions,id'],
            'selected_service_option_id' => ['nullable', 'string', 'max:80'],
            'timezone' => ['nullable', 'timezone'],
            'location_text' => ['nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:3000'],
            'client_requirements' => ['nullable', 'array'],
        ]);

        $product = Product::query()
            ->where('type', 'service')
            ->with('merchant')
            ->findOrFail((int) $validated['product_id']);

        if (empty($validated['customer_phone']) && empty($validated['customer_email'])) {
            return response()->json([
                'message' => 'Tafadhali weka namba ya simu au email ili provider aweze kukujibu.',
            ], 422);
        }

        $serviceAreas = collect($product->service_area ?? [])
            ->map(fn ($area) => trim((string) $area))
            ->filter()
            ->values();
        if ($serviceAreas->isNotEmpty() && in_array($product->service_location_type, ['customer_location', 'hybrid'], true)) {
            $locationText = strtolower(trim((string) ($validated['location_text'] ?? '')));
            $matchesArea = $locationText !== '' && $serviceAreas->contains(function (string $area) use ($locationText) {
                $normalizedArea = strtolower($area);

                return str_contains($locationText, $normalizedArea) || str_contains($normalizedArea, $locationText);
            });

            if (! $matchesArea) {
                return response()->json([
                    'message' => 'Huduma hii inapatikana kwa maeneo haya: '.$serviceAreas->implode(', ').'.',
                ], 422);
            }
        }

        $intakeForm = collect($product->service_intake_form ?? []);
        foreach ($intakeForm as $field) {
            if (! ($field['required'] ?? false)) {
                continue;
            }

            $fieldId = (string) ($field['id'] ?? '');
            $answer = $validated['client_requirements'][$fieldId] ?? null;
            $hasAnswer = is_array($answer)
                ? collect($answer)->filter(fn ($value) => $value !== null && $value !== '')->isNotEmpty()
                : trim((string) $answer) !== '';

            if (! $hasAnswer) {
                return response()->json([
                    'message' => 'Tafadhali jaza: '.($field['label'] ?? 'Required field'),
                ], 422);
            }
        }

        $requestType = $validated['request_type'] ?? match ($product->service_mode) {
            'request_quote' => 'quote_request',
            'book_appointment' => 'appointment_request',
            default => 'contact_request',
        };
        $selectedServiceOption = null;
        if (! empty($validated['selected_service_option_id'])) {
            $selectedServiceOption = collect($product->service_options ?? [])
                ->first(fn ($option) => (string) ($option['id'] ?? '') === (string) $validated['selected_service_option_id']);

            if (! $selectedServiceOption) {
                return response()->json([
                    'message' => 'Chaguo la huduma halipatikani. Tafadhali chagua tena.',
                ], 422);
            }
        }

        if (! empty($validated['selected_slot_start'])) {
            $timezone = $validated['timezone'] ?? 'Africa/Dar_es_Salaam';
            $slotDate = CarbonImmutable::parse($validated['selected_slot_start'], $timezone)->toDateString();
            $selectedStart = CarbonImmutable::parse($validated['selected_slot_start'])->timestamp;
            $matchingSlot = collect($this->slotService->slotsForProduct($product, $slotDate, $timezone, $selectedServiceOption ? (array) $selectedServiceOption : null))
                ->first(fn (array $slot) => CarbonImmutable::parse($slot['starts_at'])->timestamp === $selectedStart);

            if (! $matchingSlot || ! ($matchingSlot['available'] ?? false)) {
                return response()->json([
                    'message' => 'Samahani, muda huu tayari umejaa. Tafadhali chagua muda mwingine.',
                ], 422);
            }
        }

        $selectedSession = null;
        if ($requestType === 'appointment_request'
            && ($product->service_scheduling_type ?: 'none') === 'fixed_sessions'
            && empty($validated['selected_session_id'])
        ) {
            return response()->json(['message' => 'Please choose an available session for this service.'], 422);
        }

        if (! empty($validated['selected_session_id'])) {
            $selectedSession = ServiceSession::query()
                ->where('product_id', $product->id)
                ->where('status', 'open')
                ->findOrFail((int) $validated['selected_session_id']);

            if ($selectedSession->registration_deadline && $selectedSession->registration_deadline->isPast()) {
                return response()->json(['message' => 'Registration for this session is closed.'], 422);
            }

            $bookedCount = ServiceRequest::query()
                ->where('product_id', $product->id)
                ->whereIn('status', ['pending', 'contacted', 'quoted', 'confirmed'])
                ->where('metadata->service_session_id', $selectedSession->id)
                ->count();

            if ($selectedSession->capacity !== null && $bookedCount >= $selectedSession->capacity) {
                return response()->json(['message' => 'This session is already full.'], 422);
            }
        }

        $serviceRequest = ServiceRequest::create([
            'merchant_id' => $product->merchant_id,
            'product_id' => $product->id,
            'buyer_id' => $request->user()?->id,
            'request_type' => $requestType,
            'status' => 'pending',
            'customer_name' => $validated['customer_name'],
            'customer_phone' => $validated['customer_phone'] ?? null,
            'customer_email' => $validated['customer_email'] ?? null,
            'preferred_date' => $validated['preferred_date'] ?? null,
            'preferred_time' => $validated['preferred_time'] ?? null,
            'scheduled_at' => $selectedSession?->starts_at ?? ($validated['selected_slot_start'] ?? null),
            'scheduled_ends_at' => $selectedSession?->ends_at ?? ($validated['selected_slot_end'] ?? null),
            'timezone' => $selectedSession?->timezone ?? ($validated['timezone'] ?? null),
            'duration_minutes' => $selectedSession?->starts_at && $selectedSession?->ends_at
                ? $selectedSession->starts_at->diffInMinutes($selectedSession->ends_at)
                : ($selectedServiceOption['duration_minutes'] ?? $product->service_duration_minutes),
            'location_text' => $validated['location_text'] ?? null,
            'message' => $validated['message'] ?? null,
            'client_requirements' => $validated['client_requirements'] ?? [],
            'deposit_amount' => $product->service_deposit_amount,
            'booking_provider' => $product->service_booking_provider ?: 'manual',
            'metadata' => [
                'service_mode' => $product->service_mode,
                'service_scheduling_type' => $product->service_scheduling_type,
                'service_session_id' => $selectedSession?->id,
                'service_session_title' => $selectedSession?->title,
                'service_price_display' => $product->service_price_display,
                'service_option_id' => $selectedServiceOption['id'] ?? null,
                'service_option' => $selectedServiceOption ? [
                    'id' => $selectedServiceOption['id'] ?? null,
                    'name' => $selectedServiceOption['name'] ?? null,
                    'price' => $selectedServiceOption['price'] ?? null,
                    'price_display' => $selectedServiceOption['price_display'] ?? null,
                    'capacity_type' => $selectedServiceOption['capacity_type'] ?? null,
                    'capacity' => $selectedServiceOption['capacity'] ?? null,
                    'max_guests' => $selectedServiceOption['max_guests'] ?? null,
                    'checkin_time' => $selectedServiceOption['checkin_time'] ?? null,
                    'checkout_time' => $selectedServiceOption['checkout_time'] ?? null,
                ] : null,
                'source' => 'product_detail',
            ],
        ]);

        return response()->json([
            'message' => 'Ombi lako limetumwa. Provider atawasiliana nawe.',
            'data' => $this->serialize($serviceRequest->load('product')),
        ], 201);
    }

    public function uploadIntakeFile(Request $request, MediaUploadService $mediaService): JsonResponse
    {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:51200',
                'mimes:jpg,jpeg,png,webp,gif,heic,heif,mp4,mov,webm,pdf,doc,docx,xls,xlsx,ppt,pptx,csv,txt',
            ],
        ]);

        $file = $request->file('file');
        $url = $mediaService->uploadFile($file, 'service-request-intake', true);

        return response()->json([
            'url' => str_starts_with($url, 'private://') ? $url : "private://{$url}",
            'name' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
            'mime' => $file->getMimeType(),
        ]);
    }

    public function showAttachment(Request $request, Merchant $merchant, ServiceRequest $serviceRequest, string $field, int $index)
    {
        abort_unless((int) $merchant->id === (int) $serviceRequest->merchant_id, 404);

        $attachments = $serviceRequest->client_requirements[$field] ?? null;
        abort_unless(is_array($attachments) && isset($attachments[$index]) && is_array($attachments[$index]), 404);

        $attachment = $attachments[$index];
        $url = (string) ($attachment['url'] ?? '');
        abort_unless(str_starts_with($url, 'private://'), 404);

        $path = ltrim(str_replace('private://', '', $url), '/');
        abort_unless(str_starts_with($path, 'service-request-intake/'), 404);

        $filename = str_replace(['"', "\r", "\n"], '', (string) ($attachment['name'] ?? basename($path)));
        $mime = (string) ($attachment['mime'] ?? 'application/octet-stream');

        try {
            $disk = Storage::disk('s3');
            if ($disk->exists($path)) {
                return redirect()->away($disk->temporaryUrl($path, now()->addMinutes(10), [
                    'ResponseContentDisposition' => 'inline; filename="'.$filename.'"',
                    'ResponseContentType' => $mime,
                ]));
            }
        } catch (\Throwable $e) {
            // Local development normally lands here when S3 is not configured.
        }

        abort_unless(Storage::disk('local')->exists($path), 404);

        return response()->file(Storage::disk('local')->path($path), [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    public function merchantIndex(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);

        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'scheduled_from' => ['nullable', 'date'],
            'scheduled_to' => ['nullable', 'date', 'after_or_equal:scheduled_from'],
            'scheduled_only' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'string', Rule::in(['latest', 'scheduled'])],
        ]);

        $status = $request->query('status');
        $query = ServiceRequest::query()
            ->where('merchant_id', $merchant->id)
            ->with(['product:id,title,type,slug,url,service_mode,service_price_display,service_intake_form'])
            ->with(['notifications' => fn ($query) => $query->latest()]);

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($request->boolean('scheduled_only')) {
            $query->whereNotNull('scheduled_at');
        }

        if (! empty($validated['scheduled_from'])) {
            $query->where('scheduled_at', '>=', $validated['scheduled_from']);
        }

        if (! empty($validated['scheduled_to'])) {
            $query->where('scheduled_at', '<=', $validated['scheduled_to']);
        }

        if (($validated['sort'] ?? 'latest') === 'scheduled') {
            $query->orderByRaw('scheduled_at is null')->orderBy('scheduled_at');
        } else {
            $query->latest();
        }

        $requests = $query->paginate((int) ($validated['per_page'] ?? 20));

        return response()->json([
            'data' => $requests->getCollection()->map(fn (ServiceRequest $item) => $this->serialize($item))->values(),
            'meta' => [
                'current_page' => $requests->currentPage(),
                'last_page' => $requests->lastPage(),
                'total' => $requests->total(),
            ],
        ]);
    }

    public function updateStatus(Request $request, Merchant $merchant, ServiceRequest $serviceRequest): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless((int) $serviceRequest->merchant_id === (int) $merchant->id, 404);

        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(['pending', 'contacted', 'quoted', 'confirmed', 'completed', 'cancelled'])],
            'quoted_amount' => ['nullable', 'numeric', 'min:0'],
            'scheduled_at' => ['nullable', 'date'],
            'scheduled_ends_at' => ['nullable', 'date', 'after:scheduled_at'],
            'timezone' => ['nullable', 'timezone'],
            'generate_payment_link' => ['nullable', 'boolean'],
            'prepare_calendar_event' => ['nullable', 'boolean'],
        ]);

        $updates = [
            'status' => $validated['status'],
            'quoted_amount' => array_key_exists('quoted_amount', $validated) ? $validated['quoted_amount'] : $serviceRequest->quoted_amount,
            'scheduled_at' => array_key_exists('scheduled_at', $validated) ? $validated['scheduled_at'] : $serviceRequest->scheduled_at,
            'scheduled_ends_at' => array_key_exists('scheduled_ends_at', $validated) ? $validated['scheduled_ends_at'] : $serviceRequest->scheduled_ends_at,
            'timezone' => array_key_exists('timezone', $validated) ? $validated['timezone'] : $serviceRequest->timezone,
        ];

        if (($validated['generate_payment_link'] ?? false) || in_array($validated['status'], ['quoted', 'confirmed'], true)) {
            $quoteAmount = $updates['quoted_amount'] ?? $serviceRequest->quoted_amount;
            if ($quoteAmount !== null && (float) $quoteAmount > 0) {
                $updates['payment_token'] = $serviceRequest->payment_token ?: ServiceRequest::generatePaymentToken();
                $updates['payment_status'] = $serviceRequest->payment_status ?: 'payment_link_created';
                $updates['payment_link_expires_at'] = $serviceRequest->payment_link_expires_at ?: now()->addDays(14);
            }
        }

        $serviceRequest->update($updates);
        $serviceRequest = $serviceRequest->fresh(['product', 'notifications']);

        if (($validated['prepare_calendar_event'] ?? false) || ($serviceRequest->scheduled_at && $serviceRequest->status === 'confirmed')) {
            $serviceRequest = $this->calendarService->prepareEvent($serviceRequest)->fresh(['product', 'notifications']);
        }

        return response()->json([
            'message' => 'Service request imesasishwa.',
            'data' => $this->serialize($serviceRequest),
        ]);
    }

    public function prepareNotification(Request $request, Merchant $merchant, ServiceRequest $serviceRequest): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless((int) $serviceRequest->merchant_id === (int) $merchant->id, 404);

        $validated = $request->validate([
            'channels' => ['nullable', 'array'],
            'channels.*' => ['string', Rule::in(['sms', 'whatsapp', 'email'])],
        ]);

        try {
            $notifications = $this->notificationService->preparePaymentLink(
                $serviceRequest->fresh(['product']),
                $validated['channels'] ?? []
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Notification payloads are ready. They are pending provider integration.',
            'data' => collect($notifications)->map(fn (ServiceRequestNotification $notification) => $this->serializeNotification($notification))->values(),
            'service_request' => $this->serialize($serviceRequest->fresh(['product', 'notifications'])),
        ]);
    }

    public function markDelivered(Request $request, Merchant $merchant, ServiceRequest $serviceRequest): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless((int) $serviceRequest->merchant_id === (int) $merchant->id, 404);

        if (! in_array($serviceRequest->payment_status, ['held', 'paid'], true)) {
            return response()->json([
                'message' => 'Huduma hii haipo kwenye SafePay hold.',
            ], 422);
        }

        $serviceRequest->update([
            'delivery_status' => 'provider_marked_delivered',
            'delivered_at' => now(),
            'auto_confirm_after' => now()->addDays(3),
            'status' => 'completed',
        ]);

        return response()->json([
            'message' => 'Huduma imewekwa kama imetolewa. Mteja anaweza kuthibitisha au kufungua mgogoro.',
            'data' => $this->serialize($serviceRequest->fresh(['product', 'notifications'])),
        ]);
    }


    public function scheduling(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);

        $productId = $request->integer('product_id') ?: null;
        if ($productId) {
            Product::query()
                ->where('merchant_id', $merchant->id)
                ->where('type', 'service')
                ->findOrFail($productId);
        }

        $integration = $this->calendarService->ensureGoogleCalendarPending($merchant);
        $rules = ServiceAvailabilityRule::query()
            ->where('merchant_id', $merchant->id)
            ->where(function ($query) use ($productId) {
                $query->where('product_id', $productId)->orWhereNull('product_id');
            })
            ->orderByRaw('product_id is null')
            ->orderBy('weekday')
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'integration' => $this->serializeIntegration($integration),
            'availability_rules' => $rules->map(fn (ServiceAvailabilityRule $rule) => $this->serializeRule($rule))->values(),
        ]);
    }

    public function sessions(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);

        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
        ]);

        Product::query()
            ->where('merchant_id', $merchant->id)
            ->where('type', 'service')
            ->findOrFail((int) $validated['product_id']);

        $sessions = ServiceSession::query()
            ->where('merchant_id', $merchant->id)
            ->where('product_id', (int) $validated['product_id'])
            ->orderBy('starts_at')
            ->get();

        return response()->json([
            'sessions' => $sessions->map(fn (ServiceSession $session) => $this->serializeSession($session))->values(),
        ]);
    }

    public function updateSessions(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);

        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'sessions' => ['required', 'array'],
            'sessions.*.title' => ['nullable', 'string', 'max:160'],
            'sessions.*.starts_at' => ['required', 'date'],
            'sessions.*.ends_at' => ['nullable', 'date'],
            'sessions.*.timezone' => ['nullable', 'timezone'],
            'sessions.*.location_type' => ['nullable', 'string', Rule::in(['provider_location', 'customer_location', 'remote', 'hybrid'])],
            'sessions.*.location_text' => ['nullable', 'string', 'max:255'],
            'sessions.*.capacity' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'sessions.*.price_override' => ['nullable', 'numeric', 'min:0'],
            'sessions.*.registration_deadline' => ['nullable', 'date'],
            'sessions.*.status' => ['nullable', 'string', Rule::in(['draft', 'open', 'full', 'closed', 'cancelled'])],
        ]);

        $product = Product::query()
            ->where('merchant_id', $merchant->id)
            ->where('type', 'service')
            ->findOrFail((int) $validated['product_id']);

        foreach ($validated['sessions'] as $session) {
            if (! empty($session['ends_at']) && CarbonImmutable::parse($session['ends_at'])->lessThanOrEqualTo(CarbonImmutable::parse($session['starts_at']))) {
                return response()->json(['message' => 'Each session end time must be after its start time.'], 422);
            }
        }

        ServiceSession::query()
            ->where('merchant_id', $merchant->id)
            ->where('product_id', $product->id)
            ->delete();

        $timezone = $this->merchantTimezone($merchant);
        $sessions = collect($validated['sessions'])
            ->map(fn (array $session) => ServiceSession::create([
                'merchant_id' => $merchant->id,
                'product_id' => $product->id,
                'title' => trim((string) ($session['title'] ?? '')) ?: null,
                'starts_at' => CarbonImmutable::parse($session['starts_at'], $session['timezone'] ?? $timezone)->utc(),
                'ends_at' => ! empty($session['ends_at']) ? CarbonImmutable::parse($session['ends_at'], $session['timezone'] ?? $timezone)->utc() : null,
                'timezone' => $session['timezone'] ?? $timezone,
                'location_type' => $session['location_type'] ?? $product->service_location_type,
                'location_text' => trim((string) ($session['location_text'] ?? '')) ?: null,
                'capacity' => isset($session['capacity']) && $session['capacity'] !== '' ? (int) $session['capacity'] : null,
                'price_override' => isset($session['price_override']) && $session['price_override'] !== '' ? (float) $session['price_override'] : null,
                'registration_deadline' => ! empty($session['registration_deadline']) ? CarbonImmutable::parse($session['registration_deadline'], $session['timezone'] ?? $timezone)->utc() : null,
                'status' => $session['status'] ?? 'open',
            ]))
            ->values();

        return response()->json([
            'message' => 'Service sessions saved.',
            'sessions' => $sessions->map(fn (ServiceSession $session) => $this->serializeSession($session))->values(),
        ]);
    }

    public function updateScheduling(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);

        $validated = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'timezone' => ['nullable', 'timezone'],
            'rules' => ['required', 'array'],
            'rules.*.weekday' => ['required', 'integer', 'min:1', 'max:7'],
            'rules.*.start_time' => ['required', 'date_format:H:i'],
            'rules.*.end_time' => ['required', 'date_format:H:i'],
            'rules.*.slot_interval_minutes' => ['nullable', 'integer', 'min:5', 'max:1440'],
            'rules.*.buffer_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'rules.*.capacity_type' => ['nullable', 'string', Rule::in(['limited', 'unlimited'])],
            'rules.*.capacity' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'rules.*.is_active' => ['nullable', 'boolean'],
        ]);

        $productId = $validated['product_id'] ?? null;
        if ($productId) {
            Product::query()
                ->where('merchant_id', $merchant->id)
                ->where('type', 'service')
                ->findOrFail($productId);
        }

        $timezone = $validated['timezone'] ?? $this->merchantTimezone($merchant);

        ServiceAvailabilityRule::query()
            ->where('merchant_id', $merchant->id)
            ->where('product_id', $productId)
            ->delete();

        $rules = collect($validated['rules'])
            ->map(fn (array $rule) => ServiceAvailabilityRule::create([
                'merchant_id' => $merchant->id,
                'product_id' => $productId,
                'timezone' => $timezone,
                'weekday' => $rule['weekday'],
                'start_time' => $rule['start_time'],
                'end_time' => $rule['end_time'],
                'slot_interval_minutes' => $rule['slot_interval_minutes'] ?? 30,
                'buffer_minutes' => $rule['buffer_minutes'] ?? 0,
                'capacity' => ($rule['capacity_type'] ?? 'limited') === 'unlimited' ? 1 : ($rule['capacity'] ?? 1),
                'is_active' => $rule['is_active'] ?? true,
                'metadata' => [
                    'capacity_type' => $rule['capacity_type'] ?? 'limited',
                ],
            ]))
            ->values();

        return response()->json([
            'message' => 'Service scheduling settings are ready.',
            'availability_rules' => $rules->map(fn (ServiceAvailabilityRule $rule) => $this->serializeRule($rule))->values(),
            'integration' => $this->serializeIntegration($this->calendarService->ensureGoogleCalendarPending($merchant)),
        ]);
    }

    public function prepareCalendarEvent(Request $request, Merchant $merchant, ServiceRequest $serviceRequest): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless((int) $serviceRequest->merchant_id === (int) $merchant->id, 404);

        try {
            $serviceRequest = $this->calendarService->prepareEvent($serviceRequest)->fresh(['product', 'notifications']);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Calendar event payload is ready. Google sync is pending OAuth integration.',
            'data' => $this->serialize($serviceRequest),
        ]);
    }

    public function productSlots(Request $request, Product $product): JsonResponse
    {
        abort_unless($product->type === 'service', 404);

        $validated = $request->validate([
            'date' => ['required', 'date', 'after_or_equal:today'],
            'timezone' => ['nullable', 'timezone'],
            'service_option_id' => ['nullable', 'string', 'max:80'],
        ]);
        $serviceOption = null;
        if (! empty($validated['service_option_id'])) {
            $serviceOption = collect($product->service_options ?? [])
                ->first(fn ($option) => (string) ($option['id'] ?? '') === (string) $validated['service_option_id']);
        }

        if (($product->service_scheduling_type ?: 'none') === 'fixed_sessions') {
            $day = CarbonImmutable::parse($validated['date'], $validated['timezone'] ?? $product->merchant?->defaultTimezone() ?? 'Africa/Dar_es_Salaam');
            $sessions = ServiceSession::query()
                ->where('product_id', $product->id)
                ->where('status', 'open')
                ->whereBetween('starts_at', [$day->startOfDay()->utc(), $day->endOfDay()->utc()])
                ->orderBy('starts_at')
                ->get();

            $bookedCounts = ServiceRequest::query()
                ->where('product_id', $product->id)
                ->whereIn('status', ['pending', 'contacted', 'quoted', 'confirmed'])
                ->whereIn('metadata->service_session_id', $sessions->pluck('id')->all())
                ->get()
                ->groupBy(fn (ServiceRequest $serviceRequest) => (int) ($serviceRequest->metadata['service_session_id'] ?? 0))
                ->map->count();

            return response()->json([
                'data' => $sessions->map(fn (ServiceSession $session) => $this->serializePublicSession($session, (int) ($bookedCounts[$session->id] ?? 0)))->values(),
            ]);
        }

        return response()->json([
            'data' => $this->slotService->slotsForProduct($product, $validated['date'], $validated['timezone'] ?? null, $serviceOption ? (array) $serviceOption : null),
        ]);
    }

    private function serialize(ServiceRequest $serviceRequest): array
    {
        return [
            'id' => $serviceRequest->id,
            'public_id' => $serviceRequest->public_id,
            'request_type' => $serviceRequest->request_type,
            'status' => $serviceRequest->status,
            'payment_status' => $serviceRequest->payment_status,
            'delivery_status' => $serviceRequest->delivery_status,
            'delivered_at' => $serviceRequest->delivered_at?->toISOString(),
            'customer_confirmed_at' => $serviceRequest->customer_confirmed_at?->toISOString(),
            'disputed_at' => $serviceRequest->disputed_at?->toISOString(),
            'auto_confirm_after' => $serviceRequest->auto_confirm_after?->toISOString(),
            'payment_url' => $serviceRequest->payment_token
                ? URL::to("/service-requests/{$serviceRequest->public_id}/pay/{$serviceRequest->payment_token}")
                : null,
            'payment_link_expires_at' => $serviceRequest->payment_link_expires_at?->toISOString(),
            'payment_order_id' => $serviceRequest->payment_order_id,
            'customer_name' => $serviceRequest->customer_name,
            'customer_phone' => $serviceRequest->customer_phone,
            'customer_email' => $serviceRequest->customer_email,
            'preferred_date' => $serviceRequest->preferred_date?->toDateString(),
            'preferred_time' => $serviceRequest->preferred_time,
            'scheduled_at' => $serviceRequest->scheduled_at?->toISOString(),
            'scheduled_ends_at' => $serviceRequest->scheduled_ends_at?->toISOString(),
            'timezone' => $serviceRequest->timezone,
            'duration_minutes' => $serviceRequest->duration_minutes,
            'location_text' => $serviceRequest->location_text,
            'message' => $serviceRequest->message,
            'client_requirements' => $serviceRequest->client_requirements ?? [],
            'quoted_amount' => $serviceRequest->quoted_amount !== null ? (float) $serviceRequest->quoted_amount : null,
            'deposit_amount' => $serviceRequest->deposit_amount !== null ? (float) $serviceRequest->deposit_amount : null,
            'booking_provider' => $serviceRequest->booking_provider,
            'calendar_provider' => $serviceRequest->calendar_provider,
            'calendar_sync_status' => $serviceRequest->calendar_sync_status,
            'calendar_event_id' => $serviceRequest->calendar_event_id,
            'calendar_sync_error' => $serviceRequest->calendar_sync_error,
            'calendar_synced_at' => $serviceRequest->calendar_synced_at?->toISOString(),
            'calendar_event_payload' => $serviceRequest->metadata['calendar_event_payload'] ?? null,
            'service_option' => $serviceRequest->metadata['service_option'] ?? null,
            'service_session' => [
                'id' => $serviceRequest->metadata['service_session_id'] ?? null,
                'title' => $serviceRequest->metadata['service_session_title'] ?? null,
            ],
            'product' => $serviceRequest->relationLoaded('product') && $serviceRequest->product ? [
                'id' => $serviceRequest->product->id,
                'title' => $serviceRequest->product->title,
                'slug' => $serviceRequest->product->slug,
                'type' => $serviceRequest->product->type,
                'service_mode' => $serviceRequest->product->service_mode,
                'service_intake_form' => $serviceRequest->product->service_intake_form ?? [],
            ] : null,
            'notifications' => $serviceRequest->relationLoaded('notifications')
                ? $serviceRequest->notifications->map(fn (ServiceRequestNotification $notification) => $this->serializeNotification($notification))->values()
                : [],
            'created_at' => $serviceRequest->created_at?->toISOString(),
        ];
    }

    private function serializeNotification(ServiceRequestNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'channel' => $notification->channel,
            'recipient' => $notification->recipient,
            'subject' => $notification->subject,
            'message' => $notification->message,
            'status' => $notification->status,
            'provider' => $notification->provider,
            'error_message' => $notification->error_message,
            'metadata' => $notification->metadata ?? [],
            'prepared_at' => $notification->prepared_at?->toISOString(),
            'sent_at' => $notification->sent_at?->toISOString(),
        ];
    }

    private function serializeIntegration(MerchantServiceIntegration $integration): array
    {
        return [
            'id' => $integration->id,
            'provider' => $integration->provider,
            'status' => $integration->status,
            'external_account_email' => $integration->external_account_email,
            'calendar_id' => $integration->calendar_id,
            'scopes' => $integration->scopes ?? [],
            'settings' => $integration->settings ?? [],
            'last_synced_at' => $integration->last_synced_at?->toISOString(),
            'last_error' => $integration->last_error,
        ];
    }

    private function serializeRule(ServiceAvailabilityRule $rule): array
    {
        return [
            'id' => $rule->id,
            'product_id' => $rule->product_id,
            'timezone' => $rule->timezone,
            'weekday' => $rule->weekday,
            'start_time' => substr((string) $rule->start_time, 0, 5),
            'end_time' => substr((string) $rule->end_time, 0, 5),
            'slot_interval_minutes' => $rule->slot_interval_minutes,
            'buffer_minutes' => $rule->buffer_minutes,
            'capacity_type' => $rule->metadata['capacity_type'] ?? 'limited',
            'capacity' => $rule->capacity,
            'is_active' => $rule->is_active,
        ];
    }

    private function serializeSession(ServiceSession $session): array
    {
        return [
            'id' => $session->id,
            'product_id' => $session->product_id,
            'title' => $session->title,
            'starts_at' => $session->starts_at?->toISOString(),
            'ends_at' => $session->ends_at?->toISOString(),
            'timezone' => $session->timezone,
            'location_type' => $session->location_type,
            'location_text' => $session->location_text,
            'capacity' => $session->capacity,
            'price_override' => $session->price_override !== null ? (float) $session->price_override : null,
            'registration_deadline' => $session->registration_deadline?->toISOString(),
            'status' => $session->status,
        ];
    }

    private function serializePublicSession(ServiceSession $session, int $bookedCount): array
    {
        $capacity = $session->capacity;

        return [
            'session_id' => $session->id,
            'title' => $session->title,
            'starts_at' => $session->starts_at?->toISOString(),
            'ends_at' => $session->ends_at?->toISOString(),
            'timezone' => $session->timezone,
            'location_type' => $session->location_type,
            'location_text' => $session->location_text,
            'price_override' => $session->price_override !== null ? (float) $session->price_override : null,
            'capacity_type' => $capacity === null ? 'unlimited' : 'limited',
            'capacity' => $capacity,
            'booked_count' => $bookedCount,
            'remaining' => $capacity === null ? null : max(0, $capacity - $bookedCount),
            'available' => $capacity === null || $bookedCount < $capacity,
            'registration_deadline' => $session->registration_deadline?->toISOString(),
        ];
    }

    private function merchantTimezone(Merchant $merchant): string
    {
        return $merchant->defaultTimezone();
    }
}
