<?php

namespace App\Jobs;

use App\Models\Comments;
use App\Models\Post;
use App\Models\Reel;
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
    public $reel_id;
    public $comment;
    public $attachments;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $post_id = null, $reel_id = null, $comment, $attachments = [])
    {
        $this->user_id = $user_id;
        $this->post_id = $post_id;
        $this->reel_id = $reel_id;
        $this->comment = $comment;
        $this->attachments = $attachments;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        if ($this->post_id) {
            $exists = Post::where('id', $this->post_id)->exists();
            if (!$exists) {
                Log::error("Post not found: " . $this->post_id);
                return;
            }
        } elseif ($this->reel_id) {
            $exists = Reel::where('id', $this->reel_id)->exists();
            if (!$exists) {
                Log::error("Reel not found: " . $this->reel_id);
                return;
            }
        } else {
            Log::error("No Post ID or Reel ID provided for comment.");
            return;
        }

        $comment = Comments::create([
            'post_id' => $this->post_id,
            'reel_id' => $this->reel_id,
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
                    'file_path' => 'storage/comments/' . $filename,
                ]);
            }
        } catch (\Exception $e) {
            Log::error("Failed to upload attachments for comment ID " . $comment->id . ": " . $e->getMessage());
        }
    }
}
