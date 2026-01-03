<?php

namespace App\Models;

use Dom\Comment;
use Tymon\JWTAuth\Contracts\JWTSubject;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements JWTSubject, MustVerifyEmail
{
    use HasFactory, Notifiable, HasRoles;

    protected $guard_name = 'api';


    protected $fillable = [
        'name',
        'email',
        'password',
        'show_email',
        'is_private',
        'allow_friend_request',
        'email_login_alerts',
        'push_login_alerts',
        'suspicious_activity_alerts',
        'status'
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
            'is_private' => 'boolean',
            'allow_friend_request' => 'boolean',
            'email_login_alerts' => 'boolean',
            'push_login_alerts' => 'boolean',
            'suspicious_activity_alerts' => 'boolean',
        ];
    }

    protected $appends = ['avatar_url'];

    public function getAvatarUrlAttribute()
    {
        $profile = $this->profile;
        if (!$profile) return null;

        // 1. Try Attachment Relation (if loaded or exists)
        if ($profile->avatar) {
            return $profile->avatar->file_path;
        }

        // 2. Fallback to Column
        return $profile->getAttributes()['avatar'] ?? null;
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
        return $this->belongsToMany(User::class, 'followers', 'following_id', 'follower_id')->withPivot('status')->withTimestamps();
    }
    public function following()
    {
        return $this->belongsToMany(User::class, 'followers', 'follower_id', 'following_id')->withPivot('status')->withTimestamps();
    }
    public function profile()
    {
        return $this->hasOne(Profile::class);
    }
    public function follow($user, $options = [])
    {
        return $this->following()->attach($user, $options);
    }
    public function unfollow($user)
    {
        return $this->following()->detach($user);
    }
    public function shares()
    {
        return $this->hasMany(Share::class);
    }

    public function reels()
    {
        return $this->hasMany(Reel::class);
    }

    /**
     * Check the follow status towards another user.
     * Returns: 'none', 'pending', 'accepted', 'rejected'
     */
    public function getFollowStatus($targetUserId)
    {
        if ($this->id == $targetUserId) {
            return 'none';
        }

        $pivot = $this->following()->where('following_id', $targetUserId)->first();

        if ($pivot && $pivot->pivot) {
            return $pivot->pivot->status;
        }

        return 'none';
    }

    public function savedReels()
    {
        return $this->belongsToMany(Reel::class, 'saved_reels', 'user_id', 'reel_id')->withTimestamps();
    }
}
