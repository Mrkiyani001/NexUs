<?php

namespace App\Jobs;

use App\Models\CommentReply;
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

class AddReactionToCommentReply implements ShouldQueue
{
    use Queueable,Dispatchable,InteractsWithQueue,SerializesModels;
public $user_id;
public $comment_reply_id;
public $type;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id,$comment_reply_id,$type)
    {
        $this->user_id = $user_id;
        $this->comment_reply_id = $comment_reply_id;
        $this->type = $type;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info("Job for comment reply reaction started: User: {$this->user_id}, Comment Reply: {$this->comment_reply_id}, Type: {$this->type}");
        $CommentReplyExists = CommentReply::where('id', $this->$comment_reply_id)->exists();
        if(!$CommentReplyExists){
            Log::info ("Warning: Comment Reply {$this->comment_reply_id} does not exist.");
            return;
        }
    $lockKey = "comment_reply_reaction:{$this->comment_reply_id}:{$this->user_id}";
    try{
        Log::info("Lock acquired for comment reply {$this->comment_reply_id}");
        Cache::lock($lockKey, 5)->block(5, function () {
            Log::info("Lock acquired for comment reply {$this->comment_reply_id}");
            DB::transaction(function () {
                $reaction = Reaction::where('reactionable_id', $this->comment_reply_id)
                ->where('reactionable_type', CommentReply::class)
                ->where('created_by', $this->user_id)->first();
                if($reaction && (int) $reaction->type === (int) $this->type){
                    Log::info("Reaction already exists for comment reply {$this->comment_reply_id}");
                    $reaction->delete();
                    $this->updateCommentReplyScore($this->comment_reply_id);
                    return;
                }
                Log::info("Reaction does not exist for comment reply {$this->comment_reply_id}");
                $reaction = Reaction::updateOrCreate([
                    'reactionable_id' => $this->comment_reply_id,
                    'reactionable_type' => CommentReply::class,
                    'created_by' => $this->user_id,
                ], [
                    'type' => $this->type,
                    'updated_by' => $this->user_id,
                ]);
                $this->updateCommentReplyScore($this->comment_reply_id);
            });
        });
    }catch(Exception $e){
        Log::error("AddReactionToCommentReply Job Failed: " . $e->getMessage());
        throw $e;
    }
}
    protected function updateCommentReplyScore(int $comment_reply_id){
        $count = Reaction::where('reactionable_id', $comment_reply_id)
        ->where('reactionable_type', CommentReply::class)
        ->selectRaw('SUM(CASE WHEN type = 1 THEN 1 ELSE 0 END) as like_count, 
             SUM(CASE WHEN type = 0 THEN 1 ELSE 0 END) as dislike_count')
             ->first();
        
        $like = (int) ($count->like_count ?? 0);
        $dislike = (int) ($count->dislike_count ?? 0);
        
        CommentReply::where('id', $comment_reply_id)->update([
            'score' => $like - $dislike,
            'updated_at' => now(),  
        ]);
    }
}
