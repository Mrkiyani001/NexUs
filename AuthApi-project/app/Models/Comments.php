<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Comments extends Model
{
    protected $table = "comments";
    protected $fillable = [
        'post_id',
        'reel_id',
        'user_id',
        'comment',
        'created_by',
        'updated_by',
        'score',
    ];
    public function post()
    {
        return $this->belongsTo(Post::class, 'post_id');
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
    public function reel()
    {
        return $this->belongsTo(Reel::class, 'reel_id');
    }
    public function reactions()
    {
        return $this->morphMany(Reaction::class, 'reactionable');
    }
    public function replies()
    {
        return $this->hasMany(CommentReply::class, 'comment_id');
    }
}
