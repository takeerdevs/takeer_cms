<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductEmbedding extends Model
{
    protected $table = 'product_embeddings';

    protected $fillable = [
        'product_id',
        'vector',
    ];

    // Note: the vector column is stored as pgvector type (raw SQL).
    // The pgvector/pgvector package handles serialization via the Vector class.
    protected function casts(): array
    {
        return [
            'vector' => \Pgvector\Laravel\Vector::class,
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Scope for cosine similarity search.
     * Usage: ProductEmbedding::nearestTo($queryVector)->limit(5)->get()
     */
    public function scopeNearestTo($query, array $embedding, string $metric = 'cosine'): \Illuminate\Database\Eloquent\Builder
    {
        $operator = match ($metric) {
            'cosine' => '<=>',
            'l2' => '<->',
            'inner' => '<#>',
            default => '<=>',
        };
        $vectorStr = '[' . implode(',', $embedding) . ']';
        return $query->orderByRaw("vector {$operator} ?", [$vectorStr]);
    }
}
