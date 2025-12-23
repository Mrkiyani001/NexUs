<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FlagAi extends Model
{
 protected $table = 'flagai';
 protected $fillable = [
    'flag_type',
    'flag_field',
    'flag_reason',
    'created_by',
    'updated_by',
];
public function creator()
{
    return $this->belongsTo(User::class, 'created_by');
}
public function updator()
{
    return $this->belongsTo(User::class, 'updated_by');
}
public function flaggable()
{
    return $this->morphTo();
}
}
