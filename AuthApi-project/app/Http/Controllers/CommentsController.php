<?php

namespace App\Http\Controllers;

use App\Jobs\AddComment;
use App\Jobs\DeleteComment;
use App\Jobs\UpdateComment;
use App\Jobs\SendNotification; // Added Import Correctly
use App\Models\Attachments;
use App\Models\Post;
use Illuminate\Http\Request;
use App\Models\Comments;
use App\Models\Reel;

class CommentsController extends BaseController
{
    public function create(Request $request)
    {
        $this->validateRequest($request, [
            'post_id' => 'nullable|integer|exists:post,id|required_without:reel_id',
            'reel_id' => 'nullable|integer|exists:reels,id|required_without:post_id',
            'comment' => 'required|string',
            'attachments' => 'array',
            'attachments.*' => 'nullable|file|mimes:jpg,jpeg,png,gif,mp4,avi,mov,pdf,doc,docx|max:51200',
        ]);
        try {
            $user = auth('api')->user();
            if (! $user) {
                return $this->unauthorized();
            }

            $post_id = $request->post_id;
            $reel_id = $request->reel_id;
            $comment = $request->comment;
            $uploadFiles = [];
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                    $file->move(public_path('storage/comments'), $filename);
                    $uploadFiles[] = $filename;
                }
            }
            // Direct synchronous creation for instant ID return
            $comment = Comments::create([
                'post_id' => $post_id,
                'reel_id' => $reel_id,
                'user_id' => $user->id,
                'comment' => $comment,
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);

            // Handle Attachments
            if (!empty($uploadFiles)) {
                try {
                    foreach ($uploadFiles as $filename) {
                        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                        $type = match (true) {
                            in_array($extension, ['jpg', 'jpeg', 'png', 'gif']) => 'image',
                            in_array($extension, ['mp4', 'avi', 'mov']) => 'video',
                            $extension === 'pdf' => 'pdf',
                            in_array($extension, ['doc', 'docx']) => 'word',
                            in_array($extension, ['zip', 'rar', '7z']) => 'zip',
                            default => 'other',
                        };
                        $comment->attachments()->create([
                            'file_name' => $filename,
                            'file_type' => $type,
                            'file_path' => 'storage/comments/' . $filename,
                        ]);
                    }
                } catch (\Exception $e) {
                   // Log error but continue
                }
            }

            // Load relationships to return full structure
             $comment->load('user.profile.avatar', 'attachments');

            // Notification Logic
            if ($post_id) {
                $post = Post::find($post_id);
                if ($post && $post->user_id != $user->id) {
                    SendNotification::dispatch(
                        $user->id,
                        'New Comment',
                        $user->name . ' commented on your post.',
                        $post->user_id,
                        $post,
                        'N'
                    );
                }
            } elseif ($reel_id) {
                $reel = Reel::find($reel_id);
                if ($reel && $reel->user_id != $user->id) {
                    SendNotification::dispatch(
                        $user->id,
                        'New Reel Comment',
                        $user->name . ' commented on your reel.',
                        $reel->user_id,
                        $reel, // Assuming notification model supports reel morph or generic
                        'N'
                    );
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Comment created successfully',
                'data' => $comment,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function update(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:comments,id',
            'comment' => 'required|string',
            'attachments' => 'array',
            'attachments.*' => 'nullable|file|mimes:jpg,jpeg,png,gif,mp4,avi,mov,pdf,doc,docx|max:51200', // max 50MB each
            'remove_attachments' => 'nullable|array',
            'remove_attachments.*' => 'integer|exists:attachments,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }

            $comment = Comments::find($request->id);
            if (is_null($comment)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Comment not found',
                ], 404);
            }
            if ($comment->user_id != $user->id) {
                return $this->unauthorized();
            }
            $comment->fill([
                'comment' => $request->comment,
                'updated_by' => $user->id,
            ]);
            $comment->save();
            // Handle removal of attachments

            if ($request->has('remove_attachments')) {
                Attachments::whereIn('id', $request->remove_attachments)
                    ->where('attachable_type', Comments::class)
                    ->where('attachable_id', $comment->id)
                    ->delete();
            }
            // Handle attachments
            $uploadFiles = [];
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $this->upload($file, 'comments', $comment);
                }
            }
            UpdateComment::dispatch(
                $user->id,
                $request->id,
                $request->comment,
                $uploadFiles
            );
            $comment->refresh(); // Refresh from DB
            return response()->json([
                'success' => true,
                'message' => 'Comment updated successfully',
                'data' => $comment, // Return full comment object
                'upload_files' => $uploadFiles // Keep this for legacy if needed
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function destroy(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:comments,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $comment = Comments::find($request->id);
            if (!$comment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Comment not found',
                ], 404);
            }
            if ($comment->user_id == $user->id) {
                 DeleteComment::dispatch(
                $user->id,
                $request->id
            );
            return response()->json([
                'success' => true,
                'message' => 'Comment deleted successfully',
            ], 200);
            }
            $owner = $comment->user;
            if(!$owner){
                if($user->hasRole('admin','super admin')){
                    DeleteComment::dispatch(
                        $user->id,
                        $request->id
                    );
                    return response()->json([
                        'success' => true,
                        'message' => 'Comment deleted successfully',
                    ], 200);
                }
                return $this->unauthorized();
            }
            $authorized = false;
            if($owner->hasRole('super admin')){
                if($user->hasRole('super admin')){
                    $authorized = true;
                }
            }elseif($owner->hasRole('admin')){
                if($user->hasRole('admin','super admin')){
                    $authorized = true;
                }
            }elseif($owner->hasRole('moderator')){
                if($user->hasRole('moderator','admin','super admin')){
                    $authorized = true;
                }
            }else{
                if($user->hasRole('admin','super admin')){
                    $authorized = true;
                }
            }
            if(!$authorized){
                return $this->unauthorized();
            }
            DeleteComment::dispatch(
                $user->id,
                $request->id
            );
            return response()->json([
                'success' => true,
                'message' => 'Comment deleted successfully',
            ], 200);
            // $comment = Comments::find($request->id);
            // if(is_null($comment)){
            //     return response()->json([
            //         'success'=>false,
            //         'message'=>'Comment not found',
            //     ],404); 
            // }else{
            //     $comment->delete();
            // return response()->json([
            //     'success'=>true,
            //     'message'=>'Comment deleted successfully',
            // ],200);
            // }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function get_comments_by_post(Request $request)
    {
        $this->validateRequest($request, [
            'post_id' => 'required|integer|exists:post,id',
        ]);
        try {
            $user = auth('api')->user();
            $limit = (int) $request->input('limit', 10);
            if (!$user) {
                return $this->unauthorized();
            }
            $comments = Comments::with('attachments', 'creator.profile.avatar', 'updator', 'user.profile.avatar', 'post')
                ->where('post_id', $request->post_id)
                ->withExists(['reactions as is_liked' => function ($q) use ($user) {
                    $q->where('created_by', $user->id)->where('type', 1);
                }])
                ->withCount(['reactions as like_count' => function ($q) {
                    $q->where('type', 1);
                }])
                ->withCount('replies')
                ->with(['replies' => function ($q) use ($user) {
                    $q->with('attachments', 'creator.profile.avatar')
                        ->withExists(['reactions as is_liked' => function ($q2) use ($user) {
                            $q2->where('created_by', $user->id)->where('type', 1);
                        }])
                        ->withCount(['reactions as like_count' => function ($q2) {
                            $q2->where('type', 1);
                        }]);
                }])
                ->orderby('created_at', 'desc')
                ->paginate($limit);

            $data = $this->paginateData($comments, $comments->items());
            return response()->json([
                'success' => true,
                'message' => 'Comments retrieved successfully',
                'data' => $data,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function get_comments_by_reel(Request $request)
    {
        $this->validateRequest($request, [
            'reel_id' => 'required|integer|exists:reels,id',
        ]);
        try {
            $user = auth('api')->user();
            $limit = (int) $request->input('limit', 10);
            if (!$user) {
                return $this->unauthorized();
            }
            $comments = Comments::with('attachments', 'creator.profile.avatar', 'updator', 'user.profile.avatar', 'reel')
                ->where('reel_id', $request->reel_id)
                ->withExists(['reactions as is_liked' => function ($q) use ($user) {
                    $q->where('created_by', $user->id)->where('type', 1);
                }])
                ->withCount(['reactions as like_count' => function ($q) {
                    $q->where('type', 1);
                }])
                ->withCount('replies')
                ->with(['replies' => function ($q) use ($user) {
                    $q->with('creator.profile.avatar')
                        ->with('attachments') // Eager load attachments for replies
                        ->withExists(['reactions as is_liked' => function ($q2) use ($user) {
                            $q2->where('created_by', $user->id)->where('type', 1);
                        }])
                        ->withCount(['reactions as like_count' => function ($q2) {
                            $q2->where('type', 1);
                        }]);
                }])
                ->orderby('created_at', 'desc')
                ->paginate($limit);

            $data = $this->paginateData($comments, $comments->items());
            return response()->json([
                'success' => true,
                'message' => 'Comments retrieved successfully',
                'data' => $data,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
