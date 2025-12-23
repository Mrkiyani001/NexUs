<?php

namespace App\Jobs;

use App\Models\Post;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class UpdatePost implements ShouldQueue
{
    use Queueable,Dispatchable,SerializesModels,InteractsWithQueue;
public $user_id;
public $post_id;
public $title;
public $body;
public $remove_attachments;
public $attachments;    
    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $post_id, $title, $body, $remove_attachments = null, $attachments = [])
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
    public function handle(): void
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
        $post->update([
            'title'=>$this->title,
            'body'=>$this->body,
            'updated_by'=>$this->user_id,
        ]);
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
                'file_path'=>'posts/'.$file,
            ]);
        }
    }catch(\Exception $e){
       Log::error('Failed to upload attachments TO post');
    }
        $post->refresh()->load('attachments','creator','updator','user');
}
}
