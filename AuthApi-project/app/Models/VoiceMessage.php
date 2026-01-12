<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class VoiceMessage extends Model
{
    protected $table = 'voice_messages';
    use SoftDeletes;
    protected $fillable = [
        'conversation_id',
        'sender_id',
        'receiver_id',
        'file_name',
        'file_path',
        'file_size',
        'file_type',
        'file_duration',
        'status',
        'read_at',
    ];
    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }
    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
    public function receiver()
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }
    public function files()
    {
        return $this->hasMany(VoiceMessage::class, 'sender_id');
    }
}
