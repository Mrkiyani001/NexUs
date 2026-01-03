<?php

namespace App\Http\Controllers;

use App\Http\Controllers\BaseController;
use App\Jobs\AddPost;
use App\Jobs\DeletePost;
use App\Jobs\SendNotification;
use App\Jobs\UpdatePost;
use App\Models\Attachments;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;
use App\Models\Post;
use App\Services\ContentModerationService;
use Illuminate\Support\Facades\DB;

class PostController extends BaseController
{
    public function create(Request $request)
    {
        $this->validateRequest($request, [
            'original_post_id' => 'nullable|exists:post,id', // For retweet Function 
            'title' => 'required|string|max:255',
            'body' => 'nullable|string|required_without:original_post_id',
            'attachments' => 'nullable|array',
            'attachments.*' => 'nullable|file|mimes:jpg,jpeg,png,gif,mp4,avi,mov,pdf,doc,docx|max:51200',
        ]);
        try {
            $user = auth('api')->user();
            // dd($user);
            if (!$user) {
                return $this->unauthorized();
            }
            $attachments = [];
            $count = $request->hasFile('attachments') ? count($request->file('attachments')) : 0;
            if ($count > 0) {
                if ($request->hasFile('attachments')) {
                    foreach ($request->file('attachments') as $file) {
                        $filename = time() . "_" . $file->getClientOriginalName();
                        $file->move(public_path('storage/posts'), $filename);
                        $attachments[] = $filename;
                    }
                }
            }
            $is_approved = false;
            if ($user->hasRole(['admin', 'super admin', 'moderator'])) {
                $is_approved = true;
            }

            AddPost::dispatch(
                $user->id,
                $request->title,
                $request->body,
                $attachments,
                $is_approved,
                $request->original_post_id
            );

            return response()->json([
                'success' => true,
                'message' => 'Post creation in progress',
                'data' => [
                    'user' => $user->id,
                    'title' => $request->title,
                    'body' => $request->body,
                    'attachments' => $attachments,

                ]
            ], 202);
        } catch (\Exception $e) {
            return $this->response(false, $e->getMessage(), null, 500);
        }
    }
    public function update(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:post,id',
            'title' => 'required|string|max:255',
            'body' => 'required|string',
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
            $post = Post::find($request->id);
            if (!$post) {
                return $this->response(false, 'Post not found', null, 404);
            }
            if ($post->user_id != $user->id) {
                return $this->NotAllowed();
            }

            $newfilescount = $request->hasFile('attachments') ? count($request->file('attachments')) : 0;
            $oldfilescount = $request->filled('remove_attachments') ? count($request->remove_attachments) : 0;
            $totalfilescount = $newfilescount + $oldfilescount;

            $newuploadfiles = [];
            if ($newfilescount > 0) {
                foreach ($request->file('attachments') as $file) {
                    $filename = time() . "_" . $file->getClientOriginalName();
                    $file->move(public_path('storage/posts'), $filename);
                    $newuploadfiles[] = $filename;
                }
            }
            $is_approved = false;
            if ($user->hasRole(['admin', 'super admin', 'moderator'])) {
                $is_approved = true;
            }

            UpdatePost::dispatch(
                $user->id,
                $request->id,
                $request->title,
                $request->body,
                $request->remove_attachments,
                $newuploadfiles,
                $is_approved
            );
            return $this->response(true, 'Post update in progress', $newuploadfiles, 202);
        } catch (\Exception $e) {
            return $this->response(false, $e->getMessage(), null, 500);
        }
    }
    public function destroy(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:post,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            // $post = Post::find($request->id);
            // if(is_null($post)){
            //     return response()->json([
            //         'success'=>false,
            //         'message'=>'Post not found',
            //     ],404);
            // }else{
            //     $post->delete();
            // }
            $post = Post::find($request->id);
            if (!$post) {
                return $this->response(false, 'Post not found', null, 404);
            }

            // 1. Owner can always delete their own post
            if ($post->user_id == $user->id) {
                DeletePost::dispatch($user->id, $request->id);
                return $this->response(true, 'Post deleted successfully', null, 200);
            }

            // 2. Permission Check for Non-Owners
            $owner = $post->user; 
            if (!$owner) {
                 // Fallback if creator not found, allow Admin/SA to clean up
                 if ($user->hasRole(['Admin', 'super admin'])) {
                     DeletePost::dispatch($user->id, $request->id);
                     return $this->response(true, 'Post deleted successfully', null, 200);
                 }
                 return $this->NotAllowed();
            }

            $authorized = false;

            if ($owner->hasRole('super admin')) {
                // Only Super Admin can delete Super Admin's post
                if ($user->hasRole('super admin')) {
                    $authorized = true;
                }
            } elseif ($owner->hasRole('Admin')) {
                // Super Admin or Admin can delete Admin's post
                if ($user->hasRole(['super admin', 'Admin'])) {
                    $authorized = true;
                }
            } elseif ($owner->hasRole('Moderator')) {
                // Super Admin, Admin, or Moderator can delete Moderator's post
                if ($user->hasRole(['super admin', 'Admin', 'Moderator'])) {
                    $authorized = true;
                }
            } else {
                // Standard User Post
                // Only Super Admin or Admin can delete (Moderator explicitly excluded by request)
                if ($user->hasRole(['super admin', 'Admin'])) {
                    $authorized = true;
                }
            }

            if (!$authorized) {
                return $this->NotAllowed();
            }

            DeletePost::dispatch(
                $user->id,
                $request->id
            );
            return $this->response(true, 'Post deleted successfully', null, 200);
        } catch (\Exception $e) {
            return $this->response(false, $e->getMessage(), null, 500);
        }
    }
    public function get_post(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:post,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $post = Post::approved()->find($request->id);
            if (is_null($post)) {
                return $this->response(false, 'Post not found', null, 404);
            } else {
                $post->load('attachments', 'creator', 'updator', 'user.profile.avatar');
                return $this->response(true, 'Post found', $post, 200);
            }
        } catch (\Exception $e) {
            return $this->response(false, $e->getMessage(), null, 500);
        }
    }
    public function get_all_posts(Request $request)
    {
        try {
            $limit = (int) $request->input('limit', 10);
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $posts = Post::with([
                'attachments',
                'creator.profile',
                'updator',
                'user.profile',
                'originalPost.creator',
                'originalPost.attachments',
                'user.followers' => function ($q) use ($user) {
                    $q->where('users.id', $user->id)->wherePivot('status', 'accepted');
                }
            ])
                ->withExists(['reactions as is_liked' => function ($q) use ($user) {
                    $q->where('created_by', $user->id)->where('type', 1);
                }])
                ->withCount(['reactions as like_count' => function ($q) {
                    $q->where('type', 1);
                }])
                ->withCount('comments')
                ->withCount('shares')
                ->orderby('created_at', 'desc')
                ->paginate($limit);

            $data = $this->paginateData($posts, $posts->items());
            return $this->response(true, 'Posts found', $data, 200);
        } catch (\Exception $e) {
            return $this->response(false, $e->getMessage(), null, 500);
        }
    }
    public function PendingPosts()
    {
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if (!$user->hasRole(['Admin', 'super admin','Moderator'])) {
                return $this->NotAllowed();
            }
            $posts = Post::pending()->with('attachments', 'creator', 'updator', 'user.profile.avatar')->get();
            return $this->response(true, 'Posts found', $posts, 200);
        } catch (\Exception $e) {
            return $this->response(false, $e->getMessage(), null, 500);
        }
    }
    public function Approved(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:post,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            // $post = Post::find($request->id);
            // dd($post);
            // die;
            // // Use withoutGlobalScopes to find pending posts hidden by strict moderation
            if (!$user->hasRole(['Admin', 'super admin','Moderator'])) {
                return $this->NotAllowed();
            }
            $post = Post::withoutGlobalScopes()->find($request->id);

            if (!$post) {
                return $this->response(false, 'Post not found', null, 404);
            }

            $post->markApproved();

            // Notify the Post Creator
            SendNotification::dispatch(
                $post->user_id, // Recipient: Post Creator
                'Post Approved',
                'Your post has been approved.',
                $user->id,      // Trigger: Admin
                $post,
                'N'
            );

            return $this->response(true, 'Post approved', $post, 200);
        } catch (\Exception $e) {
            return $this->response(false, $e->getMessage(), null, 500);
        }
    }
    public function Rejected(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:post,id',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if (!$user->hasRole(['Admin', 'Moderator', 'super admin'])) {
                return $this->NotAllowed();
            }
            $post = Post::withoutGlobalScopes()->find($request->id);

            if (!$post) {
                return $this->response(false, 'Post not found', null, 404);
            }

            $post->markRejected();

            // Notify the Post Creator
            SendNotification::dispatch(
                $post->user_id, // Creator: Admin who rejected
                'Post Rejected',
                'Your post has been rejected due to content violations.',
                $post->user_id, // Recipient: Post Creator
                $post,          // Notifiable: The Post
                'N'             // For Admin: No
            );

            return $this->response(true, 'Post rejected', $post, 200);
        } catch (\Exception $e) {
            return $this->response(false, $e->getMessage(), null, 500);
        }
    }
    public function get_posts_by_user(Request $request)
    {
        $this->validateRequest($request, [
            'user_id' => 'required|integer|exists:users,id',
        ]);

        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $limit = (int) $request->input('limit', 10);

            // Check if requesting own profile
            if ($user->id == $request->user_id) {
                // My Profile: Show ALL posts (Pending, Approved, Rejected)
                $posts = Post::withoutGlobalScopes()
                    ->where('user_id', $request->user_id)
                    ->with('attachments', 'creator', 'updator', 'user.profile.avatar', 'originalPost.creator', 'originalPost.attachments')
                    ->withExists(['reactions as is_liked' => function ($q) use ($user) {
                        $q->where('created_by', $user->id)->where('type', 1);
                    }])
                    ->withCount(['reactions as like_count' => function ($q) {
                        $q->where('type', 1);
                    }])
                    ->withCount('comments')
                    ->withCount('shares')
                    ->orderBy('updated_at', 'desc')
                    ->paginate($limit);
            }
            if ($user->id != $request->user_id) {
                // Other User's Profile: Show only Approved posts
                $posts = Post::withoutGlobalScopes()
                    ->where('user_id', $request->user_id)
                    ->where('status', 1) // 1 = Approved
                    ->with('attachments', 'creator', 'updator', 'user.profile.avatar', 'originalPost.creator', 'originalPost.attachments')
                    ->withExists(['reactions as is_liked' => function ($q) use ($user) {
                        $q->where('created_by', $user->id)->where('type', 1);
                    }])
                    ->withCount('comments')
                    ->withCount('replies')
                    ->withCount('shares')
                    ->orderBy('updated_at', 'desc')
                    ->paginate($limit);
            }

            $data = $this->paginateData($posts, $posts->items());
            return $this->response(true, 'Posts found', $data, 200);
        } catch (\Exception $e) {
            return $this->response(false, $e->getMessage(), null, 500);
        }
    }

    public function get_liked_posts(Request $request)
    {
        $this->validateRequest($request, [
            'user_id' => 'required|integer|exists:users,id',
        ]);

        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $limit = (int) $request->input('limit', 10);

            $posts = Post::whereHas('reactions', function ($q) use ($request) {
                $q->where('created_by', $request->user_id)->where('type', 1);
            })
                ->where('status', 1) // Only approved posts
                ->with('attachments', 'creator', 'updator', 'user.profile.avatar', 'originalPost.creator', 'originalPost.attachments')
                ->withExists(['reactions as is_liked' => function ($q) use ($user) {
                    $q->where('created_by', $user->id)->where('type', 1);
                }])
                ->withCount(['reactions as like_count' => function ($q) {
                    $q->where('type', 1);
                }])
                ->withCount('comments')
                ->withCount('shares')
                ->orderby('created_at', 'desc')
                ->paginate($limit);

            $data = $this->paginateData($posts, $posts->items());
            return $this->response(true, 'Posts found', $data, 200);
        } catch (\Exception $e) {
            return $this->response(false, $e->getMessage(), null, 500);
        }
    }
}
