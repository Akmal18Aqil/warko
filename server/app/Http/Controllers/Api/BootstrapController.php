<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashMovement;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\Shift;
use Illuminate\Http\JsonResponse;

class BootstrapController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'data' => [
                'products' => Product::query()
                    ->where('is_active', true)
                    ->orderBy('name')
                    ->get()
                    ->map(fn (Product $product) => [
                        'id' => $product->barcode,
                        'barcode' => $product->barcode,
                        'name' => $product->name,
                        'description' => $product->description,
                        'price' => $product->price,
                        'category' => $product->category,
                        'kind' => $product->kind,
                        'prepMinutes' => $product->prep_minutes,
                        'badge' => $product->badge,
                        'image' => $product->image,
                    ])->values(),
                'orders' => Order::query()
                    ->with('items.product')
                    ->orderByDesc('no')
                    ->get()
                    ->map(fn (Order $order) => [
                        'no' => $order->no,
                        'status' => $order->status,
                        'paymentStatus' => $order->payment_status,
                        'kitchenStatus' => $order->kitchen_status,
                        'total' => $order->total,
                        'subtotal' => $order->subtotal,
                        'tax' => $order->tax,
                        'discount' => $order->discount,
                        'serviceCharge' => $order->service_charge,
                        'itemCount' => $order->item_count,
                        'items' => $order->items->map(fn (OrderItem $item) => [
                            'itemId' => $item->product?->barcode ?? (string) $item->product_id,
                            'name' => $item->product_name,
                            'qty' => $item->qty,
                            'price' => $item->unit_price,
                            'note' => $item->note,
                        ])->values(),
                        'method' => $order->method,
                        'orderType' => $order->order_type,
                        'tableNumber' => $order->table_number,
                        'tableName' => $order->table_name,
                        'guests' => $order->guests,
                        'customerName' => $order->customer_name,
                        'waiterId' => $order->waiter_id,
                        'waiterName' => $order->waiter_name,
                        'source' => $order->source,
                        'paymentChoice' => $order->payment_choice,
                        'paidAt' => $order->paid_at?->valueOf(),
                        'createdAt' => $order->created_at->valueOf(),
                    ])->values(),
                'tables' => RestaurantTable::query()->orderBy('name')->get()->map(fn (RestaurantTable $table) => [
                    'id' => $table->id,
                    'name' => $table->name,
                    'seats' => $table->seats,
                    'area' => $table->area,
                    'active' => $table->active,
                ])->values(),
                'categories' => Category::query()->orderBy('sort_order')->get()->map(fn (Category $category) => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'kind' => $category->kind,
                    'color' => $category->color,
                    'sortOrder' => $category->sort_order,
                    'isDefault' => $category->is_default,
                    'createdAt' => $category->created_at->valueOf(),
                ])->values(),
                'shifts' => Shift::query()->orderByDesc('opened_at')->get()->map(fn (Shift $shift) => [
                    'id' => $shift->id,
                    'openedAt' => $shift->opened_at->valueOf(),
                    'closedAt' => $shift->closed_at?->valueOf(),
                    'cashierName' => $shift->cashier_name,
                    'startingCash' => $shift->starting_cash,
                    'actualCash' => $shift->actual_cash,
                    'expectedCash' => $shift->expected_cash,
                    'cashDifference' => $shift->cash_difference,
                    'cashSalesTotal' => $shift->cash_sales_total,
                    'cashInTotal' => $shift->cash_in_total,
                    'cashOutTotal' => $shift->cash_out_total,
                    'denominations' => $shift->denominations,
                    'status' => $shift->status,
                    'notes' => $shift->notes,
                ])->values(),
                'cashMovements' => CashMovement::query()->orderByDesc('occurred_at')->get()->map(fn (CashMovement $movement) => [
                    'id' => $movement->id,
                    'shiftId' => $movement->shift_id,
                    'type' => $movement->type,
                    'category' => $movement->category,
                    'amount' => $movement->amount,
                    'description' => $movement->description,
                    'cashierName' => $movement->cashier_name,
                    'createdAt' => $movement->occurred_at->valueOf(),
                ])->values(),
            ],
        ]);
    }
}
