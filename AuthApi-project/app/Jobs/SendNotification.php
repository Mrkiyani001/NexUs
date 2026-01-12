<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Models\User;
use App\Services\GoogleAccessTokenService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendNotification implements ShouldQueue
{
    use Queueable, Dispatchable, SerializesModels, InteractsWithQueue;
    protected $CreatorId;
    protected $title;
    protected $text;
    protected ?int $user_id;
    protected $notifiable;
    protected $for_admin;
    public function __construct($CreatorId, $title, $text, $user_id = null, $notifiable = null, $for_admin)
    {
        $this->CreatorId = $CreatorId;
        $this->title = $title;
        $this->text = $text;
        $this->user_id = $user_id;
        $this->notifiable = $notifiable;
        $this->for_admin = $for_admin;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info("SendNotification Job Started", [
            'CreatorId' => $this->CreatorId,
            'RecipientId' => $this->user_id,
            'Title' => $this->title,
            'ForAdmin' => $this->for_admin
        ]);

        try {
            $notification = new Notification();
            $notification->title = $this->title;
            $notification->text = $this->text;
            if ($this->notifiable) {
                if (is_array($this->notifiable) && isset($this->notifiable['type'], $this->notifiable['id'])) {
                    $notification->notifiable_type = $this->notifiable['type'];
                    $notification->notifiable_id = $this->notifiable['id'];
                } else {
                    $notification->notifiable()->associate($this->notifiable);
                }
            }
            $notification->user_id = $this->user_id;
            $notification->for_admin = $this->for_admin;
            $notification->created_by = $this->CreatorId;
            $notification->updated_by = $this->CreatorId;
            $notification->save();

            Log::info("Notification Saved Successfully", ['id' => $notification->id]);

            // --- FCM Logic (V1 API) ---
            if ($this->user_id) {
                $user = User::find($this->user_id);
                if ($user && $user->fcm_token) {
                    
                    try {
                        $accessToken = GoogleAccessTokenService::getToken();
                        
                        if ($accessToken) {
                            $projectId = env('FIREBASE_PROJECT_ID');
                            $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
                            
                            $data = [
                                "message" => [
                                    "token" => $user->fcm_token,
                                    "notification" => [
                                        "title" => $this->title,
                                        "body" => $this->text,
                                    ],
                                    "data" => [
                                        "click_action" => "https://web.kiyanibhai.site/active-conversations.html",
                                        "icon" => "/assets/logo-small.png"
                                    ]
                                ]
                            ];
                            
                            $ch = curl_init();
                            curl_setopt($ch, CURLOPT_URL, $url);
                            curl_setopt($ch, CURLOPT_POST, true);
                            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                                'Authorization: Bearer ' . $accessToken,
                                'Content-Type: application/json'
                            ]);
                            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
                            
                            $result = curl_exec($ch);
                            if ($result === FALSE) {
                                Log::error('FCM Send Error: ' . curl_error($ch));
                            } else {
                                Log::info('FCM Send Result: ' . $result);
                            }
                            curl_close($ch);
                        } else {
                            Log::error('Failed to get Google Access Token');
                        }
                    } catch (\Exception $fcmError) {
                        Log::error('FCM Service Error: ' . $fcmError->getMessage());
                    }
                }
            }
            // -----------------

        } catch (\Exception $e) {
            Log::error('Failed to send notification: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
        }
    }
}
