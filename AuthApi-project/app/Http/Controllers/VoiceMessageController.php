<?php

namespace App\Http\Controllers;

use App\Jobs\AddVoiceMessage;
use App\Models\BlockUser;
use App\Models\Conversation;
use App\Models\VoiceMessage;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

class VoiceMessageController extends BaseController
{
    public function sendVoiceMessage(Request $request)
    {
       $this->validateRequest($request, [
           'conversation_id' => 'nullable|exists:conversations,id',
           'receiver_id' => 'required|exists:users,id',
           'file' => 'required|file|mimetypes:audio/mpeg,audio/wav,audio/mp3,audio/ogg,audio/3gp,audio/3gpp,audio/3gpp2,audio/ppt,audio/webm,audio/mp4,audio/x-m4a,video/webm,video/mp4,video/ogg',
           'duration' => 'nullable|integer',
       ]);
    try{   
    $user = auth('api')->user();
    if(!$user){
        return $this->Unauthorized();
    }
    $sender_id = $user->id;
    $receiver_id = $request->receiver_id;
    $Conversation = Conversation::where(function ($q) use ($sender_id, $receiver_id) {
        $q->where('sender_id', $sender_id)->where('receiver_id', $receiver_id);
    })->orWhere(function ($q) use ($sender_id, $receiver_id) {
        $q->where('sender_id', $receiver_id)->where('receiver_id', $sender_id);
    })->first();
    if (!$Conversation) {
        $Conversation = Conversation::create([
            'sender_id' => $sender_id,
            'receiver_id' => $receiver_id,
            'created_by' => $sender_id,
            'updated_by' => $sender_id,
        ]);
    }

    $voicemsg = null;
    if($request->hasFile('file')){
        $voicemsg = $this->uploadFile($request->file('file'), 'voice_messages',$user,[
            'conversation_id' => $Conversation->id,
            'sender_id' => $sender_id,
            'receiver_id' => $receiver_id,
        ]);
    
    $key='send_voicemsg'.$user->id;
    if(!$user->hasRole(['super admin'])){
        if(RateLimiter::tooManyAttempts($key,5)){
            $seconds = RateLimiter::availableIn($key);
            return $this->response(false,'You have exceeded the limit. Please try again in '.$seconds.' seconds',null,429);
        }
        RateLimiter::hit($key,600);
    }
    AddVoiceMessage::dispatch(
        $user->id,
        $Conversation->id,
        $voicemsg,
        $request->duration,
        $sender_id,
        $receiver_id
    );
    return $this->Response(true, 'Voice message sent successfully', $voicemsg,200);
}else{
    return $this->Response(false, 'File is required', null, 422);
}
    }
catch(Exception $e){
    Log::error('Voice Message Error: ' . $e->getMessage());
    return $this->Response(false, $e->getMessage(), null, 500);
}
}
public function delvoiceMessage(Request $request){
    $this->validateRequest($request, [
        'id' => 'required|exists:voice_messages,id',
    ]);
    try{
        $user = auth('api')->user();
        if(!$user){
            return $this->Unauthorized();
        }
        
        $voicemsg = VoiceMessage::find($request->id);
        if(!$voicemsg){
            return $this->Response(false, 'Voice message not found', null, 404);
        }

        // Check ownership against the ACTUAL record, not the request input
        if($user->id != $voicemsg->sender_id){
             return $this->NotAllowed();
        }

        $voicemsg->delete();
        return $this->Response(true, 'Voice message deleted successfully', null, 200);
    }
    catch(Exception $e){
        Log::error('Voice Message Error: ' . $e->getMessage());
        return $this->Response(false, $e->getMessage(), null, 500);
    }
}
public function getVoiceMessages(Request $request){
    $this->validateRequest($request, [
        'conversation_id' => 'required|exists:conversations,id',
        'receiver_id' => 'required|exists:users,id',
    ]);
    try{
        $user = auth('api')->user();
        if(!$user){
            return $this->Unauthorized();
        }
        $sender_id = $user->id;
        $receiver_id = $request->receiver_id;
        $Conversation = Conversation::where(function ($q) use ($sender_id, $receiver_id) {
            $q->where('sender_id', $sender_id)->where('receiver_id', $receiver_id);
        })->orWhere(function ($q) use ($sender_id, $receiver_id) {
            $q->where('sender_id', $receiver_id)->where('receiver_id', $sender_id);
        })->first();
        if (!$Conversation) {
            return $this->Response(false, 'Conversation not found', null, 404);
        }
        $voicemsg = VoiceMessage::where('conversation_id', $request->conversation_id)->get();
        return $this->Response(true, 'Voice message sent successfully', $voicemsg,200);
    }
    catch(Exception $e){
        Log::error('Voice Message Error: ' . $e->getMessage());
        return $this->Response(false, $e->getMessage(), null, 500);
    }
}
}

