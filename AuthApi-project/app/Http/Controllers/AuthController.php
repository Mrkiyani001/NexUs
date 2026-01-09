<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\BaseController;
use App\Models\Settings;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Illuminate\Auth\Events\Verified;

class AuthController extends BaseController
{

    public function register(Request $request)
    {
        $this->validateRequest($request, [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'password_confirmation' => 'required|string|min:8',
        ]);
        try {
            // DB::beginTransaction();
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
            ]);
            $user->assignRole('user');
            
            // Send email verification notification (optional - won't fail registration if email not configured)
            try {
                $user->sendEmailVerificationNotification();
                $message = 'Registration successful! Please check your email to verify your account.';
            } catch (\Exception $emailError) {
                Log::warning('Email verification could not be sent: ' . $emailError->getMessage());
                $message = 'Registration successful! Please login to continue.';
            }
            
            // // DB::commit();
            // $token = auth('api')->login($user);
            // return $this->respondWithToken($token, $user);
            return $this->Response(true, $message, $user, 201);
        } catch (\Exception $e) {
            // DB::rollBack();
            return $this->Response(false, $e->getMessage(), null, 500);
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
                return $this->Response(false, 'User not found', null, 404);
            }
            if (!Hash::check($request->password, $user->password)) {
                return $this->Response(false, 'Invalid credentials', null, 401);
            }

            if ($user->is_banned == 1) {
                return $this->Response(false, 'Your account has been banned. Please contact support.', null, 403);
            }

            if ($user->status == 'Deactivated') {
                 $user->status = 'Active';
                 $user->save();
            }

            // Check Maintenance Mode
            $settings = Settings::first();
            if ($settings && $settings->maintenance_mode) {
                if (!$user->hasRole(['Admin','super admin','Moderator'])) {
                    return $this->Response(false, 'Service Unavailable. The site is currently in maintenance mode.', null, 503);
                }
            }

            if (!$token = auth('api')->login($user)) {
                return $this->unauthorized();
            }
            if (!$user->hasVerifiedEmail()) {
                auth('api')->logout();
                return $this->Response(false, 'User not verified', null, 401);
            }
            
            // Critical: Load roles and profile so frontend has them immediately
            $user->load('roles', 'profile');
            
            return $this->Response(true, 'User logged in successfully', $user, 200)->withCookie($this->getAuthCookie($token));
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    public function deactivate_account(Request $request) 
    {
         try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            
            $user->status = 'Deactivated';
            $user->save();
            
            auth('api')->logout();
            
            return $this->Response(true, 'Account deactivated successfully. Login to reactivate.', null, 200)->withCookie($this->getLogoutCookie());
         } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    public function verify_email(Request $request)
    {
        // $request->route('id') is the user ID
        $user = User::find($request->route('id'));

        if (!$user) {
             return $this->Response(false, 'Invalid verification link.', null, 400); 
        }

        if (! hash_equals((string) $request->route('hash'), sha1($user->getEmailForVerification()))) {
            return $this->Response(false, 'Invalid verification link.', null, 400);
        }

        if ($user->hasVerifiedEmail()) {
             // Redirect to frontend login with message
             return redirect()->to(env('APP_URL').'/login.html?verified=1');
        }

        if ($user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        return redirect()->to(env('APP_URL').'/login.html?verified=1');
    }

    public function resend_verification(Request $request)
    {
        $user = auth('api')->user();

        if ($user) {
            // Logged in user
        } else {
            // Public endpoint usage (optional, if we want to allow it by email)
            $this->validateRequest($request, [
                'email' => 'required|email|exists:users,email'
            ]);
            $user = User::where('email', $request->email)->first();
        }

        if (!$user) {
             return $this->Response(false, 'User not found.', null, 404);
        }

        if ($user->hasVerifiedEmail()) {
            return $this->Response(false, 'Email already verified.', null, 400);
        }

        $user->sendEmailVerificationNotification();

        return $this->Response(true, 'Verification link sent!');
    }

    public function getUser(Request $request)
    {
        try {
            $login_user = auth('api')->user();
            if (!$login_user) {
                return $this->unauthorized();
            }

            // If no ID provided, return the current logged-in user (Acts as /me)
            if (!$request->has('id')) {
                $login_user->load('roles', 'profile');
                return $this->Response(true, 'Current user', $login_user, 200);
            }

            $this->validateRequest($request, [
                'id' => 'required|integer|exists:users,id',
            ]);

            $user = User::with(['roles', 'profile.avatar'])->find($request->id);
            if (is_null($user)) {
                return $this->Response(false, 'User not found', null, 404);
            } 
            if($user->is_banned==1){
                return $this->Response(false, 'User is banned', null, 403);
            }
            $fieldsToHide = ['password', 'remember_token', 'email_verified_at', 'show_email'];
            // roles might be needed, but strictly hiding password/tokens is key.
            // Let's keep roles for now as frontend might need it for badges, but hide email if kept private.
            
            if ($login_user->id !== $user->id && !$user->show_email) {
                $fieldsToHide[] = 'email';
            }

            $user->makeHidden($fieldsToHide);
                return $this->Response(true, 'User found', $user, 200);
            
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    public function get_all_users(Request $request)
    {
        try {
            $login_user = auth('api')->user();
            if (!$login_user) {
                return $this->unauthorized();
            }
            $limit = (int) $request->input('limit', 10);
            $query = User::with(['roles', 'profile']);

            $users = $query->latest()->paginate($limit);
            $data = $this->paginateData($users, $users->items());

            return $this->Response(true, 'Users found', $data, 200);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    public function filter_users(Request $request)
    {
        try {
            $login_user = auth('api')->user();
            if (!$login_user) {
                return $this->unauthorized();
            }
            if(!$login_user->hasRole(['Admin','super admin','Moderator'])) {
                return $this->NotAllowed();
            }
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
                        $q->whereIn('name', ['Admin', 'super admin']);
                    });
                } elseif ($filter === 'moderators') {
                    $query->whereHas('roles', function ($q) {
                        $q->whereIn('name', ['Moderator']);
                    });
                }
            }

            $users = $query->latest()->paginate($limit);
            $data = $this->paginateData($users, $users->items());

            return $this->Response(true, 'Users found', $data, 200);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function update_user(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:users,id',
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|string|email|max:255|unique:users,email,' . $request->id,
            'password' => 'sometimes|string|min:8|confirmed',
            'password_confirmation' => 'sometimes|string|min:8',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if($user->id!=$request->id){
                return $this->NotAllowed();
            }
            $user = User::find($request->id);
            if (is_null($user)) {
                return $this->Response(false, 'User not found', null, 404);
            } else {
                $user->fill($request->only(['name', 'email', 'password']));
            }
            if ($request->has('password')) {
                $user->password = Hash::make($request->password);
            }
            $user->save();
            $user->touch();
            return $this->Response(true, 'User updated', $user, 200);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    public function update_password(Request $request)
    {
        $this->validateRequest($request, [
            'id' => 'required|integer|exists:users,id',
            'current_password' => 'required|string|min:6',
            'password' => 'required|string|min:8|confirmed',
            'password_confirmation' => 'required|string|min:8',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if($user->id!=$request->id){
                return $this->NotAllowed();
            }
            $user = User::find($request->id);
            if (is_null($user)) {
                return $this->Response(false, 'User not found', null, 404);
            } else {
                if (!HASH::check($request->current_password, $user->password)) {
                    return $this->Response(false, 'Current password is incorrect', null, 401);
                }
                $user->password = HASH::make($request->password);
                $user->save();
            }
            return $this->Response(true, 'Password updated', null, 200);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
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
                return $this->Response(false, 'User not found', null, 404);
            }else{
            // Allows: If User is Owner OR User is Super Admin
            if ($login_user->id == $user->id || $login_user->hasRole(['super admin'])) {
                $user->posts()->delete();
                $user->reels()->delete();
                $user->delete();
                return $this->Response(true, 'User deleted successfully', null, 200);
            }

            return $this->NotAllowed();
        }
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function logout()
    {
        $user = auth('api')->user();
        if (!$user) {
            return $this->unauthorized();
        }
        auth('api')->logout();
        return $this->Response(true, 'Successfully logged out', null, 200)->withCookie($this->getLogoutCookie());
    }
    public function refresh_token()
    {
        $user = auth('api')->user();
        if (!$user) {
            return $this->unauthorized();
        }
        if ($user->is_banned == 1) {
            auth('api')->logout(); // Invalidate the token immediately
            return $this->Response(false, 'Your account has been banned. Please contact support.', null, 403)->withCookie($this->getLogoutCookie());
        }
        $token = auth('api')->refresh();
        $user->load('roles', 'profile'); // Return fresh user data
        return $this->Response(true, 'Token refreshed successfully', $user, 200)->withCookie($this->getAuthCookie($token));
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
            return $this->Response(true, 'Users found', $data, 200);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
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
            $resetLink = env('APP_URL').'/create-new-pass.html?token=' . $token . '&email=' . $request->email;
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
            return $this->Response(true, 'Forget password token sent successfully', null, 200);
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
                return $this->Response(false, 'Invalid or expired password reset token.', null, 400);
            }

            // Check if token is expired (older than 2 minutes)
            $tokenCreatedAt = Carbon::parse($resetRecord->created_at);
            if ($tokenCreatedAt->addMinutes(2)->isPast()) {
                DB::table('password_reset_tokens')->where('email', $request->email)->delete();
                return $this->Response(false, 'Password reset link has expired (2 minute limit). Please request a new one.', null, 400);
            }

            $user = User::where('email', $request->email)->first();
            $user->password = Hash::make($request->password);
            $user->save();

            DB::table('password_reset_tokens')->where('email', $request->email)->delete();

            return $this->Response(true, 'Password reset successfully! You can now login.', null, 200);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
}
