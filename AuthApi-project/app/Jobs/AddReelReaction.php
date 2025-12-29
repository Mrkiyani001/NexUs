<?php

namespace App\Jobs;

use App\Models\Reel;
use App\Models\Reaction;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AddReelReaction implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;
    public $user_id;
    public $reel_id;
    public $type;

    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $reel_id, $type)
    {
        $this->user_id = $user_id;
        $this->reel_id = $reel_id;
        $this->type = $type;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info("AddReelReaction Job Started: User: {$this->user_id}, Reel: {$this->reel_id}, Type: {$this->type}");

        $ReelExists = Reel::where('id', $this->reel_id)->exists();
        if (!$ReelExists) {
            Log::warning("AddReelReaction Job: Reel {$this->reel_id} does not exist.");
            return;
        }

        $lockKey = "reel_reaction:{$this->reel_id}:{$this->user_id}";
        try {
            Cache::lock($lockKey, 5)->block(5, function () {
                Log::info("AddReelReaction Job: Lock acquired for {$this->reel_id}");
                DB::transaction(function () {
                    $reaction = Reaction::where('reactionable_id', $this->reel_id)
                        ->where('reactionable_type', Reel::class)
                        ->where('created_by', $this->user_id)->first();

                    if ($reaction && (int) $reaction->type === (int) $this->type) {
                        Log::info("AddReelReaction Job: Removing existing reaction for {$this->reel_id}");
                        $reaction->delete();
                        return; // Optimization: If we deleted, we are done (toggle behavior handled by calling logic usually, or here logic implies removal if same type sent)
                               // Wait, AddReaction logic: if same type exists, delete it (Toggle). Yes.
                    }

                    Log::info("AddReelReaction Job: Updating/Creating reaction for {$this->reel_id}");
                    $reaction = Reaction::updateOrCreate([
                        'reactionable_id' => $this->reel_id,
                        'reactionable_type' => Reel::class,
                        'created_by' => $this->user_id,
                    ], [
                        'type' => $this->type,
                        'updated_by' => $this->user_id,
                    ]);
                });
            });
        } catch (\Exception $e) {
            Log::error("AddReelReaction Job Failed: " . $e->getMessage());
            throw $e;
        }
    }
}
