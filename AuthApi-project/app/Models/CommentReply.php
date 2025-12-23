<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommentReply extends Model
{
    protected $table = "comments_replies";
    protected $fillable = [
        'comment_id',
        'user_id',
        'reply',
        'created_by',
        'updated_by',
        'score',
    ];
public function comment()
    {
        return $this->belongsTo(Comments::class, 'comment_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    
}
public function updator()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

public function attachments()
    {
        return $this->morphMany(Attachments::class, 'attachable');
    }
    public function reactions()
    {
        return $this->morphMany(Reaction::class, 'reactionable');
    }
}
