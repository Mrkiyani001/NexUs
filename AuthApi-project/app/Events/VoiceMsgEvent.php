<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VoiceMsgEvent implements ShouldBroadcast
{
use Dispatchable, InteractsWithSockets, SerializesModels;
public $file;
    /**
     * Create a new event instance.
     */
    public function __construct($file)
    {
        $this->file= $file->load('sender','receiver');
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array  // YA IS LYA USE HOTA HA KIS KIS KA LYA EVENT CHLA
    {
        return [
            new PrivateChannel('chat.' . $this->file->receiver_id),
            new PrivateChannel('chat.' . $this->file->sender_id),
        ];
    }

    public function broadcastWith(): array  // YA IS LYA USE HOTA KA SAT KI LA KR JANA HA
    {
        return [
            'file' => $this->file
        ];
    }
}
