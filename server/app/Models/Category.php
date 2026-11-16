<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'kind', 'color', 'sort_order', 'is_default'];

    protected $casts = [
        'sort_order' => 'integer',
        'is_default' => 'boolean',
    ];
}
