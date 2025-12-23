<?php

namespace App\Http\Controllers;

use App\Models\Attachments;
use App\Models\CommentReply;
use Illuminate\Http\Request;
use App\Jobs\AddCommentReply;
use App\Jobs\UpdateCommentReply;
use App\Jobs\DeleteCommentReply;

class CommentsRepliesController extends BaseController
{
    public function create(Request $request)
    {
        $this->validateRequest($request, [
            'comment_id' => 'required|integer|exists:comments,id',
            'reply' => 'required|string',
            'attachments' => 'array',
            'attachments.*' => 'nullable|file|mimes:jpg,jpeg,png,gif,mp4,avi,mov,pdf,doc,docx|max:51200',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }

            $uploadFiles = [];
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                    $file->move(public_path('comment_replies'), $filename);
                    $uploadFiles[] = $filename;
                }
            }

            AddCommentReply::dispatch(
                $user->id,
                $request->comment_id,
                $request->reply,
                $uploadFiles
            );

            return response()->json([
                'success' => true,
                'message' => 'Comment Reply creation in progress',
            ], 202);
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
            'id' => 'required|integer|exists:comments_replies,id',
            'reply' => 'required|string',
            'attachments' => 'nullable|array',
            'attachments.*' => 'nullable|file|mimes:jpg,jpeg,png,gif,mp4,avi,mov,pdf,doc,docx|max:51200', // max 50MB each
            'remove_attachments' => 'nullable|array',
            'remove_attachments.*' => 'integer|exists:attachments,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $commentReply = CommentReply::find($request->id);
            if (is_null($commentReply)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Comment Reply not found',
                ], 404);
            }
            if($commentReply->user_id != $user->id){
                return $this->unauthorized();
            }

            // Handle removal of attachments
            if ($request->has('remove_attachments')) {
                Attachments::whereIn('id', $request->remove_attachments)
                    ->where('attachable_type', CommentReply::class)
                    ->where('attachable_id', $commentReply->id)
                    ->delete();
            }

            // Handle attachments
            $uploadFiles = [];
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                    $file->move(public_path('comment_replies'), $filename);
                    $uploadFiles[] = $filename;
                }
            }

            UpdateCommentReply::dispatch(
                $user->id,
                $request->id,
                $request->reply,
                $uploadFiles
            );

            return response()->json([
                'success' => true,
                'message' => 'Comment Reply update in progress',
            ], 202);
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
            'id' => 'required|integer|exists:comments_replies,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $commentReply = CommentReply::find($request->id);
            if(!$commentReply){
                return response()->json([
                    'success' => false,
                    'message' => 'Comment Reply not found',
                ], 404);
            }
            if($commentReply->user_id != $user->id){
                return $this->unauthorized();
            }
            
            DeleteCommentReply::dispatch(
                $user->id,
                $request->id
            );

            return response()->json([
                'success' => true,
                'message' => 'Comment Reply deletion in progress',
            ], 202);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function get_replies_by_comment(Request $request)
    {
        $this->validateRequest($request, [
            'comment_id' => 'required|integer|exists:comments,id',
        ]);
        try {
            $user = auth('api')->user();
            $limit = (int) $request->input('limit', 10);
            if (!$user) {
                return $this->unauthorized();
            }
            $commentReplies = CommentReply::with('attachments', 'creator', 'updator', 'user', 'comment')
                ->where('comment_id', $request->comment_id)
                ->paginate($limit);
            
            $data = $this->paginateData($commentReplies, $commentReplies->items());
            return response()->json([
                'success' => true,
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
