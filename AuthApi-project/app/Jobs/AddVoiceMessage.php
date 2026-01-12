<?php

namespace App\Jobs;

use App\Events\VoiceMsgEvent;
use App\Models\VoiceMessage;
use FFMpeg\FFMpeg;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class AddVoiceMessage implements ShouldQueue
{
    use Queueable, Dispatchable, InteractsWithQueue, SerializesModels;
    public $user_id;
    public $conversation_id;
    public $file;
    public $duration;
    public $sender_id;
    public $receiver_id;
    /**
     * Create a new job instance.
     */
    public function __construct($user_id, $conversation_id, $file, $duration = null, $sender_id, $receiver_id)
    {
        $this->user_id = $user_id;
        $this->conversation_id = $conversation_id;
        $this->file = $file;
        $this->duration = $duration;
        $this->sender_id = $sender_id;
        $this->receiver_id = $receiver_id;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info('AddVoiceMessage Job started');
        $Db_voice_message_path = $this->file->file_path;
        $Original_voice_message_path = storage_path('app/public/' . $Db_voice_message_path);
        if (!file_exists($Original_voice_message_path)) {
            Log::error("Original Voice Message not found at path: {$Original_voice_message_path}");
            return;
        }
        Log::info("Original Voice Message found at path: {$Original_voice_message_path}");
        Log::info("FFMpeg::create() started");
        $ffmpeg = FFMpeg::create();
        $voice = $ffmpeg->open($Original_voice_message_path);
        $duration = (int) $voice->getFormat()->get('duration');
        $this->file->duration = $duration;
        $this->file->update([
            'duration' => $duration,
        ]);
        VoiceMsgEvent::dispatch($this->file);
        Log::info("AddVoiceMessage Job Completed for User ID: {$this->user_id}");
        Log::info("Sending Notification");
        $this->file->load('sender'); // Ensure sender is loaded
        SendNotification::dispatch(
            $this->user_id,           // CreatorId
            $this->file->sender->name,                   // Title (Sender Name)
            'Sent an Voice Message', // Text
            $this->receiver_id,         // User ID (Recipient)
            [
                'type' => $this->file->getMorphClass(),
                'id' => $this->file->id,
            ],                          // Notifiable (Array for Safety)
            false                       // For Admin
        );
    }
}
