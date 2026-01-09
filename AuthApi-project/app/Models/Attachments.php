<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Attachments extends Model
{
    use SoftDeletes;
    protected $table = "attachments";
    protected $fillable = [
        'file_path',
        'file_name',
        'file_type',
    ];
    public function attachable()
    {
        return $this->morphTo();
    }
}
