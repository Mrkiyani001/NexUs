<?php

namespace App\Http\Controllers;

use App\Models\Attachments;
use App\Models\CommentReply;
use App\Models\Comments;
use App\Models\Post;
use Illuminate\Http\Request;
use App\Jobs\AddCommentReply;
use App\Jobs\UpdateCommentReply;
use App\Jobs\DeleteCommentReply;
use App\Jobs\SendNotification;
use Illuminate\Support\Facades\Log;

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
                    $file->move(public_path('storage/comment_replies'), $filename);
                    $uploadFiles[] = $filename;
                }
            }

            // Direct synchronous creation for instant ID return
            $commentReply = CommentReply::create([
                'comment_id' => $request->comment_id,
                'user_id' => $user->id,
                'reply' => $request->reply,
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
                        $commentReply->attachments()->create([
                            'file_name' => $filename,
                            'file_type' => $type,
                            'file_path' => 'storage/comment_replies/' . $filename,
                        ]);
                    }
                } catch (\Exception $e) {
                    Log::error("Failed to upload attachments for comment reply ID " . $commentReply->id . ": " . $e->getMessage());
                    return $this->Response(false, $e->getMessage(), null, 500);
                }
            }

            // Notification Logic: Notify Post Owner (Async Job)
            $comment = Comments::find($request->comment_id);
            if ($comment) {
                $post = Post::find($comment->post_id);
                if ($post && $post->user_id != $user->id) {
                    SendNotification::dispatch(
                        $user->id,
                        'New Reply',
                        $user->name . ' replied to a comment on your post.',
                        $post->user_id,
                        $post,
                        'N'
                    );
                }
            }

            // Reload to get relationships if needed (e.g. avatar) or just return what we have
            // We need to return structure matching what frontend expects if possible, 
            // but for now ID is critical.

            return $this->Response(true, 'Comment Reply created successfully', $commentReply, 201);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
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
                return $this->Response(false, 'Comment Reply not found', null, 404);
            }
            if ($commentReply->user_id != $user->id) {
                return $this->NotAllowed();
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
                    $file->move(public_path('storage/comment_replies'), $filename);
                    $uploadFiles[] = $filename;
                }
            }

            UpdateCommentReply::dispatch(
                $user->id,
                $request->id,
                $request->reply,
                $uploadFiles
            );

            return $this->Response(true, 'Comment Reply update in progress', null, 202);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
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
            if (!$commentReply) {
                return $this->Response(false, 'Comment Reply not found', null, 404);
            }
            if ($commentReply->user_id == $user->id) {

            DeleteCommentReply::dispatch(
                $user->id,
                $request->id
            );

            return $this->Response(true, 'Comment Reply deletion in progress', null, 202);                
            }
            $owner = $commentReply->user;
            if(!$owner){
                if($user->hasRole(['super admin','Admin'])){
                    DeleteCommentReply::dispatch(
                        $user->id,
                        $request->id
                    );
                    return $this->Response(true, 'Comment Reply deletion in progress', null, 202);                
                }
                return $this->NotAllowed();
            }
            $authorized = false;
            if($owner->hasRole('super admin')){
                if($user->hasRole('super admin')){
                    $authorized = true;
                }
            }elseif($owner->hasRole('Admin')){
                if($user->hasRole(['Admin','super admin'])){
                    $authorized = true;
                }
            }elseif($owner->hasRole('Moderator')){
                if($user->hasRole(['Moderator','Admin','super admin'])){
                    $authorized = true;
                }
            }else{
                if($user->hasRole(['Admin','super admin'])){
                    $authorized = true;
                }
            }
            if(!$authorized){
                return $this->NotAllowed();
            }
            DeleteCommentReply::dispatch(
                $user->id,
                $request->id
            );

            return $this->Response(true, 'Comment Reply deletion in progress', null, 202);                

        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
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
            return $this->Response(true, 'Comment Replies fetched successfully', $data, 200);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
}
