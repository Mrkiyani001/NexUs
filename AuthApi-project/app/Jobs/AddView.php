<?php

namespace App\Jobs;

use App\Models\View;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AddView implements ShouldQueue
{
    use Queueable, Dispatchable, InteractsWithQueue, SerializesModels;
    public $user_id;
    public $post_id;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $post_id)
    {
        $this->user_id = $user_id;
        $this->post_id = $post_id;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info('AddView job started');
        $lockKey = "add_view_{$this->post_id}";
        try {
            Cache::lock($lockKey, 5)->block(5, function () {
                Log::info('AddView job processing');
                DB::transaction(function () {
                    View::firstOrCreate([
                        'post_id' => $this->post_id,
                        'created_by' => $this->user_id,
                    ], [
                        'updated_by' => $this->user_id,
                    ]);
                });
            });
        } catch (Exception $e) {
            Log::error('AddView job failed: ' . $e->getMessage());
            throw $e;
        }
    }
}
