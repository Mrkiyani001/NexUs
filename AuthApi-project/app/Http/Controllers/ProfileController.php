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
        // ... existing viewProfile logic ...
        // (No changes needed in viewProfile unless we want to load 'avatar' relation explicitly, 
        //  but with(['profile.avatar']) might be needed if not automatically loaded. 
        //  For now user only asked for update logic rewrite.)
        try {
            $userId = $request->id ?? auth('api')->id();
            if (!$userId) {
                return $this->unauthorized();
            }

            // User data ka sath Profile, Followers, or Following load kro
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
                    }, // 'followers' table alias is usually 'followers' ? No, eloquent relation count
                    'following' => function ($q) {
                        $q->where('followers.status', 'accepted');
                    }
                ])
                ->find($userId);

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }
            // Email Visibility Logic
            if ($userId !== $user->id && $user->show_email == false) {
                $user->makeHidden(['email']);
            }

            // Connection Status Logic Here Use function CheckfollowStatus from uSER MODEL
            $loggedInUser = auth('api')->user();
            $user->connection_status = $loggedInUser ? $loggedInUser->getFollowStatus($user->id) : 'none';

            return response()->json([
                'success' => true,
                'message' => 'Profile retrieved successfully',
                'data' => $user
            ], 200);
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
                return response()->json(['success' => false, 'message' => 'Unauthorized: You can only update your own profile'], 401);
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
                $folderPath = public_path('profiles/avatars');
                if (!file_exists($folderPath)) {
                    mkdir($folderPath, 0777, true);
                }

                $file->move($folderPath, $filename);

                // Path for DB (relative to public)
                $dbPath = 'profiles/avatars/' . $filename;

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
            if ($user->following()->where('following_id', $request->user_id)->exists()) {
                return $this->Response(false, 'You are already following this user', null, 400);
            }

            $status = 'pending';
            $user->follow($request->user_id, ['status' => $status]);

            // Notification Logic
            $followedUser = User::find($request->user_id);
            if ($followedUser) {
                SendNotification::dispatchSync(
                    $user->id,
                    'New Follower',
                    $user->name . ' sent you a follow request.',
                    $followedUser->id,
                    $followedUser, // Notifiable is the User model
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
