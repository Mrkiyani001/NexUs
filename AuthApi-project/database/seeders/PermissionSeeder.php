<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Define all permissions
        $all_permissions = [
            'view posts',
            'create posts',
            'update posts',
            'delete posts',
            'posts view pending',
            'posts approve',
            'posts reject',
            'flagged post',
            'dismiss flagged post',
            
            'comments create',
            'comments update',
            'comments delete',
            
            'replies create',
            'replies update',
            'replies delete',
            'react on post',
            'react on comment',
            'react on reply',
            
            'reports view',
            'reports resolve',
            'create email template',
            'update email template',
            'delete email template',
            'view access page',
            'manage access'
        ];

        foreach ($all_permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'api']);
        }
    }
}