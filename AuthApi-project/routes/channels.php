<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('chat.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});  // is ma channel ka andr chat is lya likhta ha bcz jo hum event ma chat.{id} send kr rhi hain broadcast ma
    
