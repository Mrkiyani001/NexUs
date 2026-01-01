<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Reel extends Model
{
    use HasFactory;
    protected $table = 'reels';

    protected $fillable = [
        'user_id',
        'caption',
        'video_path',
        'thumbnail_path',
        'file_name',
        'file_type',
        'duration',
        'views',
        'privacy',
        'created_by',
        'updated_by',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
    public function comments()
    {
        return $this->hasMany(Comments::class, 'reel_id');
    }

    public function reactions()
    {
        return $this->morphMany(Reaction::class, 'reactionable');
    }
    public function savedByUsers()
    {
        return $this->belongsToMany(User::class, 'saved_reels', 'reel_id', 'user_id')->withTimestamps();
    }
    public function views()
    {
        return $this->hasMany(View::class);
    }
}
