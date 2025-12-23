<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Notifications\Notifiable;

class NotificationController extends BaseController
{
    public function getUsersNotification(Request $request)
    {
        try {
            $limit = (int) $request->input('limit', 10);
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $notifications = Notification::where('user_id', $user->id)
                ->with('notifiable')
                ->latest()
                ->paginate($limit);
            
            $data = $this->paginateData($notifications, $notifications->items());
            return $this->Response(true, 'Notifications Fetched Successfully', $data, 200);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function getAdminNotification(Request $request)
    {
        try {
            $limit = (int) $request->input('limit', 10);
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $notifications = Notification::where('for_admin', 'Y')->with('notifiable')->latest()->paginate($limit);
            
            $data = $this->paginateData($notifications, $notifications->items());
            return $this->Response(true, 'Admin Notifications Fetched Successfully', $data, 200);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
}
