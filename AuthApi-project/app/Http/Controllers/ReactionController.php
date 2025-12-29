<?php

namespace App\Http\Controllers;

use App\Jobs\AddReaction;
use App\Jobs\AddReactionToComment;
use App\Jobs\SendNotification;
use App\Models\CommentReply;
use App\Models\Comments;
use App\Models\Post;
use App\Models\Reel;
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
          $user->name . ' reacted to your post.',
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

      // Notification Logic: Notify Post Owner
      $comment = Comments::find($request->comment_id);
      if ($comment) {
          $post = Post::find($comment->post_id);
          if ($post && $post->user_id != $user->id) {
              SendNotification::dispatch(
                  $user->id,
                  'New Reaction on Comment',
                  $user->name . ' reacted to a comment on your post.',
                  $post->user_id,
                  $post,
                  'N'
              );
          }
      }

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

      // Notification Logic: Notify Post Owner
      $reply = CommentReply::find($request->comment_reply_id);
      if ($reply) {
          $comment = Comments::find($reply->comment_id);
          if ($comment) {
              $post = Post::find($comment->post_id);
              if ($post && $post->user_id != $user->id) {
                  SendNotification::dispatch(
                      $user->id,
                      'New Reaction on Reply',
                      $user->name . ' reacted to a reply on your post.',
                      $post->user_id,
                      $post,
                      'N'
                  );
              }
          }
      }

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
                  ->with('creator.profile.avatar') 
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
  public function getCommentReactions(Request $request)
  {
    $this->validateRequest($request, [
      'comment_id' => 'required|integer|exists:comments,id',
      'type' => 'integer|in:1,0',
    ]);

    try {
      $type = $request->input('type', 1);
      $limit = $request->input('limit', 20);

      $comment = Comments::find($request->comment_id);
      if (!$comment) {
        return $this->response(false, 'Comment not found', null, 404);
      }
      
      $reactions = $comment->reactions()
            ->where('type', $type)
            ->with('creator.profile.avatar') 
            ->paginate($limit);

      $users = $reactions->map(function ($reaction) {
          return $reaction->creator;
      })->filter()->values();
      
      $data = $this->paginateData($reactions, $users);

      return $this->response(true, 'Reactions fetched successfully', $data, 200);
    } catch (Exception $e) {
      return $this->response(false, $e->getMessage(), null, 500);
    }
  }

  public function getReplyReactions(Request $request)
  {
    $this->validateRequest($request, [
      'reply_id' => 'required|integer|exists:comments_replies,id',
      'type' => 'integer|in:1,0',
    ]);

    try {
      $type = $request->input('type', 1);
      $limit = $request->input('limit', 20);

      $reply = CommentReply::find($request->reply_id);
      if (!$reply) {
        return $this->response(false, 'Reply not found', null, 404);
      }
      
      $reactions = $reply->reactions()
            ->where('type', $type)
            ->with('creator.profile.avatar') 
            ->paginate($limit);

      $users = $reactions->map(function ($reaction) {
          return $reaction->creator;
      })->filter()->values();
      
      $data = $this->paginateData($reactions, $users);

      return $this->response(true, 'Reactions fetched successfully', $data, 200);
    } catch (Exception $e) {
      return $this->response(false, $e->getMessage(), null, 500);
    }
  }
  public function addReactiontoReel(Request $request)
  {
    $this->validateRequest($request, [
      'reel_id' => 'required|integer|exists:reels,id',
      'type' => 'required|integer|in:1,0',
    ]);
    try {
      $user = auth('api')->user();
      if (!$user) {
        return $this->response(false, 'Unauthorized', 401);
      }
      \App\Jobs\AddReelReaction::dispatch(
        (int) $user->id,
        (int) $request->reel_id,
        (int) $request->type,
      );

      // Notification Logic: Notify Reel Owner
      $reel = Reel::find($request->reel_id);
      if ($reel && $reel->user_id != $user->id) {
          SendNotification::dispatch(
              $user->id,
              'New Reaction',
              $user->name . ' reacted to your reel.',
              $reel->user_id,
              $reel,
              'N'
          );
      }

      return $this->response(true, 'Reaction added successfully', null, 200);
    } catch (Exception $e) {
      return $this->response(false, $e->getMessage(), null, 400);
    }
  }
}
