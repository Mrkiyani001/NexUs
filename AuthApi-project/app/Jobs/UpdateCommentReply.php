<?php

namespace App\Jobs;

use App\Models\CommentReply;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class UpdateCommentReply implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;

    public $user_id;
    public $reply_id;
    public $reply;
    public $attachments;

    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $reply_id, $reply, $attachments = [])
    {
        $this->user_id = $user_id;
        $this->reply_id = $reply_id;
        $this->reply = $reply;
        $this->attachments = $attachments;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $commentReply = CommentReply::find($this->reply_id);
        if (!$commentReply) {
            Log::error("Comment Reply not found: " . $this->reply_id);
            return;
        }

        $commentReply->fill([
            'reply' => $this->reply,
            'updated_by' => $this->user_id,
        ]);
        $commentReply->save();
        $commentReply->touch();

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
            Log::error("Failed to upload attachments for comment reply ID " . $commentReply->id . ": " . $e->getMessage());
        }
    }
}
