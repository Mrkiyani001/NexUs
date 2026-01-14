<?php

namespace App\Jobs;

use FFMpeg\FFMpeg;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class AddReel implements ShouldQueue
{
    use Queueable, Dispatchable, InteractsWithQueue, SerializesModels;

    public $user_id;
    public $caption;
    public $reel;
    public $thumbnail;
    public $privacy;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $caption, $reel, $thumbnail, $privacy)
    {
        $this->user_id = $user_id;
        $this->caption = $caption;
        $this->reel = $reel;
        $this->thumbnail = $thumbnail;
        $this->privacy = $privacy;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info("AddReel Job Started for User ID: {$this->user_id}");
        $Db_reel_path = $this->reel->video_path;
        Log::info("DB Path: {$Db_reel_path}");
        $relative_path = str_replace('storage/','', $Db_reel_path);
        Log::info("Relative Path: {$relative_path}");
        $Original_reel_path = storage_path('app/public/' . $relative_path);
        Log::info("Original Path: {$Original_reel_path}");
        if(!file_exists($Original_reel_path)){
            Log::error("Original Reel not found at path: {$Original_reel_path}");
            return;
        }
        Log::info("Original Reel found at path: {$Original_reel_path}");
        Log::info("FFMpeg::create() started");
        $ffmpeg = FFMpeg::create();
        $video = $ffmpeg->open($Original_reel_path);
        $duration = (int) $video->getFormat()->get('duration');
        $this->reel->duration = $duration;
        $this->reel->update([
            'duration' => $duration,
        ]);
        Log::info("AddReel Job Completed for User ID: {$this->user_id}");
    }
}
