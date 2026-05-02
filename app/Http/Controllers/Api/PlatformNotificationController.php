<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\PlatformNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformNotificationController extends Controller
{
    public function __construct(private readonly PlatformNotificationService $notifications)
    {
    }

    public function dispatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'target_user_id' => ['required', 'integer', 'exists:users,id'],
            'channels' => ['nullable', 'array'],
            'channels.*' => ['string', Rule::in(PlatformNotificationService::CHANNELS)],
            'subject' => ['nullable', 'string', 'max:160'],
            'message' => ['required', 'string', 'max:2000'],
            'metadata' => ['nullable', 'array'],
        ]);

        $actor = $request->user();
        if (! $actor?->is_admin && (int) $validated['target_user_id'] !== (int) $actor?->id) {
            abort(403, 'You can only dispatch notifications to your own user account.');
        }

        $target = User::query()->findOrFail($validated['target_user_id']);

        $logs = $this->notifications->dispatchToUser($target, [
            'channels' => $validated['channels'] ?? [],
            'subject' => $validated['subject'] ?? null,
            'message' => $validated['message'],
            'metadata' => $validated['metadata'] ?? [],
        ]);

        return response()->json([
            'message' => 'Notification payloads queued.',
            'data' => $logs->map(fn ($log) => [
                'id' => $log->id,
                'channel' => $log->channel,
                'recipient' => $log->recipient,
                'status' => $log->status,
                'gateway' => $log->gateway,
                'error_message' => $log->error_message,
            ])->values(),
        ]);
    }
}
