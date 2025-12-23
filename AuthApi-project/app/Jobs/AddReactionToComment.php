<?php

namespace App\Jobs;

use App\Models\Comments;
use App\Models\Reaction;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AddReactionToComment implements ShouldQueue
{
    use Queueable,Dispatchable,InteractsWithQueue,SerializesModels;
public $user_id;
public $comment_id;
public $type;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id,$comment_id,$type)
    {
        $this->user_id = $user_id;
        $this->comment_id = $comment_id;
        $this->type = $type;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info("Job for comment Reaction Started : User : {$this->user_id}, Comment : {$this->comment_id}, Type : {$this->type}");
        $CommentExists = Comments::where('id', $this->comment_id)->exists();
        if(!$CommentExists){
            Log::warning("Comment {$this->comment_id} does not exist.");
            return;
        }
        $lockKey = "comment_reaction:{$this->comment_id}:{$this->user_id}";
        try{
            Cache::lock($lockKey, 5)->block(5, function(){
                Log::info("Lock acquired for comment {$this->comment_id}");
                DB::transaction(function(){
                    $reaction = Reaction::where('reactionable_id', $this->comment_id)
                    ->where('reactionable_type', Comments::class)
                    ->where('created_by', $this->user_id)->first();

                    if($reaction && (int)$reaction->type === (int)$this->type){
                        Log::info("Removing existing reaction for comment {$this->comment_id}");
                        $reaction->delete();
                        $this->updateCommentScore($this->comment_id);
                        return;
                    }

                    Log::info("Updating/Creating reaction for comment {$this->comment_id}");
                    $reaction = Reaction::updateOrCreate([
                        'reactionable_id' => $this->comment_id,
                        'reactionable_type' => Comments::class,
                        'created_by' => $this->user_id,
                    ], [
                        'type' => $this->type,
                        'updated_by' => $this->user_id,
                    ]);
                    $this->updateCommentScore($this->comment_id);
                });
            });
        }catch(Exception $e){
            Log::error("Job for comment Reaction Failed: " . $e->getMessage());
            throw $e;
        }
    }
    protected function updateCommentScore(int $comment_id){
        $count = Reaction::where('reactionable_id', $comment_id)
        ->where('reactionable_type', Comments::class)
        ->selectRaw('SUM(CASE WHEN type = 1 THEN 1 ELSE 0 END) as like_count, 
             SUM(CASE WHEN type = 0 THEN 1 ELSE 0 END) as dislike_count')
             ->first();
        
        $like = (int) ($count->like_count ?? 0);
        $dislike = (int) ($count->dislike_count ?? 0);
        
        Comments::where('id', $comment_id)->update([
            'score' => $like - $dislike,
            'updated_at' => now(),  
        ]);
    }
}