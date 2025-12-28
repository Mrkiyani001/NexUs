<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\BaseController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Carbon\Carbon;

// use Illuminate\Support\Facades\DB;


class AuthController extends BaseController
{

    public function register(Request $request)
    {
        $this->validateRequest($request, [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:6|confirmed',
            'password_confirmation' => 'required|string|min:6',
        ]);
        try {
            // DB::beginTransaction();
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
            ]);
            $user->assignRole('user');
            // // DB::commit();
            // $token = auth('api')->login($user);
            // return $this->respondWithToken($token, $user);
            return response()->json([
                'success' => true,
                'message' => 'Registration successful! Please login to continue.',
                'data' => $user
            ], 201);
        } catch (\Exception $e) {
            // DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function login(Request $request)
    {
        $this->validateRequest($request, [
            'email' => 'required|string|email|max:255',
            'password' => 'required|string|min:6',
        ]);
        try {
            $user = User::where(['email' => $request->email])->first();
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found',
                ], 404);
            }
            if (!Hash::check($request->password, $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid credentials',
                ], 401);
            }

            if ($user->is_banned == 1) {
                return response()->json([
                    'success' => false,
                    'message' => 'Your account has been banned. Please contact support.',
                ], 403);
            }

            // Check Maintenance Mode
            $settings = \App\Models\Settings::first();
            if ($settings && $settings->maintenance_mode) {
                if (!$user->hasRole('super admin') && !$user->hasRole('admin')) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Service Unavailable. The site is currently in maintenance mode.',
                    ], 503);
                }
            }

            if (!$token = auth('api')->login($user)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized',
                ], 401);
            }
            return $this->respondWithToken($token, $user);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function getUser(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:users,id',
        ]);
        try {
            $login_user = auth('api')->user();
            if (!$login_user) {
                return $this->unauthorized();
            }
            $user = User::with(['roles', 'profile.avatar'])->find($request->id);
            if (is_null($user)) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found',
                ], 404);
            } 
            if($user->is_banned==1){
                return response()->json([
                    'success' => false,
                    'message' => 'User is banned',
                ], 403);
            }
            $fieldsToHide = ['password', 'remember_token', 'email_verified_at', 'show_email', 'roles'];
            // roles might be needed, but strictly hiding password/tokens is key.
            // Let's keep roles for now as frontend might need it for badges, but hide email if kept private.
            
            if ($login_user->id !== $user->id && !$user->show_email) {
                $fieldsToHide[] = 'email';
            }

            $user->makeHidden($fieldsToHide);
                return response()->json([
                    'success' => true,
                    'data' => $user,
                ], 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function get_all_users(Request $request)
    {
        try {
            $limit = (int) $request->input('limit', 10);
            $query = User::with(['roles', 'profile']);

            $users = $query->latest()->paginate($limit);
            $data = $this->paginateData($users, $users->items());

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

    public function filter_users(Request $request)
    {
        try {
            $limit = (int) $request->input('limit', 10);
            $query = User::with(['roles', 'profile']);

            // Filter logic
            if ($request->has('filter') && !empty($request->filter)) {
                $filter = $request->filter;
                if ($filter === 'banned') {
                    $query->where('is_banned', 1);
                } elseif ($filter === 'active') {
                    $query->where('is_banned', 0);
                } elseif ($filter === 'admins') {
                    $query->whereHas('roles', function ($q) {
                        $q->whereIn('name', ['admin', 'super-admin', 'super admin']);
                    });
                } elseif ($filter === 'moderators') {
                    $query->whereHas('roles', function ($q) {
                        $q->where('name', 'moderator');
                    });
                }
            }

            $users = $query->latest()->paginate($limit);
            $data = $this->paginateData($users, $users->items());

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
    public function update_user(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:users,id',
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|string|email|max:255|unique:users,email,' . $request->id,
            'password' => 'sometimes|string|min:6|confirmed',
            'password_confirmation' => 'sometimes|string|min:6',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $user = User::find($request->id);
            if (is_null($user)) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found',
                ], 404);
            } else {
                $user->fill($request->only(['name', 'email', 'password']));
            }
            if ($request->has('password')) {
                $user->password = Hash::make($request->password);
            }
            $user->save();
            $user->touch();
            return response()->json([
                'success' => true,
                'data' => $user,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function update_password(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:users,id',
            'current_password' => 'required|string|min:6',
            'password' => 'required|string|min:6|confirmed',
            'password_confirmation' => 'required|string|min:6',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $user = User::find($request->id);
            if (is_null($user)) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found',
                ], 404);
            } else {
                if (!HASH::check($request->current_password, $user->password)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Current password is incorrect',
                    ], 401);
                }
                $user->password = HASH::make($request->password);
                $user->save();
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function delete_user(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:users,id',
        ]);
        try {
            $login_user = auth('api')->user();
            if (!$login_user) {
                return $this->unauthorized();
            }
            $user = User::find($request->id);
            if (is_null($user)) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found',
                ], 404);
            } else {
                if($login_user->id != $user->id){
                    return response()->json([
                        'success' => false,
                        'message' => 'You are not authorized to delete this user',
                    ], 401);
                }
                    $user->posts()->delete();
                    $user->reels()->delete();
                    $user->delete();
                    return response()->json([
                    'success' => true,
                    'message' => 'User deleted successfully',
                ], 200);
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    public function logout()
    {
        $user = auth('api')->user();
        if (!$user) {
            return $this->unauthorized();
        }
        auth('api')->logout();
        return response()->json(['message' => 'Successfully logged out']);
    }
    public function refresh_token()
    {
        $user = auth('api')->user();
        if (!$user) {
            return $this->unauthorized();
        }
        if ($user->is_banned == 1) {
            auth('api')->logout(); // Invalidate the token immediately
            return response()->json(['error' => 'Your account has been banned. Please contact support.'], 403);
        }
        $token = auth('api')->refresh();
        return $this->respondWithToken($token, $user);
    }
    public function search_user(Request $request)
    {
        $this->validateRequest($request, [
            'search' => 'required|string',
        ]);
        try {
            $limit = (int) $request->input('limit', 10);
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $search = $request->search;
            $users = User::with(['roles', 'profile'])
                ->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%");
                })
                ->paginate($limit);
            $data = $this->paginateData($users, $users->items());
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
    public function forget_password(Request $request)
    {
        $this->validateRequest($request, [
            'email' => 'required|string|email|max:255',
        ]);
        if (User::where('email', $request->email)->exists()) {
            $user = User::where('email', $request->email)->first();
            $token = Str::random(60);
            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $request->email],
                [
                    'token' => $token,
                    'created_at' => now()
                ]
            );
            $resetLink = "http://localhost:3000/create-new-pass.html?token=" . $token . "&email=" . $request->email;
            Mail::send([], [], function ($message) use ($request, $resetLink) {
                $message->to($request->email)
                    ->subject('Reset Your Password')
                    ->html("
                    <h2>Password Reset Request</h2>
                    <p>Click the button below to reset your password:</p>
                    <a href='$resetLink' style='background: blue; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>Reset Password</a>
                    <p>Or copy this link: $resetLink</p>
                ");
            });
            return response()->json([
                'success' => true,
                'message' => 'Forget password token sent successfully',
            ], 200);
        }
    }

    public function reset_password(Request $request)
    {
        $this->validateRequest($request, [
            'token' => 'required|string',
            'email' => 'required|email|exists:users,email',
            'password' => 'required|string|min:6|confirmed',
            'password_confirmation' => 'required|string|min:6',
        ]);

        try {
            $resetRecord = DB::table('password_reset_tokens')
                ->where('email', $request->email)
                ->where('token', $request->token)
                ->first();

            if (!$resetRecord) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid or expired password reset token.',
                ], 400);
            }

            // Check if token is expired (older than 2 minutes)
            $tokenCreatedAt = Carbon::parse($resetRecord->created_at);
            if ($tokenCreatedAt->addMinutes(2)->isPast()) {
                DB::table('password_reset_tokens')->where('email', $request->email)->delete();
                return response()->json([
                    'success' => false,
                    'message' => 'Password reset link has expired (2 minute limit). Please request a new one.',
                ], 400);
            }

            $user = User::where('email', $request->email)->first();
            $user->password = Hash::make($request->password);
            $user->save();

            DB::table('password_reset_tokens')->where('email', $request->email)->delete();

            return response()->json([
                'success' => true,
                'message' => 'Password reset successful! You can now login.',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
