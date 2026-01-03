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
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_private')->default(false);
            $table->boolean('allow_friend_request')->default(true);
            $table->string('status')->default('Active');
            $table->boolean('email_login_alerts')->default(true);
            $table->boolean('push_login_alerts')->default(true);
            $table->boolean('suspicious_activity_alerts')->default(true);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_private');
            $table->dropColumn('allow_friend_request');
            $table->dropColumn('status');
            $table->dropColumn('email_login_alerts');
            $table->dropColumn('push_login_alerts');
            $table->dropColumn('suspicious_activity_alerts');
        });
    }
};
