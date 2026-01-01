/**
 * Admin Utilities for Social Platform
 * Handles permissions, shared UI components, and common admin actions.
 */

const ADMIN_TOKEN = localStorage.getItem('auth_token');
const ADMIN_USER_DATA = JSON.parse(localStorage.getItem('user_data') || '{}');

// 1. Protection Logic: Ensure user has admin/moderator roles
function checkAdminAccess() {
    if (!ADMIN_TOKEN) {
        window.location.href = '../login.html';
        return;
    }

    const roles = (ADMIN_USER_DATA.roles || []).map(r => (typeof r === 'object' ? r.name : r).toLowerCase());
    const isAdmin = roles.includes('admin') || roles.includes('super admin') || roles.includes('superadmin');
    const isModerator = roles.includes('moderator');

    if (!isAdmin && !isModerator) {
        alert('Access Denied: You do not have permission to view this page.');
        window.location.href = '../homefeed-dashboard.html';
    }
}

// 2. Standardized Sidebar Generator
function renderAdminSidebar(activePageId) {
    const sidebar = document.querySelector('aside');
    if (!sidebar) return;

    const initials = (ADMIN_USER_DATA.name || 'A')[0].toUpperCase();
    let avatarPath = null;
    if (ADMIN_USER_DATA.profile && ADMIN_USER_DATA.profile.avatar) {
        if (typeof ADMIN_USER_DATA.profile.avatar === 'object') {
            avatarPath = ADMIN_USER_DATA.profile.avatar.file_path; // Handle object format
        } else {
            avatarPath = ADMIN_USER_DATA.profile.avatar; // Handle string format
        }
    }

    const avatarUrl = avatarPath 
        ? (avatarPath.startsWith('http') 
            ? avatarPath 
            : (avatarPath.startsWith('storage/') ? `${window.PUBLIC_URL}/${avatarPath}` : `${window.PUBLIC_URL}/storage/${avatarPath}`))
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(ADMIN_USER_DATA.name)}&background=215bed&color=fff`;

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', link: 'admin-dashboard.html' },
        { id: 'roles', label: 'Roles & Permissions', icon: 'manage_accounts', link: 'admin-roles.html' },
        { id: 'moderation', label: 'Moderation Queue', icon: 'list_alt', link: 'moderation-queue.html', badge: '0' },
        { id: 'reports', label: 'Reports', icon: 'flag', link: 'reports.html' },
        { id: 'analytics', label: 'Analytics', icon: 'analytics', link: 'analytics.html' },
        { id: 'settings', label: 'Settings', icon: 'settings', link: 'setting-admin.html' }
    ];

    let menuHtml = `
        <div class="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Menu</div>
    `;

    menuItems.forEach(item => {
        const isActive = item.id === activePageId;
        const activeClass = isActive
            ? 'bg-primary/15 text-primary border border-primary/10 shadow-[0_0_15px_rgba(33,91,237,0.15)]'
            : 'text-slate-400 hover:text-white hover:bg-white/5 transition-all';

        menuHtml += `
            <a class="flex items-center gap-3 px-4 py-3 rounded-xl ${activeClass} group" href="${item.link}">
                <span class="material-symbols-outlined ${isActive ? '' : 'group-hover:scale-110 transition-transform'}" 
                      style="${isActive ? "font-variation-settings: 'FILL' 1;" : ''}">${item.icon}</span>
                <span class="text-sm ${isActive ? 'font-semibold' : 'font-medium'}">${item.label}</span>
                ${item.badge && item.badge !== '0' ? `<span class="ml-auto bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/20">${item.badge}</span>` : ''}
            </a>
        `;
    });

    sidebar.innerHTML = `
        <!-- Site Brand -->
        <div class="px-6 pt-6 pb-2 flex items-center gap-3">
             <div id="site-logo-img" class="w-10 h-10 rounded-xl flex items-center justify-center bg-cover bg-center bg-no-repeat">
                 <span class="material-symbols-outlined text-white/50 text-2xl">token</span>
             </div>
             <h1 id="site-logo-text" class="text-xl font-bold text-white tracking-tight">SocialApp</h1>
        </div>

        <div class="p-6 border-b border-white/5 flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="relative group cursor-pointer" onclick="window.location.href='../profile.html'">
                    <img src="${avatarUrl}" class="rounded-full size-12 ring-2 ring-primary/30 group-hover:ring-primary transition-all duration-300 object-cover bg-slate-700"
                         onerror="this.src='https://ui-avatars.com/api/?name=${initials}&background=215bed&color=fff'">
                    <div class="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-[#1e2330] rounded-full"></div>
                </div>
                <div class="flex flex-col">
                    <h1 class="text-white text-base font-bold leading-tight tracking-tight">${ADMIN_USER_DATA.name}</h1>
                    <p class="text-slate-400 text-xs font-medium capitalize">${typeof ADMIN_USER_DATA.roles?.[0] === 'object' ? ADMIN_USER_DATA.roles[0].name : (ADMIN_USER_DATA.roles?.[0] || 'Admin')}</p>
                </div>
            </div>
            <!-- Mobile Close Button -->
            <button onclick="toggleSidebar()" class="md:hidden text-slate-400 hover:text-white p-1">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
        <nav class="flex-1 flex flex-col gap-2 p-4 overflow-y-auto">
            ${menuHtml}
        </nav>
        <div class="p-4 border-t border-white/5 space-y-2">
            <a href="../homefeed-dashboard.html" class="flex items-center justify-center w-full gap-2 px-4 py-3 rounded-xl text-primary bg-primary/10 hover:bg-primary/20 transition-all text-sm font-bold border border-primary/10">
                <span class="material-symbols-outlined text-[20px]">arrow_back</span>
                Back to Main Site
            </a>
            <button onclick="handleAdminLogout()" class="flex items-center justify-center w-full gap-2 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium">
                <span class="material-symbols-outlined text-[20px]">logout</span>
                Sign Out
            </button>
        </div>
    `;
    
    // Trigger branding update if available
    if (window.refreshSiteBranding) {
        window.refreshSiteBranding();
    }
}

function handleAdminLogout() {
    localStorage.clear();
    window.location.href = '../login.html';
}

// 3. User Manipulation Helpers
async function banUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/delete_user`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId })
        });
        const data = await response.json();
        if (data.success) {
            alert('User deleted successfully.');
            if (typeof loadUsers === 'function') loadUsers();
        } else {
            alert(data.message || 'Failed to delete user.');
        }
    } catch (e) {
        console.error(e);
        alert('Error communicating with server.');
    }
}

// 4. Mobile Sidebar Toggle Helper
function toggleSidebar() {
    const sidebar = document.querySelector('aside');
    if (!sidebar) return;
    sidebar.classList.toggle('hidden');
    sidebar.classList.toggle('flex');
    sidebar.classList.toggle('absolute');
    sidebar.classList.toggle('inset-0');
    sidebar.classList.toggle('z-50');
    sidebar.classList.toggle('w-full');
}

// Initialize guard
// Initialize guard
checkAdminAccess();

// 5. Centralized API Error Handler
function handleAdminApiError(response, defaultMsg = 'An error occurred') {
    if (response.status === 403) {
        alert('Access Denied: You do not have permission to perform this action.');
        return true; // handled
    }
    if (response.status === 401) {
        alert('Session expired. Please login again.');
        handleAdminLogout();
        return true; 
    }
    return false; // not handled, caller should show defaultMsg or parse error
}
