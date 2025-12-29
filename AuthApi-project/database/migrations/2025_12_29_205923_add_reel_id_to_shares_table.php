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
        Schema::table('shares', function (Blueprint $table) {
            $table->unsignedBigInteger('reel_id')->nullable()->after('post_id');
            $table->foreign('reel_id')->references('id')->on('reels')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shares', function (Blueprint $table) {
            $table->dropForeign(['reel_id']);
            $table->dropColumn('reel_id');
        });
    }
};
