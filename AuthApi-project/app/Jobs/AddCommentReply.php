<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

use App\Models\CommentReply;
use App\Models\Comments;
use Illuminate\Support\Facades\Log;

class AddCommentReply implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;

    public $user_id;
    public $comment_id;
    public $reply;
    public $attachments;

    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $comment_id, $reply, $attachments = [])
    {
        $this->user_id = $user_id;
        $this->comment_id = $comment_id;
        $this->reply = $reply;
        $this->attachments = $attachments;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $commentExists = Comments::where('id', $this->comment_id)->exists();
        if (!$commentExists) {
            Log::error("Comment not found: " . $this->comment_id);
            return;
        }

        $commentReply = CommentReply::create([
            'comment_id' => $this->comment_id,
            'user_id' => $this->user_id,
            'reply' => $this->reply,
            'created_by' => $this->user_id,
            'updated_by' => $this->user_id,
        ]);

        if (empty($this->attachments)) return;

        try {
            foreach ($this->attachments as $filename) {
                $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                $type = match (true) {
                    in_array($extension, ['jpg', 'jpeg', 'png', 'gif']) => 'image',
                    in_array($extension, ['mp4', 'avi', 'mov']) => 'video',
                    $extension === 'pdf' => 'pdf',
                    in_array($extension, ['doc', 'docx']) => 'word',
                    in_array($extension, ['zip', 'rar', '7z']) => 'zip',
                    default => 'other',
                };
                $commentReply->attachments()->create([
                    'file_name' => $filename,
                    'file_type' => $type,
                    'file_path' => 'comment_replies/' . $filename,
                ]);
            }
        } catch (\Exception $e) {
            \Log::error("Failed to upload attachments for comment reply ID " . $commentReply->id . ": " . $e->getMessage());
        }
    }
}
