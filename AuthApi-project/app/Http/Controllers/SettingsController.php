<?php

namespace App\Http\Controllers;

use App\Models\Settings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class SettingsController extends BaseController
{
    /**
     * Get the current site settings.
     */
    public function index()
    {
        $settings = Settings::get();
        return $this->Response(true, 'Settings retrieved successfully', $settings, 200);
    }

    /**
     * Update site settings.
     */
    public function update(Request $request)
    {
        $this->validateRequest($request, [
            'site_name' => 'nullable|string|max:255',
            'site_description' => 'nullable|string',
            'support_email' => 'nullable|email',
            'theme_color' => 'nullable|string|max:7',
            'maintenance_mode' => 'nullable|boolean',
            'allow_registration' => 'nullable|boolean',
            'email_verification' => 'nullable|boolean',
            'logo' => 'nullable|image|max:2048', // 2MB Max
            'favicon' => 'nullable|image|max:1024',
        ]);
        try{
        $user = auth('api')->user();
        if (!$user) {
            return $this->unauthorized();
        }
        if (!$user->hasRole(['super admin'])) {
            return $this->NotAllowed();
        }
        
        if($user->hasRole(['super admin'])){
            $settings = Settings::retrieve();
            $data = $request->except(['logo', 'favicon']);

            // Handle File Uploads
        if ($request->hasFile('logo')) {
            $path = $request->file('logo')->store('site_assets', 'public');
            $data['logo'] = $path;
        }

        if ($request->hasFile('favicon')) {
            $path = $request->file('favicon')->store('site_assets', 'public');
            $data['favicon'] = $path;
        }
        
        // Handle Booleans (because FormData sends strings "true"/"false" or "1"/"0")
        if ($request->has('maintenance_mode')) $data['maintenance_mode'] = filter_var($request->maintenance_mode, FILTER_VALIDATE_BOOLEAN);
        if ($request->has('allow_registration')) $data['allow_registration'] = filter_var($request->allow_registration, FILTER_VALIDATE_BOOLEAN);
        if ($request->has('email_verification')) $data['email_verification'] = filter_var($request->email_verification, FILTER_VALIDATE_BOOLEAN);

        $settings->update($data);

        return $this->Response(true, 'Settings updated successfully', $settings, 200);
    }
    }catch(\Exception $e){
        return $this->Response(false, $e->getMessage(), null, 500);
    }
}
}
