<?php

namespace App\Jobs;

use App\Models\Comments;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class UpdateComment implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;

    /**
     * Create a new job instance.
     */
    public $user_id;
    public $comment_id;
    public $comment;
    public $attachments;
    public function __construct($user_id, $comment_id, $comment, $attachments = [])
    {
        $this->user_id = $user_id;
        $this->comment_id = $comment_id;
        $this->comment = $comment;
        $this->attachments = $attachments;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $comment = Comments::find($this->comment_id);
        if(!$comment){
            \Log::error("Comment not found: " . $this->comment_id);
            return;
        }
        $comment->fill([
            'comment' => $this->comment,
            'updated_by' => $this->user_id,
        ]);
        $comment->save();
        $comment->touch();
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
                $comment->attachments()->create([
                    'file_name' => $filename,
                    'file_type' => $type,
                    'file_path' => 'comments/' . $filename,
                ]);
            }
        } catch (\Exception $e) {
            \Log::error("Failed to upload attachments for comment ID " . $comment->id . ": " . $e->getMessage());
        }
    }
}
