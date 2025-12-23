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
        'permissions' => 'required|array',
        'permissions.*' => 'string|exists:permissions,name',
        ]);
    try{
        // dd('working');
        $user = auth('api')->user();
        if (!$user) {
            return $this->unauthorized();
        }
        $role = Role::create([
            'name' => $request->name,
            'guard_name' => 'api'
        ]);
        $role->givePermissionTo($request->permissions);
        $role->load('permissions');
        return $this->response(true, 'Role created successfully', $role, 200);
    
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
            $role = Role::findOrFail($request->id);
            if($role->name == 'super-admin'){
                return $this->response(false, 'You cannot delete super-admin role', null, 400);
            }
            $role->delete();
            return $this->response(true, 'Role deleted successfully', null, 200);
        }catch(\Exception $e){
            Log::error("Error deleting role: ".$e->getMessage());
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    } 
    public function assign_role(Request $request){
            $this->validateRequest($request, [
            'role' => 'required|string',
            'user_id' => 'required|integer|exists:users,id',
            ]);
        try{
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $user = User::findOrFail($request->user_id);
            $user->syncRoles($request->role);
            return $this->response(true, 'Role assigned successfully', $user, 200);
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
            $user = User::findOrFail($request->user_id);
            $user->removeRole($request->role);
            return $this->response(true, 'Role revoked successfully', null, 200);
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
                $role->syncPermissions($request->permissions);
                $role->refresh();
                $data = [
                    'role' => $role->name,
                    'permissions' => $role->permissions->pluck('name'),
                ];
                return $this->response(true, 'Role permissions assigned successfully', $data, 200);
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
                $role->syncPermissions($request->permissions);
                $role->refresh();
                $data = [
                    'role' => $role->name,
                    'permissions' => $role->permissions->pluck('name'),
                ];
                return $this->response(true, 'Role permissions updated successfully', $data, 200);
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
                $role->revokePermissionTo($request->permissions);
                $role->refresh();
                $data = [
                    'role' => $role->name,
                    'permissions' => $role->permissions->pluck('name'),
                ];
                return $this->response(true, 'Role permissions revoked successfully', $data, 200);
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
                $user = User::findOrFail($request->user_id);
                $data = [
                    'role' => $user->getRoleNames(),
                    'permissions' => $user->getAllPermissions()->pluck('name')->unique(),
                ];
                return $this->response(true, 'Role permissions retrieved successfully', $data, 200);
            }catch(\Exception $e){
                Log::error("Error retrieving role permissions: ".$e->getMessage());
                return $this->Response(false, $e->getMessage(), null, 500);
            }
        }
        public function get_all_roles(){
        try{
            $roles = Role::where('guard_name', 'api')
            ->whereNotIn('name', ['super-admin', 'user'])
            ->get();
            return $this->response(true, 'Roles retrieved successfully', $roles, 200);
        }catch(\Exception $e){
            Log::error("Error retrieving roles: ".$e->getMessage());
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function get_all_permissions(){
            try{
                $permissions = Permission::all();
                return $this->response(true, 'Permissions retrieved successfully', $permissions, 200);
            }catch(\Exception $e){
                Log::error("Error retrieving permissions: ".$e->getMessage());
                return $this->Response(false, $e->getMessage(), null, 500);
            }
        }
    }
