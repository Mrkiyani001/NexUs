<?php

namespace App\Jobs;

use App\Models\Post;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class DeletePost implements ShouldQueue
{
    use Queueable,Dispatchable,SerializesModels,InteractsWithQueue;
public $user_id;
public $post_id;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id,$post_id)
    {
        $this->user_id = $user_id;
        $this->post_id = $post_id;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $post =Post::with('attachments')->find($this->post_id);
        if(!$post){
            \Log::error('Post not found');
            return;
        }
        try{
            foreach($post->attachments as $attachment){
                $filePath = public_path($attachment->file_path);
                if(file_exists($filePath)){
                    unlink($filePath);
                }
                $attachment->delete();
            }
        }catch(\Exception $e){
            \Log::error('Failed to delete attachments FROM post');
        }
        $post->delete();
    }
}
