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
        Schema::table('voice_messages', function (Blueprint $table) {
            $table->boolean('delete_from_sender')->default(false);
            $table->boolean('delete_from_receiver')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('voice_messages', function (Blueprint $table) {
            $table->dropColumn('delete_from_sender');
            $table->dropColumn('delete_from_receiver');
        });
    }
};
