<?php

namespace App\Http\Controllers;

use App\Models\MarketingEvent;
use App\Models\ContentReport;
use App\Models\TrackedLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TrackedLinkController extends Controller
{
    public function follow(Request $request, string $code): RedirectResponse|Response
    {
        $normalizedCode = preg_replace('/[^a-zA-Z0-9_-]/', '', $code);
        abort_if($normalizedCode === '', 404);

        $link = TrackedLink::query()
            ->where('code', $normalizedCode)
            ->firstOrFail();
        abort_unless($link->merchant_id, 422, 'This link cannot be reported.');

        if (! $link->isActive()) {
            return response($this->unavailableHtml(), 410)
                ->header('Content-Type', 'text/html; charset=UTF-8')
                ->header('X-Robots-Tag', 'noindex, nofollow');
        }

        $sessionId = $this->sessionId($request);

        $link->forceFill([
            'clicks_count' => $link->clicks_count + 1,
            'last_clicked_at' => now(),
        ])->save();

        MarketingEvent::query()->create([
            'merchant_id' => $link->merchant_id,
            'user_id' => $request->user()?->id,
            'session_id' => $sessionId,
            'event_type' => 'outbound_click',
            'entity_type' => $link->entity_type,
            'entity_id' => $link->entity_id,
            'source' => $link->link_type,
            'source_url' => url('/go/'.$link->code),
            'landing_url' => $link->destination_url,
            'referrer_url' => $request->headers->get('referer'),
            'utm_source' => $request->query('utm_source'),
            'utm_medium' => $request->query('utm_medium'),
            'utm_campaign' => $request->query('utm_campaign'),
            'utm_content' => $request->query('utm_content'),
            'utm_term' => $request->query('utm_term'),
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 1000, ''),
            'metadata' => [
                'tracked_link_id' => $link->id,
                'tracked_link_code' => $link->code,
                'destination_host' => $link->destination_host,
                'label' => $link->label,
                'link_type' => $link->link_type,
                'source_surface' => $link->source_surface,
                'context' => $link->metadata ?: [],
            ],
        ]);

        return redirect()
            ->away($link->destination_url)
            ->withCookie(cookie('takeer_attribution_session', $sessionId, 60 * 24 * 30, null, null, false, false, false, 'Lax'));
    }

    public function report(Request $request, string $code): JsonResponse
    {
        $normalizedCode = preg_replace('/[^a-zA-Z0-9_-]/', '', $code);
        abort_if($normalizedCode === '', 404);

        $link = TrackedLink::query()
            ->where('code', $normalizedCode)
            ->firstOrFail();

        $data = $request->validate([
            'reason' => ['nullable', 'in:adult_content,political_content,misleading,other'],
            'reason_code' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:1200'],
        ]);

        $report = ContentReport::query()->create([
            'reporter_id' => $request->user()?->id,
            'merchant_id' => $link->merchant_id,
            'item_type' => 'tracked_link',
            'item_id' => $link->id,
            'reason' => $data['reason'] ?? 'other',
            'reason_code' => $data['reason_code'] ?? 'harmful_link',
            'report_context' => 'tracked_link',
            'notes' => $data['notes'] ?? null,
            'status' => 'open',
            'safety_state' => 'reported',
            'evidence_url' => route('tracked-links.follow', $link->code),
            'metadata' => [
                'destination_url' => $link->destination_url,
                'destination_host' => $link->destination_host,
                'tracked_link_code' => $link->code,
                'ip_address' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 1000, ''),
            ],
        ]);

        return response()->json([
            'message' => 'Link report received.',
            'report_id' => $report->id,
        ], 201);
    }

    private function sessionId(Request $request): string
    {
        $sessionId = (string) ($request->query('session_id') ?: $request->cookie('takeer_attribution_session', ''));
        $sessionId = preg_replace('/[^a-zA-Z0-9_-]/', '', $sessionId);

        return $sessionId !== '' ? Str::limit($sessionId, 80, '') : 'atk_'.Str::random(32);
    }

    private function unavailableHtml(): string
    {
        return <<<'HTML'
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Link unavailable | Takeer</title>
    <style>
        body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a}
        main{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
        section{max-width:520px;border:1px solid #e2e8f0;background:white;border-radius:18px;padding:28px;box-shadow:0 18px 45px rgba(15,23,42,.08)}
        h1{font-size:24px;line-height:1.2;margin:0 0 10px;font-weight:900}
        p{font-size:14px;line-height:1.7;color:#475569;margin:0 0 18px}
        a{display:inline-flex;height:42px;align-items:center;border-radius:12px;background:#0f172a;color:#fff;padding:0 16px;text-decoration:none;font-size:14px;font-weight:800}
    </style>
</head>
<body>
<main>
    <section>
        <h1>This link is unavailable</h1>
        <p>Takeer has disabled this destination while reviewing a safety issue. The creator can appeal or update the link from their merchant dashboard.</p>
        <a href="/">Back to Takeer</a>
    </section>
</main>
</body>
</html>
HTML;
    }
}
