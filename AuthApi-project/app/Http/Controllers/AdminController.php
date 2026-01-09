<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class AdminController extends BaseController
{
    public function stats()
    {
        try {
            $user = auth('api')->user();
            if (!$user->hasRole(['super admin','Admin','Moderator'])) {
                return $this->NotAllowed();
            }
            $totalUsers = User::count();
            $newUsersToday = User::whereDate('created_at', Carbon::today())->count();
            $bannedUsers = User::where('is_banned', 1)->count();
            
            // Calculate trends (simple mock or actual implementation)
            // For now, let's keep it simple or implement yesterday comparison
            $newUsersYesterday = User::whereDate('created_at', Carbon::yesterday())->count();
            
            // Avoid division by zero
            $growth = 0;
            if($newUsersYesterday > 0) {
                $growth = (($newUsersToday - $newUsersYesterday) / $newUsersYesterday) * 100;
            } else if ($newUsersToday > 0) {
                $growth = 100;
            }

            return $this->Response(true, 'Stats retrieved', [
                'total_users' => $totalUsers,
                'new_users_today' => $newUsersToday,
                'banned_users' => $bannedUsers,
                'growth_percentage' => round($growth, 1)
            ], 200);

        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    public function banUser(Request $request)
    {
        $this->validateRequest($request, [
            'user_id' => 'required|exists:users,id',
            'action' => 'required|in:ban,unban'
        ]);

        try {
            $currentUser = auth('api')->user();
            if (!$currentUser->hasRole(['super admin','Admin','Moderator'])) {
                return $this->NotAllowed();
            }
            // Prevent banning self
            if ($request->user_id == $currentUser->id) {
                return $this->Response(false, 'You cannot ban yourself', null, 403);
            }

            $targetUser = User::findOrFail($request->user_id);
            
            // Protection: Cannot ban super-admin
            if ($targetUser->hasRole('super admin')) {
                return $this->NotAllowed();
            }
            
            // Only Super Admin or Admin can ban users
            // Moderators shouldn't ban users based on typical hierarchy, but user included 'moderator' in the initial check
            // However, the internal check `if($user->hasRole(['super admin','admin']))` (lines 70 in original) 
            // used the WRONG variable ($user was overwritten to targetUser).
            // It seems the intention matches other controllers: checks depend on who is doing the banning.

            $authorized = false;
            // Super admin can ban anyone (except other super admins, checked above)
            if ($currentUser->hasRole('super admin')) {
                $authorized = true;
            } 
            // Admins can ban anyone who is NOT an admin or super admin
            elseif ($currentUser->hasRole('Admin')) {
                if (!$targetUser->hasRole(['Admin', 'super admin'])) {
                    $authorized = true;
                }
            }
            // Moderators usually can't ban users, only content. 
            // The original code had `if($user->hasRole(['super admin','admin']))` causing valid bans to fail if $user referred to targetUser (who is likely just 'user').
            // If the original code meant "If the ACTING user is admin/super admin", then moderators are excluded.
            
            if (!$authorized) {
                 return $this->NotAllowed();
            }

            $targetUser->is_banned = ($request->action === 'ban' ? 1 : 0);
            $targetUser->save();

            return $this->Response(true, 'User ' . $request->action . 'ned successfully', $targetUser, 200);

        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
}
