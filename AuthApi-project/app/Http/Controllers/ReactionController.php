<?php

namespace App\Http\Controllers;

use App\Jobs\AddReaction;
use App\Jobs\AddReactionToComment;
use App\Jobs\SendNotification;
use App\Models\Post;
use Exception;
use Illuminate\Http\Request;

class ReactionController extends BaseController
{
  public function addReactiontoPost(Request $request)
  {
    $this->validateRequest($request, [
      'post_id' => 'required|integer|exists:post,id',
      'type' => 'required|integer|in:1,0',
    ]);
    try {
      $user = auth('api')->user();
      if (!$user) {
        return $this->response(false, 'Unauthorized', 401);
      }

      // ...

      AddReaction::dispatch(
        (int) $user->id,
        (int) $request->post_id,
        (int) $request->type,
      );

      // Notification Logic
      $post = Post::find($request->post_id);
      if ($post && $post->user_id != $user->id) { // Don't notify if reacting to own post
        SendNotification::dispatch(
          $user->id,
          'New Reaction',
          'User ' . $user->id . ' reacted to your post.',
          $post->user_id,
          $post,
          'N'
        );
      }

      return $this->response(true, 'Reaction added successfully', null, 200);
    } catch (Exception $e) {
      return $this->response(false, $e->getMessage(), null, 400);
    }
  }
  public function addReactiontoComment(Request $request)
  {
    $this->validateRequest($request, [
      'comment_id' => 'required|integer|exists:comments,id',
      'type' => 'required|integer|in:1,0',
    ]);
    try {
      $user = auth('api')->user();
      if (!$user) {
        return $this->response(false, 'Unauthorized', 401);
      }
      AddReactionToComment::dispatch(
        (int) $user->id,
        (int) $request->comment_id,
        (int) $request->type,
      );
      return $this->response(true, 'Reaction added successfully', null, 200);
    } catch (Exception $e) {
      return $this->response(false, $e->getMessage(), null, 400);
    }
  }
  public function addReactiontoCommentReply(Request $request)
  {
    $this->validateRequest($request, [
      'comment_reply_id' => 'required|integer|exists:comments_replies,id',
      'type' => 'required|integer|in:1,0',
    ]);
    try {
      $user = auth('api')->user();
      if (!$user) {
        return $this->response(false, 'Unauthorized', 401);
      }
      AddReaction::dispatch(
        (int) $user->id,
        (int) $request->comment_reply_id,
        (int) $request->type,
      );
      return $this->response(true, 'Reaction added successfully', null, 200);
    } catch (Exception $e) {
      return $this->response(false, $e->getMessage(), null, 400);
    }
  }

  public function getPostReactions(Request $request)
  {
    $this->validateRequest($request, [
      'post_id' => 'required|integer|exists:post,id',
      'type' => 'integer|in:1,0', // 1 for like, 0 for dislike (optional)
    ]);

    try {
      $type = $request->input('type', 1); // Default to likes
      $limit = $request->input('limit', 20);

            $post = Post::find($request->post_id);
            if (!$post) {
                return $this->response(false, 'Post not found', null, 404);
            }
            
            // Get reactions with user data
            $reactions = $post->reactions()
                  ->where('type', $type)
                  ->with('creator:id,name') 
                  ->paginate($limit);

            // Extract users from reactions and filter out nulls
            $users = $reactions->map(function ($reaction) {
                return $reaction->creator;
            })->filter()->values();
            
             $data = $this->paginateData($reactions, $users);

      return $this->response(true, 'Reactions fetched successfully', $data, 200);
    } catch (Exception $e) {
      return $this->response(false, $e->getMessage(), null, 500);
    }
  }
}
