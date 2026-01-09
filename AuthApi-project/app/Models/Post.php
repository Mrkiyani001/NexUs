<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Hootlex\Moderation\Moderatable;

class Post extends Model
{
    use Moderatable;
    protected $table = "post";
    protected $fillable = [
        'user_id',
        'title',
        'body',
        'created_by',
        'updated_by',
        'score',
        'is_flagged',// 1 yes or 0 no
        'status',
        'moderated_at',
        'moderated_by',
        'original_post_id',
    ];

    protected $casts = [
        'moderated_at' => 'datetime',
    ];


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
    public function comments()
    {
        return $this->hasMany(Comments::class, 'post_id');
    }
    public function reactions()
    {
        return $this->morphMany(Reaction::class, 'reactionable');
    }
    public function replies()
    {
        return $this->hasManyThrough(CommentReply::class, Comments::class, 'post_id', 'comment_id');
    }
    public function flaggable()
    {
        return $this->morphMany(FlagAi::class, 'flaggable');
    }
    public function notification()
    {
        return $this->morphMany(Notification::class, 'notifiable');
    }
    public function shares()
    {
        return $this->hasMany(Share::class);
    }
    public function originalPost()
    {
        return $this->belongsTo(Post::class, 'original_post_id');
    }
    public function views()
    {
        return $this->hasMany(View::class);
    }
}
