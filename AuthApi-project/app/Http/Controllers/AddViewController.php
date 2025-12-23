<?php

namespace App\Http\Controllers;

use App\Jobs\AddView;
use Exception;
use Illuminate\Http\Request;

class AddViewController extends BaseController
{
 public function addView(Request $request){
    $this->validateRequest($request, [
        'post_id' => 'required|integer|exists:post,id',
    ]);
    try{
    $user = auth('api')->user();
    if(!$user){
        return $this->Response(false, 'Unauthorized',401);
    }
    AddView::dispatch(
        (int) $user->id,
        (int) $request->post_id,
    );
    return $this->Response(true, 'View added successfully', null, 200);
 }catch(Exception $e){
    return $this->Response(false, $e->getMessage(), null, 400);
}
 }
}
