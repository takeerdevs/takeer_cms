<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('products', 'product_code')) {
            return;
        }

        DB::table('products')
            ->select(['id', 'product_code'])
            ->whereNotNull('product_code')
            ->where('product_code', 'not like', 'TK%')
            ->orderBy('id')
            ->chunkById(500, function ($products): void {
                foreach ($products as $product) {
                    $digits = preg_replace('/\D/', '', (string) $product->product_code);
                    if ($digits === '') {
                        continue;
                    }

                    DB::table('products')
                        ->where('id', $product->id)
                        ->update(['product_code' => 'TK'.$digits]);
                }
            });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('products', 'product_code')) {
            return;
        }

        DB::table('products')
            ->select(['id', 'product_code'])
            ->where('product_code', 'like', 'TK%')
            ->orderBy('id')
            ->chunkById(500, function ($products): void {
                foreach ($products as $product) {
                    DB::table('products')
                        ->where('id', $product->id)
                        ->update(['product_code' => substr((string) $product->product_code, 2)]);
                }
            });
    }
};
