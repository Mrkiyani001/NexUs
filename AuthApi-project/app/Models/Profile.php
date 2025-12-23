<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Profile extends Model
{
    protected $table = 'profile';
    protected $fillable = [
        'user_id',
        'bio',
        'phone',
        'address',
        'city',
        'state',
        'country',
        'zip_code',
        'avatar', // We can keep this for backward compatibility or remove if fully switching. User didn't ask to remove column.
    ];

    public function avatar()
    {
        return $this->morphOne(Attachments::class, 'attachable');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
    public function creator()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
    public function updator()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
