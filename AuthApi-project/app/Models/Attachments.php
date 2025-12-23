<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attachments extends Model
{
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
