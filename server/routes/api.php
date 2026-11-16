<?php

use App\Http\Controllers\Api\BootstrapController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;

Route::get('/products', [ProductController::class, 'index']);
Route::get('/bootstrap', BootstrapController::class);
Route::get('/orders', [OrderController::class, 'index']);
Route::post('/orders', [OrderController::class, 'store']);
Route::patch('/orders/{no}/status', [OrderController::class, 'updateStatus']);
