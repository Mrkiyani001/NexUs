<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class View extends Model
{
    protected $table = 'view';
    protected $fillable = [
        'post_id',
        'created_by',
        'updated_by',
    ];
    public function post()
    {
        return $this->belongsTo(Post::class);
    }
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
    public function updator()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
