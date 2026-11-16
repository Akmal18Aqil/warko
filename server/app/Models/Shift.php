<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Shift extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'opened_at', 'closed_at', 'cashier_name', 'starting_cash',
        'actual_cash', 'expected_cash', 'cash_difference', 'cash_sales_total',
        'cash_in_total', 'cash_out_total', 'denominations', 'status', 'notes',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'starting_cash' => 'integer',
        'actual_cash' => 'integer',
        'expected_cash' => 'integer',
        'cash_difference' => 'integer',
        'cash_sales_total' => 'integer',
        'cash_in_total' => 'integer',
        'cash_out_total' => 'integer',
        'denominations' => 'array',
    ];
}
