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
            $user = User::with(['profile', 'followers', 'following'])
                ->withCount(['followers', 'following'])
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
            'email' => 'email|max:255|unique:users,email,'. auth('api')->id(),
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
                // Delete old avatar if exists (Enforce One Avatar Rule)
                if ($profile->avatar) {
                    $this->deleteAttachment($profile->avatar);
                }

                $file = $request->file('avatar');
                $extension = $file->getClientOriginalExtension();
                $filename = time() . '_'.uniqid() . '.' . $extension;
                $path = 'profiles/avatars/'.$filename;
                $file->move(public_path($path), $filename);
                
                // Create Attachment Record
                $profile->avatar()->create([
                    'file_path' => $path,
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
    private function deleteAttachment($attachment) // Just a helper function to delete attachments
    {
        if ($attachment) {
            $oldPath = public_path($attachment->file_path . '/' . $attachment->file_name);
            if (file_exists($oldPath)) {
                unlink($oldPath);
            }
            $attachment->delete();
        }
    }
    public function followUser(Request $request){
        $this->validateRequest($request, [
                'user_id' => 'required|integer|exists:users,id',
            ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if($user->id == $request->user_id){
                return $this->Response(false, 'You cannot follow yourself', null, 400);
            }
            if($user->following()->where('following_id', $request->user_id)->exists()){
                return $this->Response(false, 'You are already following this user', null, 400);
            }

            $user->follow($request->user_id);

            // Notification Logic
            $followedUser = User::find($request->user_id);
            if($followedUser){
                 SendNotification::dispatch(
                    $user->id,
                    'New Follower',
                    'User '.$user->id.' started following you.',
                    $followedUser->id,
                    $followedUser, // Notifiable is the User model
                    'N'
                );
            }
            return $this->Response(true, 'User followed successfully', null);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function unfollowUser(Request $request){
        $this->validateRequest($request, [
                'user_id' => 'required|integer|exists:users,id',
            ]);
        try {
            $user = auth('api')->user();
            if(!$user){
                return $this->unauthorized();
            }
            if($user->id == $request->id){
                return $this->Response(false, 'You cannot follow yourself',null,400);
            }
            if(!$user->following()->where('following_id', $request->user_id)->exists()){
                return $this->Response(false, 'You are not following this user',null,400);
            }
            $user->unfollow($request->user_id);
            return $this->Response(true, 'User unfollowed successfully', null);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function fetchFollower(Request $request){
        $this->validateRequest($request, [
                'user_id' => 'required|integer|exists:users,id',
            ]);
        try {
            $user = User::with('followers')->find($request->user_id);
            if(!$user){
                return $this->Response(false, 'User not found', null, 404);
            }
            return $this->Response(true, 'User followers retrieved successfully', $user->followers);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function fetchFollowing(Request $request){
        $this->validateRequest($request, [
                'user_id' => 'required|integer|exists:users,id',
            ]);
        try {
            $user = User::with('following')->find($request->user_id);
            if(!$user){
                return $this->Response(false, 'User not found', null, 404);
            }
            return $this->Response(true, 'User following retrieved successfully', $user->following);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
}
