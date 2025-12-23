<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $user_permission = [
            'create posts',
            'update posts',
            'delete posts',
            'view posts',
            'react on post',
            'react on comment',
            'react on reply',
            'comments create',
            'comments update',
            'comments delete',
            'replies create',
            'replies update',
            'replies delete'
           ];
        
        $role = Role::firstOrCreate(['name' => 'super admin', 'guard_name' => 'api']);
        $role->givePermissionTo(Permission::all());

        $role = Role::firstOrCreate(['name' => 'user', 'guard_name' => 'api']);
        $role->givePermissionTo($user_permission);
    }       
}
