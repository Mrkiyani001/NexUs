<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Models\User;
use Exception;
use Illuminate\Http\Request;
use App\Models\Attachments; // Add this import
use App\Jobs\SendNotification;

class ProfileController extends BaseController
{

    public function viewProfile(Request $request)
    {
        try {
            $userId = $request->id ?? auth('api')->id();
            if (!$userId) {
                return $this->unauthorized();
            }

            // Connection Status Logic Here Use function CheckfollowStatus from uSER MODEL
            $loggedInUser = auth('api')->user();

            $user = User::with([
                'profile.avatar',
                'followers' => function ($q) {
                    $q->wherePivot('status', 'accepted')->with('profile.avatar');
                }, 
                'following' => function ($q) {
                    $q->wherePivot('status', 'accepted')->with('profile.avatar');
                }
            ])
                ->withCount([
                    'followers' => function ($q) {
                        $q->where('followers.status', 'accepted');
                    },
                    'following' => function ($q) {
                        $q->where('followers.status', 'accepted');
                    }
                ])
                ->find($userId);

            if (!$user) {
                return $this->Response(false, 'User not found', null, 404);
            }
            if($user->status == 'Deactivated') {
                return $this->Response(false, 'User is deactivated', null, 404);
            }
            if ($user->is_banned == 1) {
                return $this->Response(false, 'User is banned', null, 401);
            }
            // Email Visibility Logic
            if ($loggedInUser && $userId !== $loggedInUser->id && $user->show_email == false) {
                $user->makeHidden(['email']);
            }
             $user->makeHidden(['password','remember_token','email_verified_at','created_at','updated_at']);
             
            $connection_status = $loggedInUser ? $loggedInUser->getFollowStatus($user->id) : 'none';
            $is_me = $loggedInUser && $loggedInUser->id === $user->id;
            $is_friend = $connection_status === 'accepted';
            $is_admin = $loggedInUser && $loggedInUser->hasRole(['super admin']);
            // Privacy Logic
            if ($user->is_private && !$is_me && !$is_friend && !$is_admin) {
                 $user->setRelation('followers', collect());
                 $user->setRelation('following', collect());
                 $user->makeHidden(['email', 'phone', 'address', 'city', 'state', 'country', 'zip_code']);
                 if($user->profile){
                    $user->profile->makeHidden(['phone', 'address', 'city', 'state', 'country', 'zip_code']);
                 }
                 // Only show basic info + counts
            }

            return $this->Response(true, 'Profile retrieved successfully', $user, 200);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    public function updateProfile(Request $request)
    {
        $this->validateRequest($request, [
            'name' => 'string|max:255',
            'email' => 'email|max:255|unique:users,email,' . auth('api')->id(),
            'show_email' => 'boolean',
            'is_private' => 'boolean',
            'allow_friend_request' => 'boolean',
            'email_login_alerts' => 'boolean',
            'push_login_alerts' => 'boolean',
            'suspicious_activity_alerts' => 'boolean',
            'bio' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:255',
            'zip_code' => 'nullable|string|max:20',
            'avatar' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
            'remove_avatar' => 'nullable|integer|exists:attachments,id',
        ]);
        try {
            // ALWAYS get the logged-in user object first
            $user = auth('api')->user();

            if (!$user) {
                return $this->unauthorized();
            }
            // If ID is provided, verify it matches the logged-in user
            if ($request->has('id') && $request->id != $user->id) {
                return $this->NotAllowed();
            }
            if ($request->filled('name')) {
                $user->name = $request->name;
            }
            if ($request->filled('email')) {
                $user->email = $request->email;
            }
            if ($request->has('show_email')) {
                $user->show_email = $request->boolean('show_email');
            }
            if ($request->has('is_private')) {
                $user->is_private = $request->boolean('is_private');
            }
            if ($request->has('allow_friend_request')) {
                $user->allow_friend_request = $request->boolean('allow_friend_request');
            }
            if ($request->has('email_login_alerts')) {
                $user->email_login_alerts = $request->boolean('email_login_alerts');
            }
            if ($request->has('push_login_alerts')) {
                $user->push_login_alerts = $request->boolean('push_login_alerts');
            }
            if ($request->has('suspicious_activity_alerts')) {
                $user->suspicious_activity_alerts = $request->boolean('suspicious_activity_alerts');
            }
            $user->save();
            $profileData = [];
            $fields = ['bio', 'phone', 'address', 'city', 'state', 'country', 'zip_code'];

            foreach ($fields as $field) {
                if ($request->filled($field)) {
                    $profileData[$field] = $request->$field;
                }
            }

            // Create or Get Profile
            $profile = Profile::updateOrCreate(
                ['user_id' => $user->id],
                $profileData
            );

            // Handle Avatar Removal
            if ($request->filled('remove_avatar')) {
                $attachment = Attachments::find($request->remove_avatar);
                // Security check: ensure this attachment belongs to the user's profile
                if ($attachment && $attachment->attachable_type === Profile::class && $attachment->attachable_id === $profile->id) {
                    $this->deleteAttachment($attachment);
                }
            }

            // Handle Avatar Upload
            if ($request->hasFile('avatar')) {
                // Delete old avatar if exists
                // Use relation method to avoid collision with 'avatar' column string value
                $oldAvatar = $profile->avatar()->first();
                if ($oldAvatar) {
                    $this->deleteAttachment($oldAvatar);
                }

                $file = $request->file('avatar');
                $extension = $file->getClientOriginalExtension();
                $filename = time() . '_' . uniqid() . '.' . $extension;

                // Ensure directory exists
                $folderPath = public_path('storage/profiles/avatars');
                if (!file_exists($folderPath)) {
                    mkdir($folderPath, 0777, true);
                }

                $file->move($folderPath, $filename);

                // Path for DB (relative to public)
                $dbPath = 'storage/profiles/avatars/' . $filename;

                // Create Attachment Record
                $profile->avatar()->create([
                    'file_path' => $dbPath,
                    'file_name' => $filename,
                    'file_type' => 'image',
                ]);
            }

            // Reload with avatar
            $user->load('profile.avatar');

            return $this->Response(true, 'Profile updated successfully', $user);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    private function deleteAttachment($attachment)
    {
        if ($attachment && !empty($attachment->file_path)) {
            // file_path already contains the full relative path including filename
            $fullPath = public_path($attachment->file_path);

            if (file_exists($fullPath)) {
                if (is_file($fullPath)) {
                    unlink($fullPath);
                }
                // Removed is_dir check to prevent accidental directory deletion
            }
            $attachment->delete();
        }
    }
    public function followUser(Request $request)
    {
        $this->validateRequest($request, [
            'user_id' => 'required|integer|exists:users,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if ($user->id == $request->user_id) {
                return $this->Response(false, 'You cannot follow yourself', null, 400);
            }
            $targetUser = User::find($request->user_id);
            if(!$targetUser->allow_friend_request){
                 return $this->Response(false, 'This user does not accept friend requests', null, 403);
            }
            
            if ($user->following()->where('following_id', $request->user_id)->exists()) {
                return $this->Response(false, 'You are already following this user', null, 400);
            }

            $status = 'pending';
            // If user is public, auto accept?
            if(!$targetUser->is_private){
               // $status = 'accepted'; // Optionally for public profiles
               // Lets keep it pending for consistent 'Friend Request' logic as requested, or
               // Typically 'Following' is direct for public. User said "Friend Request" (Facebook style) usually implies approval needed.
               // But if it's "Follow" (Instagram style), public = auto accept.
               // Given "Friend Request" wording, let's keep it pending?
               // User asked for "Friend Request" allow toggle. That implies approval system.
               // Let's stick to Pending.
            }

            $user->follow($request->user_id, ['status' => $status]);

            // Notification Logic
            if ($targetUser) {
                SendNotification::dispatchSync(
                    $user->id,
                    'New Follower',
                    $user->name . ' sent you a follow request.',
                    $targetUser->id,
                    $targetUser, // Notifiable is the User model
                    'N'
                );
            }
            return $this->Response(true, 'Follow request sent successfully', ['status' => $status]);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function acceptFollowRequest(Request $request)
    {
        $this->validateRequest($request, [
            'user_id' => 'required|integer|exists:users,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if ($user->id == $request->user_id) {
                return $this->Response(false, 'You cannot follow yourself', null, 400);
            }
            // Check if the user is actually in the followers list (i.e. has sent a request)
            if (!$user->followers()->where('users.id', $request->user_id)->exists()) {
                return $this->Response(false, 'This user has not requested to follow you', null, 400);
            }
            $user->followers()->updateExistingPivot($request->user_id, ['status' => 'accepted']);

            // Notification Logic - Notify the requester
            $requester = User::find($request->user_id);
            if ($requester) {
                SendNotification::dispatchSync(
                    $user->id,
                    'Request Accepted',
                    $user->name . ' accepted your follow request.',
                    $requester->id,
                    $user, // Notifiable is the User who accepted (so clicking goes to their profile)
                    'N'
                );
            }

            return $this->Response(true, 'Follow request accepted successfully', null);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function rejectFollowRequest(Request $request)
    {
        $this->validateRequest($request, [
            'user_id' => 'required|integer|exists:users,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if ($user->id == $request->user_id) {
                return $this->Response(false, 'You cannot follow yourself', null, 400);
            }
            if (!$user->followers()->where('users.id', $request->user_id)->exists()) {
                return $this->Response(false, 'This user has not requested to follow you', null, 400);
            }

            // Just detach (delete) the request. verifying the pivot keys are correct in User model
            // relations: followers() -> table 'followers', foreignKey 'following_id', relatedKey 'follower_id'
            // We are $user (following_id), we want to remove $request->user_id (follower_id)
            $user->followers()->detach($request->user_id);

            return $this->Response(true, 'Follow request deleted successfully', null);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function unfollowUser(Request $request)
    {
        $this->validateRequest($request, [
            'user_id' => 'required|integer|exists:users,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if ($user->id == $request->id) {
                return $this->Response(false, 'You cannot follow yourself', null, 400);
            }
            if (!$user->following()->where('following_id', $request->user_id)->exists()) {
                return $this->Response(false, 'You are not following this user', null, 400);
            }
            $user->unfollow($request->user_id);
            return $this->Response(true, 'User unfollowed successfully', null);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function fetchFollower(Request $request)
    {
        $this->validateRequest($request, [
            'user_id' => 'required|integer|exists:users,id',
        ]);
        try {
            $user = User::with(['followers' => function ($q) {
                $q->wherePivot('status', 'accepted')->with('profile.avatar');
            }])->find($request->user_id);
            if (!$user) {
                return $this->Response(false, 'User not found', null, 404);
            }
            
            // Privacy Check for Viewer
             $loggedInUser = auth('api')->user();
             $connection_status = $loggedInUser ? $loggedInUser->getFollowStatus($user->id) : 'none';
             $is_me = $loggedInUser && $loggedInUser->id === $user->id;
             $is_friend = $connection_status === 'accepted';
             $is_admin = $loggedInUser && $loggedInUser->hasRole(['super admin']);
            // Privacy Logic
            if ($user->is_private && !$is_me && !$is_friend && !$is_admin) {
                 return $this->Response(false, 'This Account is Private', null, 403);
             }


            return $this->Response(true, 'User followers retrieved successfully', $user->followers);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function fetchPendingRequests(Request $request)
    {
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            // Get users who have a 'pending' follow status towards the current user
            $limit = $request->input('limit', 10);

            $query = $user->followers()
                ->wherePivot('status', 'pending')
                ->with('profile.avatar');

            $paginator = $query->paginate($limit);
            $data = $this->paginateData($paginator, $paginator->items());

            return $this->Response(true, 'Pending requests', $data);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    public function fetchFollowing(Request $request)
    {
        // Renamed/Used as 'fetchMyFriends' logic if user_id not passed
        // Or specific user friends if id passed
        try {
            $targetUserId = $request->input('user_id') ?? auth('api')->id();

            $user = User::find($targetUserId);
            if (!$user) {
                return $this->Response(false, 'User not found', null, 404);
            }
             // Privacy Check for Viewer
             $loggedInUser = auth('api')->user();
             $connection_status = $loggedInUser ? $loggedInUser->getFollowStatus($user->id) : 'none';
            $is_me = $loggedInUser && $loggedInUser->id === $user->id;
            $is_friend = $connection_status === 'accepted';
            $is_admin = $loggedInUser && $loggedInUser->hasRole(['super admin']);
            // Privacy Logic
            if ($user->is_private && !$is_me && !$is_friend && !$is_admin) {
                return $this->Response(false, 'This Account is Private', null, 403);
            }

            $limit = $request->input('limit', 10);

            // Fetch following with 'accepted' status
            $query = $user->following()
                ->wherePivot('status', 'accepted')
                ->with('profile.avatar');

            $paginator = $query->paginate($limit);
            $data = $this->paginateData($paginator, $paginator->items());

            return $this->Response(true, 'User following retrieved successfully', $data);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function fetchSuggestions(Request $request)
    {
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }

            // Exclude:
            // 1. Self
            // 2. Users I am already following (status doesn't matter for exclusion, if I follow them or requested, dont suggest)
            // 3. Users who are following me (optional, but maybe we want to suggest them? stick to basic for now)

            // Get IDs I am following (pending or accepted)
            $following = $user->following()->pluck('users.id')->toArray();

            // Also exclude users who are following me (Pending or Accepted)
            // If they follow me, they are already "connected" in a way, or if they are pending, they are in requests.
            $follower = $user->followers()->pluck('users.id')->toArray();

            $excluded = array_merge([$user->id], $following, $follower);

            // Get random users not in excluded list
            $limit = $request->input('limit', 20);

            $query = User::whereNotIn('id', $excluded)
                ->with('profile.avatar')
                ->inRandomOrder(); // Random order for suggestions

            $paginator = $query->paginate($limit);
            $data = $this->paginateData($paginator, $paginator->items());

            return $this->Response(true, 'Suggestions retrieved', $data);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    public function fetchWhoToFollow(Request $request)
    {
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }

            $limit = $request->input('limit', 10);

            // Get IDs of people I am already following (Accepted or Pending)
            $iamFollowingIds = $user->following()->pluck('users.id')->toArray();

            // Also exclude myself
            $excluded = array_merge([$user->id], $iamFollowingIds);

            // Logic: Users who follow ME (accepted) BUT I don't follow them
            $query = $user->followers()
                ->wherePivot('status', 'accepted')
                ->whereNotIn('users.id', $excluded)
                ->with('profile.avatar');

            $paginator = $query->paginate($limit);
            $data = $this->paginateData($paginator, $paginator->items());

            return $this->Response(true, 'Who to follow retrieved', $data);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
}
