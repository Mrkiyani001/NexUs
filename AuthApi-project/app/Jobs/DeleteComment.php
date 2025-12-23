<?php

namespace App\Jobs;

use App\Models\Comments;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;


class DeleteComment implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;
public $user_id;
public $comment_id;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $comment_id)
    {
        $this->user_id = $user_id;
        $this->comment_id = $comment_id;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $comment = Comments::with('attachments')->find($this->comment_id);
        if(!$comment){
            Log::error("Comment not found: " . $this->comment_id);
            return;
        }

        foreach ($comment->attachments as $attachment) {
            $filePath = public_path($attachment->file_path);
            if (file_exists($filePath)) {
                unlink($filePath);
            }
            $attachment->delete();
        }

        $comment->delete();
    }
}
