<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashMovement extends Model
{
    protected $table = 'cash_movements';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'shift_id', 'type', 'category', 'amount', 'description',
        'cashier_name', 'occurred_at',
    ];

    protected $casts = [
        'amount' => 'integer',
        'occurred_at' => 'datetime',
    ];
}
