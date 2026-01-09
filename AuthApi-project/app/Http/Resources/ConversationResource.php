<?php

namespace App\Http\Resources;

use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {

        $user = auth('api')->user();

        $friend = ($this->sender_id == $user->id) ? $this->receiver : $this->sender;

        $lastmessage = Message::withTrashed()->where('conversation_id', $this->id)->latest()->first();

        $unreadmessage = Message::where('conversation_id', $this->id)
            ->where('receiver_id', $user->id)
            ->where('status', '!=', 'read')
            ->where('delete_from_receiver', false)
            ->count();

        $messageContent = 'No message Yet';
        if ($lastmessage) {
            if ($lastmessage->deleted_at) {
                $messageContent = 'This message was deleted';
            } else {
                $messageContent = $lastmessage->message;
            }
        }

        return [
            'id' => $this->id,
            'friend_id' => $friend->id,
            'friend_name' => $friend->name ?? 'Unknown',
            'friend_avatar' => $friend->avatar ?? null,
            'last_message' => $messageContent,
            'last_message_time' => $lastmessage ? $lastmessage->created_at->diffForHumans() : '',
            'unread_message' => $unreadmessage,
        ];
    }
}
