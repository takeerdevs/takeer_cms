<?php

namespace App\Traits;

use App\Models\Impression;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

trait InteractsWithImpressions
{
    /**
     * Get all impressions for this model.
     */
    public function impressions()
    {
        return $this->morphMany(Impression::class, 'impressionable');
    }

    /**
     * Record a unique impression for this model.
     */
    public function recordImpression(Request $request): void
    {
        $identifier = $request->ip() . '_' . $request->userAgent();
        $cacheKey = "impression_{$this->getTable()}_{$this->id}_" . md5($identifier);

        if (!Cache::has($cacheKey)) {
            $this->impressions()->create([
                'merchant_id' => $this->merchant_id,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            // Increment the display counter
            $this->increment('views_count');

            // Debounce for 1 hour
            Cache::put($cacheKey, true, now()->addHour());
        }
    }
}
