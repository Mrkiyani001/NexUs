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
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
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
                return response()->json([
                    'success' => false,
                    'message' => 'Post not found',
                ], 404);
            }
            if ($post->user_id != $user->id) {
                return $this->unauthorized();
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
            return response()->json([
                'success' => true,
                'message' => 'Post update in progress',
                'data' => $newuploadfiles,
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
                return response()->json([
                    'success' => false,
                    'message' => 'Post not found',
                ], 404);
            }
            if ($post->user_id != $user->id) {
                return $this->unauthorized();
            }
            DeletePost::dispatch(
                $user->id,
                $request->id
            );
            return $this->response(true, 'Post deleted successfully', null, 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
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
                return response()->json([
                    'success' => false,
                    'message' => 'Post not found',
                ], 404);
            } else {
                $post->load('attachments', 'creator', 'updator', 'user.profile.avatar');
                return response()->json([
                    'success' => true,
                    'data' => $post,
                ], 200);
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
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
                'creator',
                'updator',
                'user.profile.avatar',
                'originalPost.creator',
                'originalPost.attachments',
                'user.followers' => function ($q) use ($user) {
                    $q->where('follower_id', $user->id)->where('status', 'accepted');
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
    public function PendingPosts()
    {
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $posts = Post::pending()->with('attachments', 'creator', 'updator', 'user.profile.avatar')->get();
            return response()->json([
                'success' => true,
                'data' => $posts,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
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
            $post = Post::withoutGlobalScopes()->find($request->id);

            if (!$post) {
                return response()->json([
                    'success' => false,
                    'message' => 'Post not found',
                ], 404);
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

            return response()->json([
                'success' => true,
                'data' => $post,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
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
            if ($user->hasRole(['admin', 'moderator', 'super admin']) == false) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not authorized to perform this action',
                ], 403);
            }
            $post = Post::withoutGlobalScopes()->find($request->id);

            if (!$post) {
                return response()->json([
                    'success' => false,
                    'message' => 'Post not found',
                ], 404);
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

            return response()->json([
                'success' => true,
                'data' => $post,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
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
                    ->orderby('created_at', 'desc')
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
                    ->orderby('created_at', 'desc')
                    ->paginate($limit);
            }

            $data = $this->paginateData($posts, $posts->items());
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
