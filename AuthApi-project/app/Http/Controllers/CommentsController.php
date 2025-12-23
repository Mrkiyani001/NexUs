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

class CommentsController extends BaseController
{
    public function create(Request $request)
    {
        $this->validateRequest($request, [
            'post_id' => 'required|integer|exists:post,id',
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
            $comment = $request->comment;
            $uploadFiles = [];
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                    $file->move(public_path('comments'), $filename);
                    $uploadFiles[] = $filename;
                }
            }
            AddComment::dispatch(
                $user->id,
                $post_id,
                $comment,
                $uploadFiles
            );

            // Notification Logic
            $post = Post::find($post_id);
            if ($post && $post->user_id != $user->id) {
                SendNotification::dispatch(
                    $user->id,
                    'New Comment',
                    'User ' . $user->id . ' commented on your post.',
                    $post->user_id,
                    $post,
                    'N'
                );
            }
            //     $comment = Comments::create([
            //         'post_id'=>$request->post_id,
            //         'user_id'=>$user->id,
            //         'comment'=>$request->comment,
            //         'created_by'=>$user->id,
            //         'updated_by'=>$user->id,
            //     ]);
            //     if($request->hasFile('attachments')){
            //         foreach($request->file('attachments')as $file)
            //             $this->upload($file,'comments',$comment);
            // }
            return response()->json([
                'success' => true,
                'message' => 'Comment created successfully',
                'data' => $uploadFiles,
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
            return response()->json([
                'success' => true,
                'message' => 'Comment updated successfully',
                'data' => $uploadFiles,
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
            if ($comment->user_id != $user->id) {
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
            $comments = Comments::with('attachments', 'creator', 'updator', 'user', 'post')
                ->where('post_id', $request->post_id)
                ->withExists(['reactions as is_liked' => function ($q) use ($user) {
                    $q->where('created_by', $user->id)->where('type', 1);
                }])
                ->withCount(['reactions as like_count' => function ($q) {
                    $q->where('type', 1);
                }])
                ->withCount('replies')
                ->with(['replies' => function($q) use ($user) {
                    $q->with('creator:id,name')
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
