<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

use Illuminate\Support\Facades\Log;

class AttachAuthToken
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if(!$request->bearerToken() && $request->cookie('jwt_token')){
            $token = $request->cookie('jwt_token');
            Log::info('AttachAuthToken: Cookie found', ['token_sub' => substr($token, 0, 10) . '...']);
            $request->headers->set('Authorization', 'Bearer ' . $token);
        } else {
             Log::info('AttachAuthToken: No cookie or already has token', ['has_cookie' => $request->hasCookie('jwt_token')]);
        }
        return $next($request);
    }
}
