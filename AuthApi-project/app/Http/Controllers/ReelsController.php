<?php

namespace App\Http\Controllers;

use App\Jobs\AddReel;
use App\Models\Reel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

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
            try{
            $thumbnailPath = null;
            if ($request->hasFile('thumbnail')) {
                $file = $request->file('thumbnail');
                $filename = time() . '_thumb_' . uniqid() . '.' . $file->getClientOriginalExtension();
                $thumbnailPath = $file->storeAs('reels', $filename, 'public');
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
    public function update_reel(Request $request){
        $this->validateRequest($request,[
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
                    'message' => 'Unauthorized.',
                ], 401);
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
    public function destroy_reel(Request $request){
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
            if ($reel->user_id != $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized.',
                ], 401);
            }
            $reel->delete();
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
    public function getreelofuser(Request $request){
        $this->validateRequest($request, [
            'user_id' => 'required|exists:users,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $reels = Reel::where('user_id', $request->user_id)->get();
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
    public function getreelofall(Request $request){
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $reels = Reel::all();
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
}
