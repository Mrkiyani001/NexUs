<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionController extends BaseController
{
    public function create_role(Request $request){
        $this->validateRequest($request, [
        'name' => 'required|string|unique:roles,name',
        'permissions' => 'sometimes|array',
        'permissions.*' => 'string|exists:permissions,name',
        ]);
    try{
        // dd('working');
        $user = auth('api')->user();
        if (!$user) {
            return $this->unauthorized();
        }
        if (!$user->hasRole(['super admin'])) {
            return $this->NotAllowed();
        }
        $role = Role::create([
            'name' => $request->name,
            'guard_name' => 'api'
        ]);
        $role->givePermissionTo($request->permissions);
        $role->load('permissions');
        return $this->Response(true, 'Role created successfully', $role, 200);
    
    }catch(\Exception $e){
        Log::error("Error creating role: ".$e->getMessage());
        return $this->Response(false, $e->getMessage(), null, 500);
    }
}
    public function delete_role(Request $request){
        $this->validateRequest($request, [
        'id' => 'required|integer|exists:roles,id',
        ]);
        try{
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if (!$user->hasRole(['super admin','admin'])) {
                return $this->NotAllowed();
            }
            $role = Role::findOrFail($request->id);
            if($role->name == 'super-admin'){
                return $this->NotAllowed();
            } 
            $role->delete();
            return $this->Response(true, 'Role deleted successfully', null, 200);
        }catch(\Exception $e){
            Log::error("Error deleting role: ".$e->getMessage());
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    } 
    public function assign_role(Request $request){
            $this->validateRequest($request, [
            'role' => 'present|array',
            'user_id' => 'required|integer|exists:users,id',
            ]);
        try{
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $targetUser = User::findOrFail($request->user_id);
            
            $roles = $request->role;
            if (empty($roles)) {
                $roles = ['user'];
            }
            // Protection: Only Super Admin can assign Super Admin role
            if (in_array('super admin', $roles)) {
                if (!$user->hasRole('super admin')) {
                    return $this->NotAllowed();
                }
            }
            // syncRoles accepts string or array
            if($user->hasRole(['super admin','Admin'])){
                $targetUser->syncRoles($roles);
            }
            return $this->Response(true, 'Roles synced successfully', $targetUser, 200);
        }catch(\Exception $e){
            Log::error("Error assigning role: ".$e->getMessage());
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }   
    public function revoke_role(Request $request){
            $this->validateRequest($request, [
            'role' => 'required|string',
            'user_id' => 'required|integer|exists:users,id',
            ]);
        try{
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if (!$user->hasRole(['super admin'])) {
                return $this->Response(false, 'You are not allowed to revoke roles', null, 403);
            }
            $targetUser = User::findOrFail($request->user_id);
            if($targetUser->hasRole(['super admin'])){
                return $this->NotAllowed();
            }
            if($user->hasRole(['super admin','Admin'])){
                $targetUser->removeRole($request->role);
            }
            
            // Fallback: If user has no roles left, assign 'user' role
            if ($targetUser->roles()->count() == 0) {
                $targetUser->assignRole('user');
            }

            return $this->Response(true, 'Role revoked successfully', null, 200);
        }catch(\Exception $e){
            Log::error("Error revoking role: ".$e->getMessage());
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    } 
    public function assign_role_permissions(Request $request){
                $this->validateRequest($request, [
                'role_id' => 'required|integer|exists:roles,id',
                'permissions' => 'required|array',
                'permissions.*' => 'string|exists:permissions,name',
                ]);
            try{
                // dd('working');
                $user = auth('api')->user();
                if (!$user) {
                    return $this->unauthorized();
                }
                $role = Role::findOrFail($request->role_id);
                if(!$user->hasRole(['super admin'])){
                    return $this->NotAllowed();
                }
                $role->syncPermissions($request->permissions);
                
                $role->refresh();
                $data = [
                    'role' => $role->name,
                    'permissions' => $role->permissions->pluck('name'),
                ];
                return $this->Response(true, 'Role permissions assigned successfully', $data, 200);
            }catch(\Exception $e){
                Log::error("Error assigning role permissions: ".$e->getMessage());
                return $this->Response(false, $e->getMessage(), null, 500);
            }
        }
        public function update_role_permissions(Request $request){
                $this->validateRequest($request, [
                'role_id' => 'required|integer|exists:roles,id',
                'permissions' => 'required|array',
                'permissions.*' => 'string|exists:permissions,name',
                ]);
            try{
                $user = auth('api')->user();
                if (!$user) {
                    return $this->unauthorized();
                }
                $role = Role::findOrFail($request->role_id);
                if(!$user->hasRole(['super admin'])){
                    return $this->NotAllowed();
                }
                $role->syncPermissions($request->permissions);

                $role->refresh();
                $data = [
                    'role' => $role->name,
                    'permissions' => $role->permissions->pluck('name'),
                ];
                return $this->Response(true, 'Role permissions updated successfully', $data, 200);
            }catch(\Exception $e){
                Log::error("Error updating role permissions: ".$e->getMessage());
                return $this->Response(false, $e->getMessage(), null, 500);
            }
        }
        public function revoke_role_permissions(Request $request){
                $this->validateRequest($request, [
                'role_id' => 'required|integer|exists:roles,id',
                'permissions' => 'required|array',
                'permissions.*' => 'string|exists:permissions,name',
                ]);
            try{
                $user = auth('api')->user();
                if (!$user) {
                    return $this->unauthorized();
                }
                $role = Role::findOrFail($request->role_id);
                if(!$user->hasRole(['super admin'])){
                    return $this->NotAllowed();
                }
                $role->revokePermissionTo($request->permissions);

                $role->refresh();
                $data = [
                    'role' => $role->name,
                    'permissions' => $role->permissions->pluck('name'),
                ];
                return $this->Response(true, 'Role permissions revoked successfully', $data, 200);
            }catch(\Exception $e){
                Log::error("Error revoking role permissions: ".$e->getMessage());
                return $this->Response(false, $e->getMessage(), null, 500);
            }
        }
        public function get_user_role_permissions(Request $request){
                $this->validateRequest($request, [
                'user_id' => 'required|integer|exists:users,id',
                ]);
            try{
                $user = auth('api')->user();
                if (!$user) {
                    return $this->unauthorized();
                }
                if (!$user->hasRole(['super admin','Admin','Moderator'])) {
                    return $this->NotAllowed();
                }
                $user = User::findOrFail($request->user_id);
                $data = [
                    'role' => $user->getRoleNames(),
                    'permissions' => $user->getAllPermissions()->pluck('name')->unique(),
                ];
                return $this->Response(true, 'Role permissions retrieved successfully', $data, 200);
            }catch(\Exception $e){
                Log::error("Error retrieving role permissions: ".$e->getMessage());
                return $this->Response(false, $e->getMessage(), null, 500);
            }
        }
        public function get_all_roles(){
        try{
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if (!$user->hasRole(['super admin','Admin','Moderator'])) {
                return $this->NotAllowed();
            }
            $roles = Role::with('permissions')->where('guard_name', 'api')
            ->get();
            return $this->Response(true, 'Roles retrieved successfully', $roles, 200);
        }catch(\Exception $e){
            Log::error("Error retrieving roles: ".$e->getMessage());
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function get_all_permissions(){
            try{
                $user = auth('api')->user();
                if (!$user) {
                    return $this->unauthorized();
                }
                if (!$user->hasRole(['super admin','Admin','Moderator'])) {
                    return $this->NotAllowed();
                }
                $permissions = Permission::all();
                return $this->Response(true, 'Permissions retrieved successfully', $permissions, 200);
            }catch(\Exception $e){
                Log::error("Error retrieving permissions: ".$e->getMessage());
                return $this->Response(false, $e->getMessage(), null, 500);
            }
        }
    public function create_permission(Request $request)
    {
        $this->validateRequest($request, [
            'name' => 'required|string|unique:permissions,name',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if (!$user->hasRole(['super admin'])) {
                return $this->NotAllowed();
            }
            $permission = Permission::create(['name' => $request->name, 'guard_name' => 'api']);
            return $this->Response(true, 'Permission created successfully', $permission, 200);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }

    public function delete_permission(Request $request)
    {
        $this->validateRequest($request, [
            'name' => 'required|string|exists:permissions,name',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            if (!$user->hasRole(['super admin'])) {
                return $this->NotAllowed();
            }
            $permission = Permission::where('name', $request->name)->where('guard_name', 'api')->firstOrFail();
            $permission->delete();
            return $this->Response(true, 'Permission deleted successfully', null, 200);
        } catch (\Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
}
