<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_status', 16)->default('unpaid')->index()->after('status');
            $table->string('kitchen_status', 16)->default('queued')->index()->after('payment_status');
            $table->unsignedBigInteger('discount')->default(0)->after('subtotal');
            $table->unsignedBigInteger('service_charge')->default(0)->after('discount');
            $table->string('table_name')->nullable()->after('table_number');
            $table->string('customer_name')->nullable()->after('guests');
            $table->string('waiter_id')->nullable()->after('customer_name');
            $table->string('waiter_name')->nullable()->after('waiter_id');
            $table->string('source', 16)->nullable()->after('waiter_name');
            $table->string('payment_choice', 16)->nullable()->after('source');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->text('note')->nullable()->after('qty');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('note');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'payment_status',
                'kitchen_status',
                'discount',
                'service_charge',
                'table_name',
                'customer_name',
                'waiter_id',
                'waiter_name',
                'source',
                'payment_choice',
            ]);
        });
    }
};
