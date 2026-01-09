<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DeleteMessageEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;
public $message;
    /**
     * Create a new event instance.
     */
    public function __construct( Message $message)
    {
        $this->message = $message->load(['sender','receiver']);
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('chat.'.$this->message->sender_id),
            new PrivateChannel('chat.'.$this->message->receiver_id),
        ];
    }
    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'body' => $this->message->message,
            'conversation_id' => $this->message->conversation_id,
            'is_deleted' => true
        ];
    }
}
