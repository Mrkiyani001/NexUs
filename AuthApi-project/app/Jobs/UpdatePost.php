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

class UpdatePost implements ShouldQueue
{
    use Queueable,Dispatchable,SerializesModels,InteractsWithQueue;
public $user_id;
public $post_id;
public $title;
public $body;
public $remove_attachments;
public $attachments;    
public $is_approved;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $post_id, $title, $body, $remove_attachments = null, $attachments = [], $is_approved = false)
    {
        $this->user_id = $user_id;
        $this->post_id = $post_id;
        $this->title = $title;
        $this->body = $body;
        $this->remove_attachments = $remove_attachments;
        $this->attachments = $attachments;
    }

    /**
     * Execute the job.
     */
    public function handle(ModerationService $moderationService): void
    {
        $post = Post::with('attachments')->find($this->post_id);
        if(!$post){
            Log::error('Post not found: ' . $this->post_id);
            return;
        }
        try{
        if(!empty($this->remove_attachments)){
            foreach($this->remove_attachments as $attachmentId){
                $attachment = $post->attachments()->find($attachmentId);
                if($attachment){
                    $filePath = public_path($attachment->file_path);
                    if(file_exists($filePath)){
                        unlink($filePath);
                    }
                    $attachment->delete();
                }
            }
        }
        if ($this->is_approved) {
            $post->update([
                'title' => $this->title,
                'body' => $this->body,
                'updated_by' => $this->user_id,
                'status' => 1, // Approved
            ]);
        } else {
            // Not Admin: Set to Pending (0) and Run Moderation
            $post->update([
                'title' => $this->title,
                'body' => $this->body,
                'updated_by' => $this->user_id,
                'status' => 0, // Pending
            ]);

            try {
                $moderationService->moderate($post, $this->body);
                // Auto-Approve if Clean
                $post->refresh();
                if ($post->is_flagged == 0) {
                    $post->update(['status' => 1]);
                }
            } catch (\Exception $e) {
                Log::error("Moderation Failed for Post Update ID {$post->id}: " . $e->getMessage());
            }
        }
    }catch(\Exception $e){
        Log::error('Failed to delete attachments FROM post');
    }
    try{
        foreach($this->attachments as $file){
            $extension =strtolower(pathinfo($file,PATHINFO_EXTENSION));
            $type = match(true){
                in_array($extension,['jpg','jpeg','png','gif']) => 'image',
                in_array($extension,['mp4','avi','mov']) => 'video',
                $extension === 'pdf' => 'pdf',
                in_array($extension,['doc','docx']) => 'word',
                in_array($extension,['zip','rar','7z']) => 'zip',
                default => 'other',
            };
            $post->attachments()->create([
                'file_name'=>$file,
                'file_type'=>$type,
                'file_path'=>'storage/posts/'.$file,
            ]);
        }
    }catch(\Exception $e){
       Log::error('Failed to upload attachments TO post');
    }
        $post->refresh()->load('attachments', 'creator', 'updator', 'user');

        // Dispatch Notification to Admins
        try {
            $admins = User::role(['admin', 'super admin', 'moderator'])->get();
            $user = User::find($this->user_id);
            foreach ($admins as $admin) {
                // Don't notify the updater if they are an admin
                if ($admin->id !== $this->user_id) {
                    SendNotification::dispatch(
                        $admin->id,
                        'Post Updated',
                        "User " . ($user ? $user->name : 'Unknown') . " updated a post.",
                        $post->id,
                        $user,
                        'Y'
                    );
                }
            }
        } catch (\Exception $e) {
            Log::error("Failed to notify admins on update: " . $e->getMessage());
        }
    }
}
