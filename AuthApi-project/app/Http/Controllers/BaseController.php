<?php

namespace App\Http\Controllers;

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
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
    protected function respondWithToken($token, $user)
    {
        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->getRoleNames(),
            ]
        ]);
    }


    public function upload($file, $folder, $model)
    {
        $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
        $filepath = $file->storeAs($folder, $filename, 'public');
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
        $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
        $documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
        $videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv'];
        $audioExtensions = ['mp3', 'wav', 'aac'];

        if (in_array($extension, $imageExtensions)) {
            return 'image';
        } elseif (in_array($extension, $documentExtensions)) {
            return 'document';
        } elseif (in_array($extension, $videoExtensions)) {
            return 'video';
        } elseif (in_array($extension, $audioExtensions)) {
            return 'audio';
        } else {
            return 'other';
        }
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
    public function paginateData($paginate, $data){
        return [
            'items' => $data,
            'pagination' => [
                'total' => $paginate->total(),
                'per_page' => $paginate->perPage(),
                'current_page' => $paginate->currentPage(),
                'last_page' => $paginate->lastPage(),
            ]
        ];
    }
}
