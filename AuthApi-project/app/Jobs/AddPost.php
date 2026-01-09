<?php

namespace App\Jobs;

use App\Models\Post;
use App\Models\User;
use App\Jobs\SendNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

use App\Services\ModerationService;

class AddPost implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;
    public $user_id;
    public $title;
    public $body;
    public $attachments;
    public $is_approved;
    public $original_post_id;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $title, $body, $attachments = [], $is_approved = false, $original_post_id = null)
    {
        $this->user_id = $user_id;
        $this->title = $title;
        $this->body = $body;
        $this->attachments = $attachments;
        $this->is_approved = $is_approved;
        $this->original_post_id = $original_post_id;
    }

    /**
     * Execute the job.
     */
    public function handle(ModerationService $moderationService): void
    {
        Log::info("AddPost Job Started for User ID: {$this->user_id}");

        $postData = [
            'user_id' => $this->user_id,
            'title' => $this->title,
            'body' => $this->body,
            'created_by' => $this->user_id,
            'updated_by' => $this->user_id,
            'original_post_id' => $this->original_post_id,
        ];

        if ($this->is_approved) {
            $postData['status'] = 1; // Approved
            // $postData['is_published'] = 1; // Uncomment if column exists
        }

        try {
            $post = Post::create($postData);
            Log::info("Post Created in DB with ID: {$post->id}");
        } catch (\Exception $e) {
            Log::error("Failed to create post in DB: " . $e->getMessage());
            return; // Exit if post creation fails
        }

        // Run Moderation Logic only if NOT approved
        if (!$this->is_approved) {
            try {
                Log::info("Running Moderation for Post ID: {$post->id}");
                $moderationService->moderate($post, $this->body);

                $post->refresh();
                Log::info("Moderation Complete. Flagged Status: " . ($post->is_flagged ? 'Yes' : 'No'));

                if ($post->is_flagged == 0) {
                    $post->update(['status' => 1]);
                    Log::info("Post ID {$post->id} marked as Active (Status 1).");

                    SendNotification::dispatch(
                        $this->user_id,
                        'Post Created',
                        'Your post has been successfully created.',
                        $this->user_id,
                        $post,
                        'N'
                    );
                } else {
                    // Post is Flagged -> Notify Admins AND User
                    Log::info("Post ID {$post->id} is Flagged. Notifying Admins.");

                    // Notify User
                    SendNotification::dispatch(
                        $this->user_id,
                        'Post Under Moderation',
                        'Your post contains sensitive content and is under moderation.',
                        $this->user_id,
                        $post,
                        'N'
                    );

                    // Notify Admins
                    try {
                        $creator = User::find($this->user_id);
                        $creatorName = $creator ? $creator->name : 'Unknown User';

                        $admins = User::role(['admin', 'super admin', 'moderator'])->get();
                        foreach ($admins as $admin) {
                            if ($admin->id !== $this->user_id) {
                                SendNotification::dispatch(
                                    $admin->id,
                                    'Flagged Post Alert',
                                    "User {$creatorName} posted content flagged by auto-moderation.",
                                    $admin->id,
                                    $post,
                                    'Y'
                                );
                            }
                        }
                    } catch (\Exception $e) {
                        Log::error("Failed to notify admins of flagged post: " . $e->getMessage());
                    }
                }
            } catch (\Exception $e) {
                Log::error("Moderation Logic Failed for Post ID {$post->id}: " . $e->getMessage());
            }
        } else {
            // If manually approved (e.g. by admin posting), just notify user/followers if needed
            // For now, just log
            Log::info("Post ID {$post->id} auto-approved (Admin/Moderator).");
        }

        if (!empty($this->attachments)) {
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
                    $post->attachments()->create([
                        'file_name' => $filename,
                        'file_type' => $type,
                        'file_path' => 'storage/posts/' . $filename,
                    ]);
                }
                Log::info("Attachments uploaded for Post ID {$post->id}");
            } catch (\Exception $e) {
                Log::error("Failed to upload attachments for post ID " . $post->id . ": " . $e->getMessage());
            }
        }

        Log::info("AddPost Job Finished for Post ID: {$post->id}");
    }
}
