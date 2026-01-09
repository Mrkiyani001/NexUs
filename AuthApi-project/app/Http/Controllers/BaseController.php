<?php

namespace App\Http\Controllers;

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class BaseController extends Controller
{
    public function validateRequest(Request $request, array $rules)
    {
        $Validator = Validator::make($request->all(), $rules);
        if ($Validator->fails()) {

            abort(response()->json([
                'success' => false,
                'message' => 'Validation Error.',
                'errors'  => $Validator->errors()->first(),
            ], 422));
        }
        return true;
    }
    public function NotAllowed(){
        return response()->json([
            'success' => false,
            'message' => 'You are not authorized to perform this action.',
        ], 403);
    }
    protected function respondWithToken($token, $user)
    {
        // Ensure profile and avatar are loaded
        $user->load('profile.avatar');

        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->getRoleNames(),
                'profile' => $user->profile, // Include full profile relationship
                'avatar_url' => $user->profile && $user->profile->avatar ? $user->profile->avatar->file_path : null,
            ]
        ]);
    }


    public function upload($file, $folder, $model)
    {
        $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
        $file->move(public_path('storage/' . $folder), $filename);
        $filepath = 'storage/' . $folder . '/' . $filename;
        $extension = strtolower($file->getClientOriginalExtension());
        $type = $this->getFileType($extension);
        $model->attachments()->create([
            'file_name' => $filename,
            'file_path' => $filepath,
            'file_type' => $type,
        ]);
    }
    private function getFileType($extension)
    {
       $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'];
       $documentExtensions = [
        'pdf', 
        'doc', 'docx',       // Word
        'xls', 'xlsx', 'csv', // Excel
        'ppt', 'pptx',       // PowerPoint
        'txt', 'rtf', 'json' // Text/Data
    ];
    $videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', '3gp'];
    $audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'amr'];
    $archiveExtensions = ['zip', 'rar', '7z'];
        if (in_array($extension, $imageExtensions)) {
            return 'image';
        } elseif (in_array($extension, $documentExtensions)) {
            return 'document';
        } elseif (in_array($extension, $videoExtensions)) {
            return 'video';
        } elseif (in_array($extension, $audioExtensions)) {
            return 'audio';
        } elseif(in_array($extension, $archiveExtensions)){
            return 'archive';
        }else{
            return 'other';
        }
    }
    public function uploadReel($file, $folder, $model, $extraData = [])
    {
        $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
        $file->move(public_path('storage/' . $folder), $filename);
        $filepath = 'storage/' . $folder . '/' . $filename;
        $extension = strtolower($file->getClientOriginalExtension());
        $type = $this->getFileType($extension);
        
        $data = array_merge([
            'file_name' => $filename,
            'video_path' => $filepath, 
            'file_type' => $type,
            'duration' => null, 
        ], $extraData);

        return $model->reels()->create($data);
    }
    public function Response(bool $success, string $message, $data = null, int $code = 200)
    {
        $response = [
            'success' => $success,
            'message' => $message,
        ];
        if (!is_null($data)) {
            $response['data'] = $data;
        }
        return response()->json($response, $code);
    }
    public function unauthorized()
    {
        return response()->json([
            'success' => false,
            'message' => 'Unauthorized',
        ], 401);
    }
    public function paginateData($paginate, $data)
    {
        return [
            'items' => $data,
            'pagination' => [
                'total' => $paginate->total(),
                'per_page' => $paginate->perPage(),
                'current_page' => $paginate->currentPage(),
                'last_page' => $paginate->lastPage(),
                'from' => $paginate->firstItem(),
                'to' => $paginate->lastItem(),
                'total_pages' => $paginate->lastPage(),
            ]
        ];
    }
    protected function getAuthCookie($token)
    {
        $isLocal = in_array(request()->getHost(), ['localhost', '127.0.0.1']);
        
        // Local (HTTP): Lax + Secure=False (Best for localhost:5500 -> localhost:8000)
        // Production (HTTPS): Lax + Secure=True
        
        $secure = $isLocal ? false : true; 
        $sameSite = 'Lax';

        return cookie(
            'jwt_token',
            $token,
            60 * 24,
            null, // Path
            null, // Domain
            $secure,
            true, // HttpOnly
            false, // Raw
            $sameSite
        );
    }
protected function getLogoutCookie()
    {
        // Cookie ko "forget" karna asal mein usay expire kar dena hota hai
        return Cookie::forget('jwt_token');
    }
}
