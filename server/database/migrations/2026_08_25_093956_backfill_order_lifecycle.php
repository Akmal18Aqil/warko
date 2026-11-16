<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('orders')
            ->where('status', 'sudah-dibayar')
            ->update([
                'payment_status' => 'paid',
                'kitchen_status' => 'served',
            ]);

        DB::table('orders')
            ->where('status', 'siap')
            ->update(['kitchen_status' => 'ready']);

        DB::table('orders')
            ->where('status', 'memasak')
            ->update(['kitchen_status' => 'preparing']);

        DB::table('orders')
            ->where('status', 'disimpan')
            ->update(['kitchen_status' => 'draft']);
    }

    public function down(): void
    {
        DB::table('orders')->update([
            'payment_status' => 'unpaid',
            'kitchen_status' => 'queued',
        ]);
    }
};
