<?php

namespace App\Jobs;

use App\Models\Reel;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DeleteReel implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;
    public $user_id;
    public $reel_id;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $reel_id)
    {
        $this->user_id = $user_id;
        $this->reel_id = $reel_id;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
      Log::info('Start Delete reel job for ID: ' . $this->reel_id);
      $reel = Reel::find($this->reel_id);
      if(!$reel){
        Log::error('Reel not found: ' . $this->reel_id);
        return;
      }
      try{
        if($reel->video_path){
            $path = str_replace('storage/', '', $reel->video_path);
            if($path && Storage::disk('public')->exists($path)){
               Storage::disk('public')->delete($path);
            }
        }
        if($reel->thumbnail_path){
            $path = str_replace('storage/', '', $reel->thumbnail_path);
            if($path && Storage::disk('public')->exists($path)){
               Storage::disk('public')->delete($path);
            }
        }
        
        $reel->savedByUsers()->detach();
        $reel->comments()->delete();
        $reel->reactions()->delete();
        $reel->delete();
        
        Log::info('Reel deleted successfully: ' . $this->reel_id);
      }catch(\Exception $e){
        Log::error('Failed to delete reel: ' . $e->getMessage());
      }
    }
}
