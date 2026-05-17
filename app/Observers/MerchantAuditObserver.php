<?php

namespace App\Observers;

use App\Models\RetailAuditLog;
use App\Services\MerchantAuditService;
use Illuminate\Database\Eloquent\Model;

class MerchantAuditObserver
{
    public function created(Model $model): void
    {
        $this->record($model, 'created');
    }

    public function updated(Model $model): void
    {
        if (empty($model->getChanges())) {
            return;
        }

        $this->record($model, 'updated');
    }

    public function deleted(Model $model): void
    {
        $this->record($model, 'deleted');
    }

    private function record(Model $model, string $event): void
    {
        if ($model instanceof RetailAuditLog || !app()->bound('request') || !request()->user()) {
            return;
        }

        app(MerchantAuditService::class)->recordModelChange(request(), $model, $event);
    }
}
