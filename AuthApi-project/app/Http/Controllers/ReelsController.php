<?php

namespace App\Http\Controllers;

use App\Jobs\AddReel;
use App\Jobs\DeleteReel;
use App\Models\Reaction;
use App\Models\Reel;
use App\Models\Share;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ReelsController extends BaseController
{
    public function create_reel(Request $request)
    {
        $this->validateRequest($request, [
            'caption' => 'nullable|string',
            'video' => 'required|file|mimes:mp4,avi,mov,flv,wmv|max:102400',
            'thumbnail' => 'nullable|file|mimes:jpeg,png,jpg,gif,svg|max:51200',
            'privacy' => 'in:public,followers,private',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            try {
                $thumbnailPath = null;
                if ($request->hasFile('thumbnail')) {
                    $file = $request->file('thumbnail');
                    $filename = time() . '_thumb_' . uniqid() . '.' . $file->getClientOriginalExtension();
                    $file->move(public_path('storage/thumbnails'), $filename);
                    $thumbnailPath = 'storage/thumbnails/' . $filename;
                }
            } catch (\Exception $e) {
                Log::error('Thumbnail Upload Error: ' . $e->getMessage());
                return response()->json([
                    'success' => false,
                    'message' => 'Thumbnail upload failed.',
                ], 500);
            }

            $reel = null;
            if ($request->hasFile('video')) {
                // Pass caption, privacy, AND thumbnail_path to uploadReel
                $reel = $this->uploadReel($request->file('video'), 'reels', $user, [
                    'caption' => $request->caption,
                    'privacy' => $request->privacy ?? 'public',
                    'created_by' => $user->id,
                    'updated_by' => $user->id,
                    'user_id' => $user->id,
                    'thumbnail_path' => $thumbnailPath,
                ]);
                AddReel::dispatch($user->id, $request->caption, $reel, $thumbnailPath, $request->privacy);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Video file is required.',
                ], 422);
            }

            return response()->json([
                'success' => true,
                'message' => 'Reel uploaded successfully',
                'data' => $reel,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Reel Creation Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function update_reel(Request $request)
    {
        $this->validateRequest($request, [
            'reel_id' => 'required|exists:reels,id',
            'caption' => 'nullable|string',
            'privacy' => 'in:public,followers,private',

        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $reel = Reel::find($request->reel_id);
            if (!$reel) {
                return response()->json([
                    'success' => false,
                    'message' => 'Reel not found.',
                ], 404);
            }
            if ($reel->user_id != $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not authorized to update this reel.',
                ], 403);
            }
            $reel->update([
                'caption' => $request->caption ?? $reel->caption,
                'privacy' => $request->privacy ?? $reel->privacy,
                'updated_by' => $user->id,
            ]);
            return response()->json([
                'success' => true,
                'message' => 'Reel updated successfully',
                'data' => $reel,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Reel Update Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function destroy_reel(Request $request)
    {
        $this->validateRequest($request, [
            'reel_id' => 'required|exists:reels,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $reel = Reel::find($request->reel_id);
            if (!$reel) {
                return response()->json([
                    'success' => false,
                    'message' => 'Reel not found.',
                ], 404);
            }
            if($reel->user_id == $user->id){
                DeleteReel::dispatch($user->id,$reel->id);
                return response()->json([
                    'success' => true,
                    'message' => 'Reel deleted successfully',
                ], 200);
            }
            $owner = $reel->user;
            if(!$owner){
                if($user->hasRole(['admin', 'super admin'])) {
                    DeleteReel::dispatch($user->id,$reel->id);
                    return response()->json([
                        'success' => true,
                        'message' => 'Reel deleted successfully',
                    ], 200);
                }
                return $this->unauthorized();
            }
            $authorized = false;
            if($owner->hasRole('super admin')){
                if($user->hasRole(['super admin'])){
                    $authorized = true;
                }
            }elseif($owner->hasRole('admin')){
                if($user->hasRole(['admin', 'super admin'])){
                    $authorized = true;
                }
            }elseif($owner->hasRole('moderator')){
                if($user->hasRole(['moderator', 'admin', 'super admin'])){
                    $authorized = true;
                }
            }else{
                if($user->hasRole(['admin', 'super admin'])){
                    $authorized = true;
                }
            }
            if(!$authorized){
                return $this->unauthorized();
            }
            DeleteReel::dispatch($user->id,$reel->id);
            return response()->json([
                'success' => true,
                'message' => 'Reel deleted successfully',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Reel Delete Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function getreelofuser(Request $request)
    {
        $this->validateRequest($request, [
            'user_id' => 'required|exists:users,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $reels = Reel::with('user.profile.avatar')
                ->withCount(['comments', 'reactions'])
                ->where('user_id', $request->user_id)
                ->orderBy('updated_at', 'desc')
                ->get();

            $reels = $this->enrichReels($reels, $user->id);
            return response()->json([
                'success' => true,
                'message' => 'Reels fetched successfully',
                'data' => $reels,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Reel Fetch Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function getreelofall(Request $request)
    {
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            // For You: Random order to discover new content
            $reels = Reel::with('user.profile.avatar')
                ->withCount(['comments', 'reactions'])
                ->inRandomOrder()
                ->get();
            $reels = $this->enrichReels($reels, $user->id);
            return response()->json([
                'success' => true,
                'message' => 'Reels fetched successfully',
                'data' => $reels,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Reel Fetch Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function get_following_reels(Request $request)
    {
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }

            // Get IDs of users I am following
            $followingIds = $user->following()->pluck('users.id');

            // Fetch reels from these users, latest first
            $reels = Reel::with('user.profile.avatar')
                ->withCount(['comments', 'reactions'])
                ->whereIn('user_id', $followingIds)
                ->latest()
                ->get();

            $reels = $this->enrichReels($reels, $user->id);

            return response()->json([
                'success' => true,
                'message' => 'Following reels fetched successfully',
                'data' => $reels,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Following Reel Fetch Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function saveReel(Request $request)
    {
        $this->validateRequest($request, [
            'reel_id' => 'required|exists:reels,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $reelId = $request->reel_id;
            // Toggle Logic
            $attached = $user->savedReels()->toggle($reelId);

            $status = count($attached['attached']) > 0 ? 'saved' : 'unsaved';
            $message = $status === 'saved' ? 'Reel saved successfully' : 'Reel unsaved successfully';

            return $this->Response(true, $message, ['status' => $status]);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    public function getSavedReels(Request $request)
    {
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $savedReels = $user->savedReels()
                ->with('user.profile.user_avatar') // Eager load relationships
                ->withCount(['comments', 'reactions'])
                ->orderBy('pivot_created_at', 'desc')
                ->get();

            $savedReels = $this->enrichReels($savedReels, $user->id);

            return response()->json([
                'success' => true,
                'message' => 'Saved reels fetched successfully',
                'data' => $savedReels,
            ], 200);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    private function enrichReels($reels, $userId)
    {
        if ($reels->isEmpty()) return $reels;

        $reelIds = $reels->pluck('id');
        $userIds = $reels->pluck('user_id')->unique();

        // 1. Likes
        $likes = Reaction::where('reactionable_type', Reel::class)
            ->whereIn('reactionable_id', $reelIds)
            ->where('created_by', $userId)
            ->where('type', 1)
            ->pluck('reactionable_id')
            ->flip()
            ->all();

        // 2. Saved
        $saved = DB::table('saved_reels')
            ->whereIn('reel_id', $reelIds)
            ->where('user_id', $userId)
            ->pluck('reel_id')
            ->flip()
            ->all();

        // 3. Follow Status
        $follows = DB::table('followers')
            ->where('follower_id', $userId)
            ->whereIn('following_id', $userIds)
            ->pluck('status', 'following_id')
            ->all();

        foreach ($reels as $reel) {
            $reel->is_liked = isset($likes[$reel->id]);
            $reel->is_saved = isset($saved[$reel->id]);
            if ($reel->user) {
                $reel->user->follow_status = $follows[$reel->user_id] ?? 'none';
            }
            // Map reactions_count to likes_count for frontend compatibility
            $reel->likes_count = $reel->reactions_count ?? 0;
            // Map comments_count for consistency (already available but ensures safe fallback)
            $reel->comments_count = $reel->comments_count ?? 0;
        }
        return $reels;
    }
}
