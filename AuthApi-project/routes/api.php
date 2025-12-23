<?php

use App\Http\Controllers\AddViewController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CommentsController;
use App\Http\Controllers\CommentsRepliesController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReactionController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RolePermissionController;
use Illuminate\Support\Facades\Route;
use Prism\Prism\Facades\Prism;
use Prism\Prism\Enums\Provider;

// Route::get('/user', function (Request $request) {
//     return $request->user();
// })->middleware('auth:sanctum');
Route::post('/register', [AuthController::class, 'register']);
Route::post('login', [AuthController::class, 'login']);
Route::get('login', function () {
    return response()->json(['message' => 'Unauthorized'], 401);
})->name('login');

Route::post('forget_password', [AuthController::class, 'forget_password']);
Route::post('reset_password', [AuthController::class, 'reset_password']);

Route::get('/test-gemini', function () {
    try {
        $response = Prism::text()
            ->using(Provider::Gemini, 'gemini-flash-latest')
            ->withPrompt('Is this text safe? "I want to kill them." Answer with just Safe or Unsafe.')
            ->generate();

        return response()->json(['response' => $response->text]);
    } catch (\Exception $e) {
        return response()->json(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()], 500);
    }
});

Route::get('/gemini-models', function () {
    $key = env('GEMINI_API_KEY');
    $url = "https://generativelanguage.googleapis.com/v1beta/models?key=$key";
    $json = file_get_contents($url);
    $data = json_decode($json, true);

    $availableModels = [];
    if (isset($data['models'])) {
        foreach ($data['models'] as $model) {
            if (isset($model['supportedGenerationMethods']) && in_array('generateContent', $model['supportedGenerationMethods'])) {
                $availableModels[] = $model['name'];
            }
        }
    }
    return response()->json(['models' => $availableModels]);
});

Route::group(['middleware' => ['api', 'auth:api']], function ($router) {

    Route::prefix('role')->middleware('permission:manage access')->group(function () {
        Route::post('create_role', [RolePermissionController::class, 'create_role']);
        Route::post('delete_role', [RolePermissionController::class, 'delete_role']);
        Route::post('assign_role', [RolePermissionController::class, 'assign_role']);
        Route::post('revoke_role', [RolePermissionController::class, 'revoke_role']);
        Route::post('assign_role_permissions', [RolePermissionController::class, 'assign_role_permissions']);
        Route::post('update_role_permissions', [RolePermissionController::class, 'update_role_permissions']);
        Route::post('revoke_role_permissions', [RolePermissionController::class, 'revoke_role_permissions']);
    });
    Route::post('get_user_role_permissions', [RolePermissionController::class, 'get_user_role_permissions'])->middleware('permission:manage access|view access');
    Route::get('get_all_roles', [RolePermissionController::class, 'get_all_roles'])->middleware('permission:manage access|view access');
    Route::get('get_all_permissions', [RolePermissionController::class, 'get_all_permissions'])->middleware('permission:manage access|view access');

    Route::post('approve_post', [PostController::class, 'Approved'])->middleware('permission:posts approve');
    Route::post('reject_post', [PostController::class, 'Rejected'])->middleware('permission:posts reject');
    Route::get('pending_posts', [PostController::class, 'PendingPosts'])->middleware('permission:posts view pending');
    

    //Search Bar
    Route::post('search_user', [AuthController::class, 'search_user']);
    // Profile 
    Route::post('view', [ProfileController::class, 'viewprofile']);
    Route::post('update_profile', [ProfileController::class, 'updateProfile']);
    Route::post('follow', [ProfileController::class, 'followUser']);
    Route::post('unfollow', [ProfileController::class, 'unfollowUser']);
    Route::post('fetch_followers', [ProfileController::class, 'fetchFollower']);
    Route::post('fetch_following', [ProfileController::class, 'fetchFollowing']);

    // User Routes
    Route::post('logout', [AuthController::class, 'logout']);
    Route::post('refresh', [AuthController::class, 'refresh_token']);
    Route::get('getallusers', [AuthController::class, 'get_all_users'])->middleware('permission:view access|manage access');
    Route::post('getUser', [AuthController::class, 'getUser']);
    Route::put('updateUser', [AuthController::class, 'update_user']);
    Route::post('updatePassword', [AuthController::class, 'update_password']);
    Route::delete('delete_user', [AuthController::class, 'delete_user']);

    // Post Routes
    Route::post('create_post', [PostController::class, 'create'])->middleware('permission:create posts');
    Route::post('update_post', [PostController::class, 'update'])->middleware('permission:update posts');
    Route::delete('delete_post', [PostController::class, 'destroy'])->middleware('permission:delete posts');
    Route::post('get_post', [PostController::class, 'get_post'])->middleware('permission:view posts');
    Route::get('get_all_posts', [PostController::class, 'get_all_posts'])->middleware('permission:view posts');
    Route::post('get_posts_by_user', [PostController::class, 'get_posts_by_user'])->middleware('permission:view posts');
    // Comment Routes
    Route::post('create_comment', [CommentsController::class, 'create'])->middleware('permission:comments create');
    Route::post('update_comment', [CommentsController::class, 'update'])->middleware('permission:comments update');
    Route::delete('delete_comment', [CommentsController::class, 'destroy'])->middleware('permission:comments delete');
    Route::post('get_comment', [CommentsController::class, 'get_comments_by_post'])->middleware('permission:view posts');
    // Comment Reply Routes
    Route::post('create_comment_reply', [CommentsRepliesController::class, 'create'])->middleware('permission:replies create');
    Route::post('update_comment_reply', [CommentsRepliesController::class, 'update'])->middleware('permission:replies update');
    Route::delete('delete_comment_reply', [CommentsRepliesController::class, 'destroy'])->middleware('permission:replies delete');
    Route::post('get_comment_replies', [CommentsRepliesController::class, 'get_replies_by_comment'])->middleware('permission:view posts');

    // Reaction Routes
    Route::post('add_reaction_to_post', [ReactionController::class, 'addReactiontoPost'])->middleware('permission:react on post');
    Route::post('add_reaction_to_comment', [ReactionController::class, 'addReactiontoComment'])->middleware('permission:react on comment');
    Route::post('add_reaction_to_comment_reply', [ReactionController::class, 'addReactiontoCommentReply'])->middleware('permission:react on reply');
    Route::post('get_post_reactions', [ReactionController::class, 'getPostReactions']);

    // View Routes
    Route::post('add_view_to_post', [AddViewController::class, 'addView'])->middleware('permission:view posts');

    // Report Routes
    Route::post('report_content', [ReportController::class, 'createReport']);
    Route::get('get_reports', [ReportController::class, 'getReports'])->middleware('permission:reports view');
    Route::post('resolve_report', [ReportController::class, 'resolveReport'])->middleware('permission:reports resolve');

    // Notification Routes
    Route::get('get_user_notifications', [NotificationController::class, 'getUsersNotification']);
    Route::get('get_admin_notifications', [NotificationController::class, 'getAdminNotification']);
});
