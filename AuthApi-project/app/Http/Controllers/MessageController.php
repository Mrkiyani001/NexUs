<?php

namespace App\Http\Controllers;

use App\Events\DeleteMessageEvent;
use App\Events\UpdateMessageEvent;
use App\Http\Resources\ConversationResource;
use App\Http\Resources\UserResource;
use App\Jobs\AddMessage;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MessageController extends BaseController
{
    public function sendMessage(Request $request)
    {
        $allowedMimes = 'jpg,jpeg,png,gif,webp,bmp,svg,heic,heif,pdf,doc,docx,xls,xlsx,csv,ppt,pptx,txt,rtf,json,mp4,avi,mov,wmv,flv,mkv,webm,3gp,mp3,wav,aac,ogg,m4a,wma,amr,zip,rar,7z';
        $this->validateRequest($request, [
            'receiver_id' => 'integer|required|exists:users,id',
            'message' => 'string|nullable',
            'attachments' => 'array|nullable',
            'attachments.*' => 'file|mimes:' . $allowedMimes . ',max:102400',
            'attachment' => 'array|nullable',
            'attachment.*' => 'file|mimes:' . $allowedMimes . ',max:102400',
            // 'created_by' => 'integer|required|exists:users,id',
            // 'updated_by' => 'integer|required|exists:users,id',
        ]);
        try {
            Log::info('SendMessage Request:', [
                'all' => $request->all(),
                'has_file' => $request->hasFile('attachments'),
                'files' => $request->file('attachments')
            ]);
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $sender_Id = $user->id;
            $receiver_Id = $request->receiver_id;
            $exist = User::where('id', $receiver_Id)->exists();
            if (!$exist) {
                return $this->Response(false, 'Receiver not found', null, 404);
            }
            $Conversation = Conversation::where(function ($q) use ($sender_Id, $receiver_Id) {
                $q->where('sender_id', $sender_Id)->where('receiver_id', $receiver_Id);
            })->orWhere(function ($q) use ($sender_Id, $receiver_Id) {
                $q->where('sender_id', $receiver_Id)->where('receiver_id', $sender_Id);
            })->first();
            if (!$Conversation) {
                $Conversation = Conversation::create([
                    'sender_id' => $sender_Id,
                    'receiver_id' => $receiver_Id,
                    'created_by' => $sender_Id,
                    'updated_by' => $sender_Id,
                ]);
            }
            try {
                $attachments = [];
                $files = [];
                if ($request->hasFile('attachments')) {
                    $files = $request->file('attachments');
                } elseif ($request->hasFile('attachment')) {
                    $files = $request->file('attachment');
                }

                if (!empty($files)) {
                    foreach ($files as $file) {
                        $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                        $file->move(public_path('storage/Messages'), $filename);
                        $attachments[] = $filename;
                    }
                }
            } catch (Exception $e) {
                return $this->Response(false, $e->getMessage(), null, 500);
            }
            AddMessage::dispatch(
                $Conversation->id,
                $sender_Id,
                $receiver_Id,
                $request->message,
                $attachments,
                $user->id,
                $user->id
            );
            return $this->Response(true, 'Message sent successfully');
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function updateMessage(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'integer|required|exists:messages,id',
            'message' => 'string|required'
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $message = Message::find($request->id);
            if (!$message) {
                return $this->Response(false, 'Message not found', null, 404);
            }
            if ($message->created_by != $user->id) {
                return $this->NotAllowed();
            }
            $message->update([
                'message' => $request->message,
                'is_edited' => true,
                'updated_by' => $user->id
            ]);
            UpdateMessageEvent::dispatch($message);
            return $this->Response(true, 'Message updated successfully');
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function deleteMessage(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'integer|required|exists:messages,id',
            'delete_type' => 'required|in:me,everyone',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $message = Message::find($request->id);
            if (!$message) {
                return $this->Response(false, 'Message not found', null, 404);
            }
            if ($message->sender_id != $user->id && $message->receiver_id != $user->id) {
                return $this->NotAllowed();
            }
            if ($request->delete_type == 'me') {
                if ($message->sender_id == $user->id) {
                    $message->update([
                        'delete_from_sender' => true,
                        'updated_by' => $user->id
                    ]);
                } elseif ($message->receiver_id == $user->id) {
                    $message->update([
                        'delete_from_receiver' => true,
                        'updated_by' => $user->id
                    ]);
                }
                return $this->Response(true, 'Message deleted successfully');
            } elseif ($request->delete_type == 'everyone') {
                if ($message->sender_id != $user->id) {
                    return $this->NotAllowed();
                }
                $message->attachments()->delete();
                $message->update([
                    'updated_by' => $user->id
                ]);
                $message->delete();
                DeleteMessageEvent::dispatch($message);
                return $this->Response(true, 'Message deleted successfully');
            }
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function getMessages(Request $request)
    {
        $this->validateRequest($request, [
            'receiver_id' => 'integer|required|exists:users,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $sender_Id = $user->id;
            $receiver_Id = $request->receiver_id;
            $exist = User::where('id', $receiver_Id)->exists();
            if (!$exist) {
                return $this->Response(false, 'Receiver not found', null, 404);
            }
            $Messages = Message::withTrashed()
            ->where(function ($q) use ($sender_Id, $receiver_Id) {
                $q->where('sender_id', $sender_Id)
                ->where('receiver_id', $receiver_Id)
                ->where('delete_from_sender', false);
            })->orWhere(function ($q) use ($receiver_Id, $sender_Id) {
                $q->where('sender_id', $receiver_Id)
                ->where('receiver_id', $sender_Id)
                ->where('delete_from_receiver', false);
            })
            ->orderBy('created_at', 'asc')
            ->get();
            if (!$Messages) {
                return $this->Response(false, 'Conversation not found', null, 404);
            }
            $Messages->transform(function ($msg) {
                if($msg->deleted_at != null){
                    $msg->message = "This message was deleted";
                    $msg->attachments=[];
                    $msg->is_deleted_everyone = true;
                }
                return $msg;
            });
            return $this->Response(true, 'Conversation found', $Messages);
            } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function getConversation(Request $request)
    {
        try{
            $limit = (int)$request->limit ?? 50;
        $user = auth('api')->user();
        if (!$user) {
            return $this->unauthorized();
        }
        $Conversation = Conversation::where('sender_id', $user->id)
        ->orWhere('receiver_id', $user->id)
        ->orderBy('updated_at', 'desc')
        ->paginate($limit);
        if (!$Conversation) {
            return $this->Response(false, 'Conversation not found', null, 404);
        }
       return $this->Response(true, 'Conversation found', $this->PaginateData($Conversation , ConversationResource::collection($Conversation)));
       }catch(Exception $e){
        return $this->Response(false, $e->getMessage(), null, 500);
    }
}

public function searchUsers(Request $request)
{
    try{
        $limit = (int)$request->limit ?? 50;
    $user = auth('api')->user();
    if (!$user) {
        return $this->unauthorized();
    }
    $search = $request->search;
    $users = User::where(function ($q) use ($search){
        $q->where('name', 'like', '%' . $search . '%');
    })
    ->paginate($limit)
    ->orderBy('name', 'asc')
    ->get(['id','name','avatar']);
    
    if (!$users) {
        return $this->Response(false, 'Users not found', null, 404);
    }
   return $this->Response(true, 'Users found', $this->PaginateData($users , UserResource::collection($users)));
   }catch(Exception $e){
    return $this->Response(false, $e->getMessage(), null, 500);
}
}
}
