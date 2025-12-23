<?php

namespace App\Models;

use Dom\Comment;
use Tymon\JWTAuth\Contracts\JWTSubject;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable, HasRoles;

    protected $guard_name = 'api';


    protected $fillable = [
        'name',
        'email',
        'password',
        'show_email'
    ];


    protected $hidden = [
        'password',
        'remember_token',
    ];


    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'show_email' => 'boolean',
        ];
    }
     public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims()
    {
        return [];
    }
    public function posts()
    {
        return $this->hasMany(Post::class);
    }
    public function followers()
    {
        return $this->belongsToMany(User::class,'followers','following_id','follower_id');
    }
    public function following()
    {
        return $this->belongsToMany(User::class,'followers','follower_id','following_id');
    }
    public function profile()
    {
        return $this->hasOne(Profile::class);
    }
    public function follow($user)
    {
        return $this->following()->attach($user);
    }
    public function unfollow($user)
    {
        return $this->following()->detach($user);
    }
}
