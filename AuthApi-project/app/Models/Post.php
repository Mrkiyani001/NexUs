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
    ];



    const Post_Is_Submitted  = 1;
    const Post_Under_Moderation = 2;
    const Post_Is_Rejected = 3;
    const Post_Is_Approved = 4;

    protected $casts = [
        'moderated_at' => 'datetime',
    ];

    protected function serializeDate(\DateTimeInterface $date)
    {
        return $date->format('Y-m-d H:i:s');
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
    public function comments()
    {
        return $this->hasMany(Comments::class, 'post_id');
    }
    public function reactions()
    {
        return $this->morphMany(Reaction::class, 'reactionable');
    }
    public function flaggable()
    {
        return $this->morphMany(FlagAi::class, 'flaggable');
    }
    public function notification()
    {
        return $this->morphMany(Notification::class, 'notifiable');
    }
}
