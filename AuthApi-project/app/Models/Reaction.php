<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Reaction extends Model
{
    protected $table = 'reactions';
    protected $fillable = [
        'reactionable_id',
        'reactionable_type',
        'type',
        'created_by',
        'updated_by',
    ];
    public function reactionable()
    {
        return $this->morphTo();
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
