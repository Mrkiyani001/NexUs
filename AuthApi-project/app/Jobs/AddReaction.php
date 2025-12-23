<?php

namespace App\Jobs;

use App\Models\Post;
use App\Models\Reaction;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AddReaction implements ShouldQueue
{
    use Queueable,Dispatchable,SerializesModels,InteractsWithQueue;
public $user_id;
public $post_id;
public $type;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id,$post_id,$type)
    {
        $this->user_id = $user_id;
        $this->post_id = $post_id;
        $this->type = $type;
    }
    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info("AddReaction Job Started: User: {$this->user_id}, Post: {$this->post_id}, Type: {$this->type}");

        $PostExists = Post::where('id', $this->post_id)->exists();
        if (!$PostExists) {
            Log::warning("AddReaction Job: Post {$this->post_id} does not exist.");
            return;
        }

        $lockKey = "post_reaction:{$this->post_id}:{$this->user_id}";
        try {
            Cache::lock($lockKey, 5)->block(5, function () {
                Log::info("AddReaction Job: Lock acquired for {$this->post_id}");
                DB::transaction(function () {
                    $reaction = Reaction::where('reactionable_id', $this->post_id)
                        ->where('reactionable_type', Post::class)
                        ->where('created_by', $this->user_id)->first();

                    if ($reaction && (int) $reaction->type === (int) $this->type) {
                        Log::info("AddReaction Job: Removing existing reaction for {$this->post_id}");
                        $reaction->delete();
                        $this->updatePostScore($this->post_id);
                        return;
                    }

                    Log::info("AddReaction Job: Updating/Creating reaction for {$this->post_id}");
                    $reaction = Reaction::updateOrCreate([
                        'reactionable_id' => $this->post_id,
                        'reactionable_type' => Post::class,
                        'created_by' => $this->user_id,
                    ], [
                        'type' => $this->type,
                        'updated_by' => $this->user_id,
                    ]);
                    $this->updatePostScore($this->post_id);
                });
            });
        } catch (\Exception $e) {
            Log::error("AddReaction Job Failed: " . $e->getMessage());
            throw $e;
        }
    }
    protected function updatePostScore(int $post_id){
$count = Reaction::where('reactionable_id', $post_id)
->where('reactionable_type', Post::class)
        ->selectRaw('SUM(CASE WHEN type = 1 THEN 1 ELSE 0 END) as like_count, 
             SUM(CASE WHEN type = 0 THEN 1 ELSE 0 END) as dislike_count')
             ->first();
        
        $like = (int) ($count->like_count ?? 0);
        $dislike = (int) ($count->dislike_count ?? 0);
        
Post::where('id', $post_id)->update([
    'score' => $like - $dislike,
    'updated_at' => now(),  
]);
}
}