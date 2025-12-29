<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Share extends Model
{
    protected $table = 'shares';
    protected $fillable = [
        'user_id',
        'post_id',
        'reel_id',
    ];
    public function user()
    {
        return $this->belongsTo(User::class);
    }
    public function post()
    {
        return $this->belongsTo(Post::class);
    }
    public function reel()
    {
        return $this->belongsTo(Reel::class);
    }

}
