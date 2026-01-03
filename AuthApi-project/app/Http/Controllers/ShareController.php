<?php

namespace App\Http\Controllers;

use App\Http\Controllers\BaseController;
use App\Models\Share;
use Exception;
use Illuminate\Http\Request;

class ShareController extends BaseController
{
    public function sharePost(Request $request){
        $this->validateRequest($request, [
        'post_id' => 'required|exists:post,id',
        ]);
        try{
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $share = Share::create([
                'user_id' => $user->id,
                'post_id' => $request->post_id,
            ]);
            return $this->Response(true, 'Post shared successfully', $share, 200);
        }catch(Exception $e){
            return $this->Response(false, $e->getMessage(), null, 500);
        }

}
    public function shareReel(Request $request){
        $this->validateRequest($request, [
        'reel_id' => 'required|exists:reels,id',
        ]);
        try{
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $share = Share::create([
                'user_id' => $user->id,
                'reel_id' => $request->reel_id,
            ]);
            return $this->Response(true, 'Reel shared successfully', $share, 200);
        }catch(Exception $e){
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
}
