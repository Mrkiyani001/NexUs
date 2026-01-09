<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Message extends Model
{
    use SoftDeletes;
    protected $table = 'messages';
    protected $fillable = [
        'conversation_id',
        'sender_id',
        'receiver_id',
        'message',
        'status',
        'is_sensitive',
        'is_edited',
        'delete_from_sender',
        'delete_from_receiver',
        'created_by',
        'updated_by',
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
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
    public function updator()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
    public function reaction()
    {
        return $this->morphMany(Reaction::class, 'reactable');
    }
    public function attachments()
    {
        return $this->morphMany(Attachments::class, 'attachable');
    }
}
