<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostProductTag extends Model
{
    protected $fillable = [
        'post_id',
        'product_id',
        'x_coordinate',
        'y_coordinate',
    ];

    protected function casts(): array
    {
        return [
            'x_coordinate' => 'float',
            'y_coordinate' => 'float',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
