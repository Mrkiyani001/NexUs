<?php

namespace App\Jobs;

use App\Models\Comments;
use App\Models\Post;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class AddComment implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;
public $user_id;
public $post_id;
public  $comment;
public $attachments;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $post_id, $comment, $attachments = [])
    {
        $this->user_id = $user_id;
        $this->post_id = $post_id;
        $this->comment = $comment;
        $this->attachments = $attachments;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $PostExists = Post::where('id',$this->post_id)->exists();
        if (!$PostExists) {
            Log::error("Post not found: " . $this->post_id);
            return;
        }
        $comment = Comments::create([
            'post_id' => $this->post_id,
            'user_id' => $this->user_id,
            'comment' => $this->comment,
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
