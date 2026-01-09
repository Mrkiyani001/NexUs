<?php

namespace App\Jobs;

use App\Models\Message;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Log;
use App\Events\MessagesEvent;
use Exception;
use Illuminate\Support\Facades\DB;

class AddMessage implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;
public $Conversation_Id;
public $sender_Id;
public $receiver_Id;
public $message;
public $attachments;
public $created_by;
public $updated_by;
    /**
     * Create a new job instance.
     */
    public function __construct($Conversation_Id, $sender_Id, $receiver_Id, $message = null, $attachments = null, $created_by, $updated_by)
    {
        $this->Conversation_Id = $Conversation_Id;
        $this->sender_Id = $sender_Id;
        $this->receiver_Id = $receiver_Id;
        $this->message = $message;
        $this->attachments = $attachments;
        $this->created_by = $created_by;
        $this->updated_by = $updated_by;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try{
        Log::info('AddMessage job started');
        DB::beginTransaction();
        $Message = Message::create([
            'conversation_id' => $this->Conversation_Id,
            'sender_id' => $this->sender_Id,
            'receiver_id' => $this->receiver_Id,
            'message' => $this->message,
            'created_by' => $this->created_by,
            'updated_by' => $this->updated_by,
        ]);
        if(!empty($this->attachments)){
            foreach($this->attachments as $attachment){
                $extension = pathinfo($attachment, PATHINFO_EXTENSION);
                $type = $this->getFileType($extension);
                $Message->attachments()->create([
                    'file_name' => $attachment,
                    'file_path' => 'storage/Messages/' . $attachment,
                    'file_type' => $type,
                ]);
            }
        }
        Log::info('AddMessage job completed');
        $Message->load('sender','receiver','attachments');
        DB::commit();
        MessagesEvent::dispatch($Message);
    }catch(Exception $e){
        DB::rollBack();
        Log::error('AddMessage job failed: ' . $e->getMessage());
        throw $e;
    }
    }
    private function getFileType($extension)
    {
       $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'];
       $documentExtensions = [
        'pdf', 
        'doc', 'docx',       // Word
        'xls', 'xlsx', 'csv', // Excel
        'ppt', 'pptx',       // PowerPoint
        'txt', 'rtf', 'json' // Text/Data
    ];
    $videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', '3gp'];
    $audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'amr'];
    $archiveExtensions = ['zip', 'rar', '7z'];
        if (in_array($extension, $imageExtensions)) {
            return 'image';
        } elseif (in_array($extension, $documentExtensions)) {
            return 'document';
        } elseif (in_array($extension, $videoExtensions)) {
            return 'video';
        } elseif (in_array($extension, $audioExtensions)) {
            return 'audio';
        } elseif(in_array($extension, $archiveExtensions)){
            return 'archive';
        }else{
            return 'other';
        }
    }
}

