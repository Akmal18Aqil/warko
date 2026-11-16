<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'no',
        'status',
        'payment_status',
        'kitchen_status',
        'order_type',
        'table_number',
        'table_name',
        'guests',
        'customer_name',
        'waiter_id',
        'waiter_name',
        'source',
        'payment_choice',
        'item_count',
        'subtotal',
        'discount',
        'service_charge',
        'tax',
        'total',
        'method',
        'paid_at',
    ];

    protected $casts = [
        'no' => 'integer',
        'table_number' => 'integer',
        'guests' => 'integer',
        'item_count' => 'integer',
        'subtotal' => 'integer',
        'tax' => 'integer',
        'total' => 'integer',
        'paid_at' => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
