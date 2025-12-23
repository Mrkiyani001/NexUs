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
        Schema::create('comments_replies', function (Blueprint $table) {
            $table->id();
            $table->integer('comment_id')->unsigned();
            $table->integer('user_id')->unsigned();
            $table->text('reply');
            $table->integer('score')->default(0);
            $table->boolean('is_flagged')->default(false);
            $table->integer('created_by')->unsigned();
            $table->integer('updated_by')->unsigned();  
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('comments_replies');
    }
};
