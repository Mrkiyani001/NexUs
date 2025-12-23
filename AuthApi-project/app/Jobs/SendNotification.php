<?php

namespace App\Jobs;

use App\Models\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendNotification implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;
    protected $CreatorId;
    protected $title;
    protected $text;
    protected ?int $user_id;
    protected $notifiable;
    protected $for_admin;
    public function __construct($CreatorId,$title,$text,$user_id = null,$notifiable = null,$for_admin)
    {
       $this->CreatorId = $CreatorId;
       $this->title = $title;
       $this->text = $text;
       $this->user_id = $user_id;
       $this->notifiable = $notifiable;
       $this->for_admin = $for_admin;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try{
        $notification = new Notification();
        $notification->title = $this->title;
        $notification->text = $this->text;
        if($this->notifiable){
            $notification->notifiable()->associate($this->notifiable);
        }
        $notification->user_id = $this->user_id;
        $notification->for_admin = $this->for_admin;
        $notification->created_by = $this->CreatorId;
        $notification->updated_by = $this->CreatorId;
        $notification->save();
    }catch(\Exception $e){
        Log::error('Failed to send notification: ' . $e->getMessage(),[
            'trace'=>$e->getTraceAsString()
        ]);
    }
    }
}
