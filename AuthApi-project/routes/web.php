<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});
Route::get('/test-job', function () {
    \App\Jobs\TestQueueJob::dispatch();
    return "job dispatched";
});


