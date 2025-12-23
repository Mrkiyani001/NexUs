<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('post', function (Blueprint $table) {
            $table->smallInteger('status')->default(0)->comment('0: Draft, 1: Pending, 2: Approved, 3: Rejected');
            $table->dateTime('moderated_at')->nullable();
            $table->integer('moderated_by')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('post', function (Blueprint $table) {
            $table->dropColumn(['status', 'moderated_at', 'moderated_by']);
        });
    }
};
