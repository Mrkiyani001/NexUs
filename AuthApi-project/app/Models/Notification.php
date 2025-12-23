<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    // use SoftDeletes; // Removed to match DB

    protected $table = 'notifications';

    protected $fillable = [
        'user_id',
        'for_admin',
        'title',
        'text',
        'notifiable_id',
        'notifiable_type',
        'read_status',
        'created_by',
        'updated_by',
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
    // Creating polymorphic relation
    public function notifiable()
    {
        return $this->morphTo();
    }
}
