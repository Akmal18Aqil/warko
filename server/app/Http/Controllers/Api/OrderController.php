<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Order::query()
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
                ]),
        ]);
    }
    public function updateStatus(Request $request, int $no): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['disimpan', 'memasak', 'siap', 'sudah-dibayar'])],
            'kitchenStatus' => ['required', Rule::in(['draft', 'queued', 'preparing', 'ready', 'served'])],
        ]);

        $order = Order::query()->where('no', $no)->firstOrFail();
        $order->update([
            'status' => $validated['status'],
            'kitchen_status' => $validated['kitchenStatus'],
        ]);

        return response()->json(['data' => ['no' => $order->no]]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'no' => ['required', 'integer', 'unique:orders,no'],
            'status' => ['required', Rule::in(['disimpan', 'memasak', 'siap', 'sudah-dibayar'])],
            'paymentStatus' => ['nullable', Rule::in(['unpaid', 'paid', 'refunded'])],
            'kitchenStatus' => ['nullable', Rule::in(['draft', 'queued', 'preparing', 'ready', 'served'])],
            'orderType' => ['required', Rule::in(['bawa-pulang', 'meja'])],
            'tableNumber' => ['nullable', 'integer', 'min:1'],
            'tableName' => ['nullable', 'string', 'max:100'],
            'guests' => ['nullable', 'integer', 'min:1'],
            'customerName' => ['nullable', 'string', 'max:120'],
            'waiterId' => ['nullable', 'string', 'max:80'],
            'waiterName' => ['nullable', 'string', 'max:120'],
            'source' => ['nullable', Rule::in(['pos', 'waiter', 'self-order'])],
            'paymentChoice' => ['nullable', Rule::in(['paid-now', 'pay-later'])],
            'discount' => ['nullable', 'integer', 'min:0'],
            'serviceCharge' => ['nullable', 'integer', 'min:0'],
            'method' => ['nullable', Rule::in(['kartu-qr', 'tunai', 'qris'])],
            'paidAt' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.barcode' => ['required', 'string', 'exists:products,barcode'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.note' => ['nullable', 'string', 'max:500'],
        ]);

        $order = DB::transaction(function () use ($validated) {
            $rawSubtotal = 0;
            $itemCount = 0;
            $resolved = [];

            foreach ($validated['items'] as $line) {
                $product = Product::query()->where('barcode', $line['barcode'])->firstOrFail();
                $rawSubtotal += $product->price * $line['qty'];
                $itemCount += $line['qty'];
                $resolved[] = [
                    'product' => $product,
                    'qty' => $line['qty'],
                    'note' => $line['note'] ?? null,
                ];
            }

            $discount = min($rawSubtotal, $validated['discount'] ?? 0);
            $subtotal = max(0, $rawSubtotal - $discount);
            $serviceCharge = $validated['serviceCharge'] ?? 0;
            $tax = (int) round(($subtotal + $serviceCharge) * 0.11);

            $order = Order::create([
                'no' => $validated['no'],
                'status' => $validated['status'],
                'payment_status' => $validated['paymentStatus'] ?? ($validated['paidAt'] ? 'paid' : 'unpaid'),
                'kitchen_status' => $validated['kitchenStatus'] ?? ($validated['status'] === 'sudah-dibayar' ? 'served' : 'queued'),
                'order_type' => $validated['orderType'],
                'table_number' => $validated['tableNumber'] ?? null,
                'table_name' => $validated['tableName'] ?? null,
                'guests' => $validated['guests'] ?? null,
                'customer_name' => $validated['customerName'] ?? null,
                'waiter_id' => $validated['waiterId'] ?? null,
                'waiter_name' => $validated['waiterName'] ?? null,
                'source' => $validated['source'] ?? null,
                'payment_choice' => $validated['paymentChoice'] ?? null,
                'item_count' => $itemCount,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'service_charge' => $serviceCharge,
                'tax' => $tax,
                'total' => $subtotal + $serviceCharge + $tax,
                'method' => $validated['method'] ?? null,
                'paid_at' => $validated['paidAt'] ?? null,
            ]);

            foreach ($resolved as $line) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $line['product']->id,
                    'product_name' => $line['product']->name,
                    'unit_price' => $line['product']->price,
                    'qty' => $line['qty'],
                    'note' => $line['note'],
                ]);
            }

            return $order;
        });

        return response()->json(['data' => ['no' => $order->no, 'total' => $order->total]], 201);
    }
}
