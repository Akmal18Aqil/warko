<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('restaurant_tables', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->string('name', 100);
            $table->unsignedTinyInteger('seats');
            $table->string('area', 80);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->string('name', 80);
            $table->string('kind', 32);
            $table->string('color', 32)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('shifts', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->dateTime('opened_at');
            $table->dateTime('closed_at')->nullable();
            $table->string('cashier_name', 120);
            $table->unsignedBigInteger('starting_cash')->default(0);
            $table->unsignedBigInteger('actual_cash')->nullable();
            $table->unsignedBigInteger('expected_cash')->nullable();
            $table->bigInteger('cash_difference')->nullable();
            $table->unsignedBigInteger('cash_sales_total')->nullable();
            $table->unsignedBigInteger('cash_in_total')->nullable();
            $table->unsignedBigInteger('cash_out_total')->nullable();
            $table->json('denominations')->nullable();
            $table->string('status', 16)->index();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('cash_movements', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->string('shift_id', 80)->nullable()->index();
            $table->string('type', 16)->index();
            $table->string('category', 32)->index();
            $table->unsignedBigInteger('amount');
            $table->text('description');
            $table->string('cashier_name', 120);
            $table->dateTime('occurred_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_movements');
        Schema::dropIfExists('shifts');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('restaurant_tables');
    }
};
