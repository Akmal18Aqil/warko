<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RestaurantTable extends Model
{
    protected $table = 'restaurant_tables';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'seats', 'area', 'active'];

    protected $casts = [
        'seats' => 'integer',
        'active' => 'boolean',
    ];
}
