<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const RETIRED_MODEL = 'inclusionai/ling-3.0-flash:free';

    private const REPLACEMENT_MODEL = 'inclusionai/ling-3.0-flash';

    public function up(): void
    {
        DB::table('ai_models')
            ->where('model_key', self::RETIRED_MODEL)
            ->whereNotExists(function ($query): void {
                $query->selectRaw('1')
                    ->from('ai_models as replacement')
                    ->whereColumn('replacement.ai_provider_id', 'ai_models.ai_provider_id')
                    ->where('replacement.model_key', self::REPLACEMENT_MODEL);
            })
            ->update([
                'model_key' => self::REPLACEMENT_MODEL,
                'label' => self::REPLACEMENT_MODEL,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('ai_models')
            ->where('model_key', self::REPLACEMENT_MODEL)
            ->whereNotExists(function ($query): void {
                $query->selectRaw('1')
                    ->from('ai_models as retired')
                    ->whereColumn('retired.ai_provider_id', 'ai_models.ai_provider_id')
                    ->where('retired.model_key', self::RETIRED_MODEL);
            })
            ->update([
                'model_key' => self::RETIRED_MODEL,
                'label' => self::RETIRED_MODEL,
                'updated_at' => now(),
            ]);
    }
};
