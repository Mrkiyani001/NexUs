<?php

namespace App\Jobs;

use App\Models\CommentReply;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class DeleteCommentReply implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;

    public $user_id;
    public $reply_id;

    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $reply_id)
    {
        $this->user_id = $user_id;
        $this->reply_id = $reply_id;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $commentReply = CommentReply::with('attachments')->find($this->reply_id);
        if (!$commentReply) {
            Log::error("Comment Reply not found: " . $this->reply_id);
            return;
        }

        foreach ($commentReply->attachments as $attachment) {
            $filePath = public_path($attachment->file_path);
            if (file_exists($filePath)) {
                unlink($filePath);
            }
            $attachment->delete();
        }

        $commentReply->delete();
    }
}
