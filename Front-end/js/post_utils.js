// Global Default Avatar Helper
window.DEFAULT_AVATAR = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&color=fff&size=128`;

// Post Interaction Utilities
// Requires: API_BASE_URL, token, PUBLIC_URL, currentUserData (or userData) to be defined globally
console.log('Post Utils Loading...');
// Global helper: Check if window already has it to avoid errors if double-loaded
function getProfilePicture(user) {
    if (!user) return `https://ui-avatars.com/api/?name=User&background=random`;

    // 0. Try global avatar_url (from User model append or BaseController)
    if (user.avatar_url) {
        return getStorageUrl(user.avatar_url);
    }

    // 1. Try new user_avatar relationship (Object)
    if (user.profile && user.profile.user_avatar && user.profile.user_avatar.file_path) {
        return getStorageUrl(user.profile.user_avatar.file_path);
    }

    // 2. Try old avatar (String or Object)
    if (user.profile && user.profile.avatar) {
        if (typeof user.profile.avatar === 'string') {
            if (user.profile.avatar.startsWith('http')) return user.profile.avatar;
            return getStorageUrl(user.profile.avatar);
        }
        else if (user.profile.avatar.file_path) {
            return getStorageUrl(user.profile.avatar.file_path);
        }
    }

    // 3. Fallback
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`;
}

function getStorageUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    
    // Fix: Remove 'public/' prefix if present
    if (path.startsWith('public/')) path = path.substring(7);

    const cleanPath = path.startsWith('/') ? path.substring(1) : path;

    // Check if path already has 'storage/' prefix
    if (cleanPath.startsWith('storage/')) {
        return `${window.PUBLIC_URL}/${cleanPath}`;
    }

    // Default: Append storage/
    return `${window.PUBLIC_URL}/storage/${cleanPath}`;
}
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getInitialsUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`;
}

function getAvatarUrl(user) {
    // Use the user-provided robust helper
    return getProfilePicture(user);
}

/**
 * Renders an <img> tag for the user's avatar with a fallback to initials on error or if missing.
 * @param {Object} user User object
 * @param {String} classes CSS classes for the img tag
 * @param {String} extraAttrs Extra attributes like onclick
 */
function renderAvatarHTML(user, classes = "size-10 rounded-full object-cover border border-white/10", extraAttrs = "") {
    const name = user ? user.name : 'User';
    const initialsUrl = getInitialsUrl(name);
    const avatarUrl = getAvatarUrl(user);

    // If we have an avatar URL, try loading it, with initials as onerror fallback
    if (avatarUrl) {
        return `<img src="${avatarUrl}" class="${classes}" ${extraAttrs} onerror="this.onerror=null; this.src='${initialsUrl}';">`;
    }

    // If no avatar URL, use initials directly
    return `<img src="${initialsUrl}" class="${classes}" ${extraAttrs}>`;
}


function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 right-6 px-6 py-4 rounded-xl backdrop-blur-md shadow-2xl transform transition-all duration-500 translate-y-20 opacity-0 z-50 flex items-center gap-3 border ${type === 'success' ? 'bg-black/60 border-green-500/30' : 'bg-black/60 border-red-500/30'}`;
    toast.innerHTML = `
        <span class="material-symbols-outlined ${type === 'success' ? 'text-green-400' : 'text-red-400'}">
            ${type === 'success' ? 'check_circle' : 'error'}
        </span>
        <span class="text-white font-medium text-sm">${message}</span>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-20', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Inject Report Modal
document.body.insertAdjacentHTML('beforeend', `
<div id="report-modal" class="fixed inset-0 z-[60] hidden">
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="closeReportModal()"></div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[#1e2330] border border-white/10 rounded-2xl shadow-2xl p-6">
        <h3 class="text-lg font-bold text-white mb-4">Report Content</h3>
        <p class="text-sm text-slate-400 mb-4">Why are you reporting this?</p>
        
        <div class="space-y-2 mb-6">
            <textarea id="report-reason-input" class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:border-primary/50 transition-all resize-none h-32 placeholder:text-slate-500" placeholder="Please describe the issue with this content..."></textarea>
        </div>

        <input type="hidden" id="report-target-id">
        <input type="hidden" id="report-target-type">

        <div class="flex gap-3 justify-end">
            <button onclick="closeReportModal()" class="px-4 py-2 text-slate-400 font-bold hover:text-white transition-colors">Cancel</button>
            <button onclick="submitReport()" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20">Submit Report</button>
        </div>
    </div>
</div>
`);

// Shared Logic for Posts
async function setupGlobalSearch() {
    const searchInput = document.getElementById('global-search-input');
    if (!searchInput) return;

    // Create dropdown container if not exists
    let dropdown = document.getElementById('global-search-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'global-search-dropdown';
        dropdown.className = 'absolute top-full left-0 w-full mt-2 bg-[#1c1f27] border border-white/10 rounded-xl shadow-2xl hidden z-50 overflow-hidden';
        searchInput.parentElement.appendChild(dropdown);
        searchInput.parentElement.style.position = 'relative'; // Ensure proper positioning
    }

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length === 0) {
            dropdown.classList.add('hidden');
            dropdown.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            dropdown.innerHTML = '<div class="p-4 text-center text-slate-400 text-sm">Searching...</div>';
            dropdown.classList.remove('hidden');

            try {
                const response = await fetch(`${API_BASE_URL}/search_user`, {
                     method: 'POST',
                     headers: {
                         'Authorization': `Bearer ${token}`,
                         'Content-Type': 'application/json'
                     },
                     body: JSON.stringify({ search: query, limit: 5 })
                });
                const data = await response.json();

                if (data.success && data.data && data.data.items && data.data.items.length > 0) {
                    dropdown.innerHTML = data.data.items.map(user => `
                        <div class="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0" onclick="window.location.href='profile.html?id=${user.id}'">
                             ${renderAvatarHTML(user, "w-10 h-10 rounded-full border border-white/10 object-cover")}
                             <div>
                                 <h4 class="text-white font-bold text-sm">${user.name}</h4>
                                 <p class="text-xs text-secondary-text">@${user.name.replace(/\s+/g, '').toLowerCase()}</p>
                             </div>
                        </div>
                    `).join('');
                } else {
                    dropdown.innerHTML = '<div class="p-4 text-center text-slate-400 text-sm">No users found.</div>';
                }
            } catch (error) {
                console.error('Search error:', error);
                dropdown.innerHTML = '<div class="p-4 text-center text-red-400 text-sm">Error searching.</div>';
            }
        }, 300); // 300ms debounce
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
    
    // Header Avatar Init (Standardizing here too to fix black image globally)
    const headerAvatar = document.getElementById('header-user-avatar') || document.getElementById('nav-avatar');
    if(headerAvatar && typeof currentUserData !== 'undefined') {
        const url = getAvatarUrl(currentUserData);
        if (url) headerAvatar.src = url;
    }
}

/**
 * Checks if current user has admin/moderator roles and renders a link to the admin panel.
 */
function checkAndRenderAdminLink() {
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    if (!userData || !userData.roles) return;

    // Handle both array of objects (from API) and array of strings (from login response)
    const roles = userData.roles.map(r => (typeof r === 'object' ? r.name : r).toLowerCase());
    
    // Check for common admin/moderator roles
    const hasAccess = roles.includes('admin') || 
                      roles.includes('super admin') || 
                      roles.includes('superadmin') || 
                      roles.includes('moderator');

    if (hasAccess) {
        // Find header actions container - try multiple common selectors
        const headerActions = document.querySelector('header .flex.items-center.justify-end') || 
                            document.querySelector('header .flex.items-center.gap-4') ||
                            document.querySelector('header .flex.items-center.gap-3');
                            
        if (headerActions) {
            // Check if link already exists
            if (document.getElementById('admin-portal-link')) return;

            const adminLink = document.createElement('a');
            adminLink.id = 'admin-portal-link';
            adminLink.href = 'admin%20panel/admin-dashboard.html';
            adminLink.className = 'w-9 h-9 md:w-10 md:h-10 rounded-full bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center text-accent-purple hover:bg-accent-purple hover:text-white transition-all duration-300 group mr-1';
            adminLink.title = 'Admin Portal';
            adminLink.innerHTML = `
                <span class="material-symbols-outlined text-[20px] md:text-[24px] group-hover:rotate-12 transition-transform">shield_person</span>
            `;
            
            // Insert before profile container
            const profile = headerActions.querySelector('.group\\/profile');
            if (profile) headerActions.insertBefore(adminLink, profile);
        }
    }
}

// Multi-Account Service
// Multi-Account Service
if (typeof window.MultiAccountService === 'undefined') {
    window.MultiAccountService = {
        STORAGE_KEY: 'saved_accounts',

        getAccounts() {
            try {
                return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            } catch {
                return [];
            }
        },

        saveCurrentAccount() {
            const token = localStorage.getItem('auth_token');
            const user = JSON.parse(localStorage.getItem('user_data') || '{}');
            
            if (!token || !user.id) return;

            let accounts = this.getAccounts();
            // Remove existing saved entry for this user to avoid dupes
            accounts = accounts.filter(acc => acc.user.id !== user.id);
            
            // Add current
            accounts.push({ token, user, last_active: new Date().getTime() });
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
        },

        switchAccount(accountId) {
            // Save current first
            this.saveCurrentAccount();

            const accounts = this.getAccounts();
            const target = accounts.find(acc => acc.user.id == accountId);

            if (target) {
                // Remove target from saved list (it becomes active)
                const remaining = accounts.filter(acc => acc.user.id !== target.user.id);
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(remaining));

                // Set as active
                localStorage.setItem('auth_token', target.token);
                localStorage.setItem('user_data', JSON.stringify(target.user));
                
                // Reload
                window.location.reload();
            }
        },

        addAccount() {
            this.saveCurrentAccount();
            // Clear active session effectively
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            window.location.href = 'login.html';
        },
        
        logoutCurrent() {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            window.location.href = 'login.html';
        }
    };
}
// Expose as global const only if needed, but safe to use window.MultiAccountService everywhere
// Removed const re-declaration to prevent SyntaxError

// Profile Dropdown Logic
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profile-dropdown');
    if (!dropdown) return;

    // Render Dropdown Content dynamically
    if (dropdown.classList.contains('hidden')) {
        renderDropdownContent(dropdown);
    }
    
    dropdown.classList.toggle('hidden');
}

function renderDropdownContent(container) {
    const savedAccounts = MultiAccountService.getAccounts();
    const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');

    let accountsHtml = '';
    if (savedAccounts.length > 0) {
        accountsHtml = `
            <div class="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Switch Accounts</div>
            ${savedAccounts.map(acc => `
                <div onclick="MultiAccountService.switchAccount(${acc.user.id})" 
                     class="px-4 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors group">
                    <img src="${getAvatarUrl(acc.user) || window.DEFAULT_AVATAR(acc.user.name)}" class="w-8 h-8 rounded-full border border-white/10 object-cover">
                    <div class="flex-1 overflow-hidden">
                        <div class="text-xs font-bold text-white truncate">${acc.user.name}</div>
                        <div class="text-[10px] text-slate-500 truncate">@${acc.user.name.toLowerCase().replace(/\s+/g, '')}</div>
                    </div>
                </div>
            `).join('')}
            <div class="h-px bg-white/5 my-1"></div>
        `;
    }

    // Role-based Admin Link
    const roles = currentUser.roles ? currentUser.roles.map(r => (typeof r === 'object' ? r.name : r).toLowerCase()) : [];
    const isAdmin = roles.some(r => ['admin', 'super admin', 'moderator'].includes(r));
    const adminLinkHtml = isAdmin ? `
        <a href="admin%20panel/admin-dashboard.html" class="block px-4 py-3 text-sm text-accent-purple hover:bg-accent-purple/10 transition-colors flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">shield_person</span>
            Admin Portal
        </a>
    ` : '';

    container.innerHTML = `
        <div class="py-1">
            <a href="profile.html" class="block px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">person</span>
                View Profile
            </a>
            ${adminLinkHtml}
            <div class="h-px bg-white/5 my-1"></div>
            
            ${accountsHtml}
            
            <button onclick="MultiAccountService.addAccount()" 
                class="w-full text-left px-4 py-2 text-sm text-primary hover:bg-primary/10 transition-colors flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">person_add</span>
                Add Account
            </button>
            
            <div class="h-px bg-white/5 my-1"></div>
            
            <button onclick="MultiAccountService.logoutCurrent()" 
                class="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">logout</span>
                Logout
            </button>
        </div>
    `;
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('profile-dropdown');
    const profileTrigger = document.querySelector('.group\\/profile');
    
    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!dropdown.contains(e.target) && !profileTrigger.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    }
});

// Init search and admin link on load
document.addEventListener('DOMContentLoaded', () => {
    setupGlobalSearch();
    checkAndRenderAdminLink();
});

/**
 * Formats a date string into a "Time Ago" format (e.g., "2 hours ago", "Just now").
 * @param {String} dateString ISO 8601 date string
 * @returns {String} Formatted time string
 */
function timeAgo(dateString) {
    if (!dateString) return '';
    
    // Ensure we parse as UTC if no timezone is specified
    // Laravel typically sends "YYYY-MM-DD HH:mm:ss" which JS can interpret as local
    let safeDateString = dateString;
    if (!dateString.endsWith('Z') && !dateString.includes('+')) {
        safeDateString += 'Z';
    }

    const date = new Date(safeDateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    // Handle future dates (clocks slightly off)
    if (seconds < 0) return "Just now";
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    
    return "Just now";
}

function createPostHTML(post) {
    const user = post.user || post.creator || { name: 'Unknown', id: 0 };
    // Use updated_at for time display if we are sorting by it
    const timeAgoStr = timeAgo(post.updated_at || post.created_at);

    const isLiked = post.is_liked || false;
    const likeColorClass = isLiked ? 'text-pink-500' : 'text-secondary-text';
    const likeFill = isLiked ? 1 : 0;

    let mediaHTML = '';
    if (post.attachments && post.attachments.length > 0) {
        mediaHTML = renderAttachmentsHTML(post.attachments);
    }

    const cardClass = "glass-panel rounded-2xl shadow-xl overflow-hidden p-0 transition-transform duration-300 hover:translate-y-[-2px] mb-6";

    return `
    <article class="${cardClass}" id="post-${post.id}">
        <div class="p-6">
            ${renderRetweetHeader(post, user)}
            <div class="flex gap-4">
                ${renderAvatarHTML(user, "size-10 rounded-full border border-white/10 cursor-pointer object-cover", `onclick="window.location.href='profile.html?id=${user.id}'"`)}
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="text-white font-bold text-sm cursor-pointer hover:underline" onclick="window.location.href='profile.html?id=${user.id}'">${user.name}</h3>
                                ${(!user.followers || user.followers.length === 0) && (user.id !== (currentUserData?.id || userData?.id)) ? 
                                    `<span class="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded font-bold">Suggested</span>` : ''}
                            </div>
                            <div class="flex items-center gap-2 text-secondary-text text-sm mt-0.5">
                                <span>@${user.name.replace(/\s+/g, '').toLowerCase()}</span>
                                <span class="text-[8px] opacity-50">●</span>
                                <span>${timeAgoStr}</span>
                                ${(!user.followers || user.followers.length === 0) && (user.id !== (currentUserData?.id || userData?.id)) ? 
                                    `<button onclick="followUserDashboard(this, ${user.id}); event.stopPropagation();" class="ml-2 text-primary text-xs font-bold hover:underline bg-transparent border-none p-0">Follow</button>` : ''}
                            </div>
                        </div>
                        
                        <!-- Actions Dropdown -->
                        <div class="relative group/dropdown">
                            <button class="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors">
                                <span class="material-symbols-outlined text-[20px]">more_horiz</span>
                            </button>
                            <div class="absolute right-0 top-full mt-2 w-48 bg-[#1e2330] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all z-20 overflow-hidden text-left">
                                ${(() => {
                                    const current = window.currentUserData || (typeof currentUserData !== 'undefined' ? currentUserData : {}) || (typeof userData !== 'undefined' ? userData : {});
                                    const currentId = current.id || 0;
                                    const currentRoles = (current.roles) ? current.roles.map(r => (typeof r === 'object' ? r.name : r).toLowerCase()) : [];
                                    const isOwner = user.id == currentId;
                                    
                                    // Use shared helper if available
                                    const canDelete = (typeof window.canDeleteContent === 'function') 
                                                    ? window.canDeleteContent({id: currentId, roles: currentUserData?.roles}, user) 
                                                    : (isOwner);

                                    let items = '';
                                    if (canDelete) {
                                         items += `<button onclick="editPost(${post.id})" class="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 flex items-center gap-3 transition-colors">
                                            <span class="material-symbols-outlined text-[18px]">edit</span> Edit
                                        </button>
                                        <button onclick="deletePost(${post.id})" class="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/10 flex items-center gap-3 transition-colors">
                                            <span class="material-symbols-outlined text-[18px]">delete</span> Delete
                                        </button>`;
                                    } else {
                                         items += `<button onclick="openReportModal(${post.id}, 'post')" class="w-full text-left px-4 py-2.5 text-sm text-yellow-400 hover:bg-white/10 flex items-center gap-3 transition-colors">
                                            <span class="material-symbols-outlined text-[18px]">flag</span> Report
                                        </button>`;
                                    }
                                    return items;
                                })()}
                            </div>
                        </div>
                    </div>
                    
                    <div class="text-slate-300 text-sm whitespace-pre-wrap break-words leading-relaxed mb-3">${escapeHtml(post.body || '')}</div>
                    ${mediaHTML}

                    <!-- Action Buttons -->
                    <div class="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                         <div class="flex items-center gap-6">
                                <button onclick="likePost(${post.id}, this)" class="flex items-center gap-2 text-xs font-semibold ${likeColorClass} hover:text-pink-500 transition-colors group">
                                    <span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform" style="font-variation-settings: 'FILL' ${likeFill}">favorite</span>
                                    <span>${post.like_count > 0 ? post.like_count : 'Like'}</span>
                                </button>
                                <button onclick="toggleCommentSection(${post.id})" class="flex items-center gap-2 text-secondary-text text-xs font-semibold hover:text-blue-400 transition-colors">
                                    <span class="material-symbols-outlined text-[20px]">chat_bubble</span>
                                    <span>${post.comments_count > 0 ? post.comments_count : 'Comment'}</span>
                                </button>
                        </div>
                         <div class="flex items-center gap-2">
                                 <button onclick="sharePost(${post.id})" class="flex items-center gap-2 text-secondary-text text-xs font-semibold hover:text-green-500 transition-colors">
                                    <span class="material-symbols-outlined text-[18px]">share</span>
                                    <span class="hidden md:inline">Share</span>
                                 </button>
                         </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Inline Comment Section -->
        <div id="comment-section-${post.id}" class="hidden px-6 pb-6 pt-2 border-t border-white/5 bg-black/20">
            <div id="comment-list-${post.id}" class="flex flex-col gap-3 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar"></div>

            <div class="flex gap-3 items-start">
                    ${renderAvatarHTML(currentUserData || userData, "w-8 h-8 rounded-full border border-white/10 mt-1 object-cover")}
                    <div class="flex-1">
                    <textarea id="comment-input-${post.id}" class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:border-primary/50 transition-all resize-none h-20 placeholder:text-slate-500" placeholder="Write a comment..."></textarea>
                    <div class="flex justify-between items-center mt-2">
                            <div class="flex items-center gap-2">
                                    <label for="comment-file-${post.id}" class="cursor-pointer text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5">
                                    <span class="material-symbols-outlined text-[20px]">attach_file</span>
                                    <input type="file" id="comment-file-${post.id}" class="hidden" onchange="handleCommentFileSelect(event, 'comment-preview-${post.id}')">
                                </label>
                            </div>
                            <button onclick="submitComment(${post.id})" class="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1">
                            <span>Post</span>
                            <span class="material-symbols-outlined text-[14px]">send</span>
                            </button>
                    </div>
                    <div id="comment-preview-${post.id}" class="mt-2 hidden"></div>
                    </div>
            </div>
        </div>
    </article>`;
}
function renderAttachmentsHTML(attachments) {
    if (!attachments || attachments.length === 0) return '';
    
    // Ensure array
    const files = Array.isArray(attachments) ? attachments : [attachments];
    if (files.length === 0) return '';

    // We basically want grid layout if multiple, or single if one
    // But for now let's just show the first one or a grid
    // Logic adapted from previous versions
    
    let html = '<div class="mt-3 grid gap-2 grid-cols-2">'; 
    if(files.length === 1) html = '<div class="mt-3">';

    files.forEach(file => {
        let src = '';
        let type = 'image'; // default
        
        if (typeof file === 'string') {
            if(!file.startsWith('storage/') && !file.startsWith('http')) {
                src = `storage/posts/${file}`;
            } else {
                 src = file;
            }
            // fix url
             const baseUrl = (typeof PUBLIC_URL !== 'undefined') ? PUBLIC_URL : window.PUBLIC_URL;
             if(!src.startsWith('http')) src = `${baseUrl}/${src}`;

        } else if (typeof file === 'object') {
             let path = file.file_path;
             if(!path.startsWith('storage/') && !path.startsWith('http')) path = 'storage/' + path;
             src = path;
             
             // fix url
             const baseUrl = (typeof PUBLIC_URL !== 'undefined') ? PUBLIC_URL : window.PUBLIC_URL;
             if(!src.startsWith('http')) src = `${baseUrl}/${src}`;
             
             if(file.file_type && file.file_type.includes('video')) type = 'video';
        }

        if(type === 'video') {
             html += `
             <div class="rounded-lg overflow-hidden border border-white/10 relative group bg-black">
                 <video src="${src}" controls class="w-full max-h-96 object-contain"></video>
             </div>`;
        } else {
            // Image
            html += `
            <div class="rounded-lg overflow-hidden border border-white/10 relative group cursor-pointer" onclick="openMediaModal('${src}', 'image')">
                <img src="${src}" class="w-full h-full object-cover max-h-96 hover:scale-105 transition-transform duration-500">
            </div>`;
        }
    });

    html += '</div>';
    return html;
}

// Helper for Role Checks - Global for reuse
window.hasRole = (user, roleName) => {
    if (!user) return false;
    if (user.role === roleName) return true;
    if (user.roles && Array.isArray(user.roles)) {
        return user.roles.some(r => r.name === roleName);
    }
    return false;
};

window.canDeleteContent = (currentUser, owner) => {
    if (!currentUser || !owner) return false;
    
    // 1. Owner can always delete
    if (currentUser.id === owner.id) return true;

    // 2. Role Hierarchy
    const amISuperAdmin = window.hasRole(currentUser, 'super admin');
    const amIAdmin = window.hasRole(currentUser, 'admin');
    const amIMod = window.hasRole(currentUser, 'moderator');
    
    const isOwnerSuperAdmin = window.hasRole(owner, 'super admin');
    const isOwnerAdmin = window.hasRole(owner, 'admin');
    const isOwnerMod = window.hasRole(owner, 'moderator');

    // Logic matches Backend PostController
    if (isOwnerSuperAdmin) {
        return amISuperAdmin;
    }
    if (isOwnerAdmin) {
        return amISuperAdmin || amIAdmin; // Admin or SA can delete Admin
    }
    if (isOwnerMod) {
        return amISuperAdmin || amIAdmin || amIMod; // SA, Admin, Mod can delete Mod
    }
    
    // Dictionary Definition: User Post
    // Delete: Owner (handled top), SA, Admin. (NOT Mod)
    return amISuperAdmin || amIAdmin;
};

function createPostHTML(post, passedUserData = null) {
    const currentUserData = passedUserData || window.currentUserData || window.userData || { id: 0, roles: [] };
    const isLiked = post.is_liked || false;
    const likeCount = post.like_count || 0;
    const likeColorClass = isLiked ? 'text-pink-500' : 'text-secondary-text';
    const likeFill = isLiked ? 1 : 0;
    const userData = post.creator || { name: 'Unknown', id: 0, profile: { avatar: DEFAULT_AVATAR } }; // Fallback
    const totalComments = (post.comments_count || 0) + (post.replies_count || 0);

    // Check if user has avatar
    const avatarHtml = renderAvatarHTML(userData, "w-10 h-10 rounded-full border border-white/10 cursor-pointer object-cover", `onclick="window.location.href='profile.html?id=${userData.id}'"`);

    return `
    <article class="bg-card w-full rounded-xl border border-white/5 p-4 mb-4 animate-fade-in group hover:border-white/10 transition-colors" id="post-${post.id}">
        <div class="flex gap-4">
            ${avatarHtml}
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <div class="flex flex-col">
                        <h3 class="font-bold text-white text-base truncate cursor-pointer hover:text-blue-400 transition-colors" onclick="window.location.href='profile.html?id=${userData.id}'">${userData.name}</h3>
                        <span class="text-xs text-secondary-text">${timeAgo(post.created_at)}</span>
                    </div>
                    <div class="relative group/menu">
                        <button class="text-secondary-text hover:text-white transition-colors p-1 rounded-full hover:bg-white/5">
                            <span class="material-symbols-outlined">more_horiz</span>
                        </button>
                        <div class="absolute right-0 top-8 w-48 bg-[#1e2330] border border-white/10 rounded-xl shadow-2xl py-1 z-20 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transform scale-95 group-hover/menu:scale-100 transition-all duration-200 origin-top-right">
                             
                             ${(currentUserData.id === userData.id) ? `
                             <button onclick="editPost(${post.id})" class="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors">
                                <span class="material-symbols-outlined text-[18px]">edit</span> Edit Post
                             </button>
                             ` : ''}
                             
                             ${(window.canDeleteContent(currentUserData, userData)) ? `
                             <button onclick="deletePost(${post.id})" class="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 hover:text-red-300 flex items-center gap-2 transition-colors">
                                <span class="material-symbols-outlined text-[18px]">delete</span> Delete Post
                             </button>
                             ` : ''}

                             ${(currentUserData.id !== userData.id) ? `
                             <button onclick="openReportModal(${post.id}, 'post')" class="w-full text-left px-4 py-2.5 text-sm text-yellow-500 hover:bg-white/5 hover:text-yellow-400 flex items-center gap-2 transition-colors">
                                <span class="material-symbols-outlined text-[18px]">flag</span> Report Post
                             </button>
                             ` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="mt-3 text-gray-200 text-sm whitespace-pre-wrap break-words leading-relaxed">${escapeHtml(post.body || '')}</div>
                
                ${renderAttachmentsHTML(post.attachments)}
                
                ${post.original_post ? renderRetweetHTML(post) : ''}

                <div class="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                    <div class="flex items-center gap-6">
                            <div class="flex items-center gap-2">
                                <button onclick="likePost(${post.id}, this)" class="flex items-center gap-2 text-xs font-semibold ${likeColorClass} hover:text-pink-500 transition-colors group">
                                    <span class="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform" style="font-variation-settings: 'FILL' ${likeFill}">favorite</span>
                                    <span class="hidden md:inline">Like</span>
                                </button>
                                <span class="text-xs text-secondary-text hover:text-white ml-1 font-medium transition-colors">${likeCount > 0 ? likeCount : ''}</span>
                            </div>

                            <div class="flex items-center gap-2">
                                <button onclick="toggleCommentSection(${post.id})" class="flex items-center gap-2 text-secondary-text text-xs font-semibold hover:text-blue-500 transition-colors">
                                    <span class="material-symbols-outlined text-[18px]">chat_bubble</span>
                                    <span class="hidden md:inline">Comment</span>
                                </button>
                                <span class="text-xs text-secondary-text hover:text-white ml-1">${totalComments > 0 ? totalComments : ''}</span>
                            </div>

                             <div class="flex items-center gap-2">
                                <button onclick="retweetPost(${post.id})" class="flex items-center gap-2 text-secondary-text text-xs font-semibold hover:text-purple-500 transition-colors">
                                    <span class="material-symbols-outlined text-[18px]">repeat</span>
                                    <span class="hidden md:inline">Repost</span>
                                </button>
                            </div>

                            <div class="flex items-center gap-2">
                                <button onclick="sharePost(${post.id})" class="flex items-center gap-2 text-secondary-text text-xs font-semibold hover:text-green-500 transition-colors">
                                    <span class="material-symbols-outlined text-[18px]">share</span>
                                    <span class="hidden md:inline">Share</span>
                                </button>
                                <span class="text-xs text-secondary-text hover:text-white ml-1">${post.shares_count > 0 ? post.shares_count : ''}</span>
                            </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Inline Comment Section -->
        <div id="comment-section-${post.id}" class="hidden px-6 pb-6 pt-2 border-t border-white/5 bg-black/20">
            <div id="comment-list-${post.id}" class="flex flex-col gap-3 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar"></div>

            <div class="flex gap-3 items-start">
                    ${renderAvatarHTML(currentUserData || userData, "w-8 h-8 rounded-full border border-white/10 mt-1 object-cover")}
                    <div class="flex-1">
                    <textarea id="comment-input-${post.id}" class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:border-primary/50 transition-all resize-none h-20 placeholder:text-slate-500" placeholder="Write a comment..."></textarea>
                    <div class="flex justify-between items-center mt-2">
                            <div class="flex items-center gap-2">
                                    <label for="comment-file-${post.id}" class="cursor-pointer text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5">
                                    <span class="material-symbols-outlined text-[20px]">attach_file</span>
                                    <input type="file" id="comment-file-${post.id}" class="hidden" onchange="handleCommentFileSelect(event, 'comment-preview-${post.id}')">
                                </label>
                            </div>
                            <button onclick="submitComment(${post.id})" class="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1">
                            <span>Post</span>
                            <span class="material-symbols-outlined text-[14px]">send</span>
                            </button>
                    </div>
                    <div id="comment-preview-${post.id}" class="mt-2 hidden"></div>
                    </div>
            </div>
        </div>
    </article>`;
}

function renderRetweetHTML(post) {
    const original = post.original_post || post.originalPost;
    if (!original) return '';

    const oUser = original.creator || original.user || { name: 'Unknown', id: 0 };
    
    // Attachments of original post
    let oMediaHTML = '';
    if (original.attachments && original.attachments.length > 0) {
         oMediaHTML = renderAttachmentsHTML(original.attachments);
    }
    
    return `
    <div class="border border-white/10 rounded-xl p-4 bg-white/5 mt-3 hover:bg-white/10 transition-colors cursor-pointer" onclick="window.location.href='post_details.html?id=${original.id}'">
        <div class="flex gap-3 mb-2">
                 ${renderAvatarHTML(oUser, "size-6 rounded-full border border-white/10 object-cover")}
                 <div>
                     <h4 class="text-white font-bold text-xs hover:underline cursor-pointer" onclick="event.stopPropagation(); window.location.href='profile.html?id=${oUser.id}'">${oUser.name}</h4>
                     <p class="text-[10px] text-slate-500">@${oUser.name.replace(/\s+/g, '').toLowerCase()}</p>
                 </div>
        </div>
        <div class="text-slate-300 text-sm whitespace-pre-wrap break-words leading-relaxed">${escapeHtml(original.body || '')}</div>
        ${oMediaHTML}
    </div>
    `;
}

function renderRetweetHeader(post, user) {
    // Check for original_post or originalPost (handle both snake and camel case just in case)
    const original = post.original_post || post.originalPost;
    if (!original) return '';
    
    return `
    <div class="flex items-center gap-2 text-slate-400 text-xs font-bold mb-3 ml-12">
        <span class="material-symbols-outlined text-[16px]">repeat</span>
        <span>${user.name} Reposted</span>
    </div>
    `;
}

function renderPostContent(post, mediaHTML) {
    const original = post.original_post || post.originalPost;
    
    if (original) {
        // Render Original Post inside a container
        const oUser = original.creator || original.user || { name: 'Unknown', id: 0 };
         // If original post has media, we need to process it similar to createPostHTML to show it
        let oMediaHTML = '';
        if (original.attachments && original.attachments.length > 0) {
             const files = Array.isArray(original.attachments) ? original.attachments : [];
             if (files.length > 0) {
                 const file = files[0];
                 let src = '';
                 if (typeof file === 'object' && file.file_path) src = `${PUBLIC_URL}/${file.file_path}`;
                 else if (typeof file === 'string') src = `${PUBLIC_URL}/posts/${file}`;
                 
                 if(src) {
                     oMediaHTML = `<div class="mt-3 rounded-lg overflow-hidden border border-white/10 h-48 relative group cursor-pointer">
                     <div class="w-full h-full bg-cover bg-center" style="background-image: url('${src}')"></div>
                     </div>`;
                 }
             }
        }

        return `
            ${post.body ? `<p class="text-slate-200 mt-2 text-sm leading-relaxed mb-3">${post.body}</p>` : ''}
            <div class="border border-white/10 rounded-xl p-4 bg-white/5 mt-2 hover:bg-white/10 transition-colors">
                <div class="flex gap-3 mb-2">
                     ${renderAvatarHTML(oUser, "size-6 rounded-full border border-white/10 object-cover")}
                     <div>
                         <h4 class="text-white font-bold text-xs">${oUser.name}</h4>
                         <p class="text-[10px] text-slate-500">@${oUser.name.replace(/\s+/g, '').toLowerCase()}</p>
                     </div>
                </div>
                <p class="text-slate-300 text-sm">${original.body || ''}</p>
                ${oMediaHTML}
            </div>
        `;
    }

    // Normal Post
    return `
        ${post.body ? `<p class="text-slate-200 mt-2 text-sm leading-relaxed">${post.body}</p>` : ''}
        ${mediaHTML}
    `;
}

async function retweetPost(postId) {
     // Fetch the post details first (we need username and body for the preview)
     // We can try to find the post object in the DOM if we rendered it with data, OR just fetch it.
     // Better yet, createPostHTML should pass the necessary data to retweetPost or we assume it's available.
     // But since we only pass ID, we need to fetch or extract.
     // Simpler approach: update createPostHTML to pass the needed strings, but that gets messy with quoting.
     // So let's just fetch the single post details to be safe, OR extract from DOM.
     
     // Let's use the API to get fresh details to ensure we are quoting valid content.
     try {
         const response = await fetch(`${API_BASE_URL}/get_post`, {
             method: 'POST',
             headers: { 
                 'Authorization': `Bearer ${token}`,
                 'Content-Type': 'application/json' 
             },
             body: JSON.stringify({ id: postId })
         });
         const data = await response.json();
         
         if(data.success && data.data) {
             const post = data.data;
             const user = post.user || { name: 'Unknown' };
             
             if (typeof window.prepareRetweet === 'function') {
                 window.prepareRetweet({
                     id: post.id,
                     username: user.name,
                     body: post.body
                 });
             } else {
                 // Fallback for pages without the create post form (e.g. profile page maybe?)
                 // For now, if no prepareRetweet, we can show a toast or redirect to dashboard.
                 window.location.href = `homefeed-dashboard.html?repost=${post.id}`;
             }
         }
     } catch(e) {
         console.error(e);
         showToast('Error preparing repost', 'error');
     }
}



async function toggleCommentSection(postId) {
    const section = document.getElementById(`comment-section-${postId}`);
    const list = document.getElementById(`comment-list-${postId}`);
    
    // Normalize self-reference for avatar in comments
    const myName = (typeof currentUserData !== 'undefined' && currentUserData.name) ? currentUserData.name : 
                   (typeof userData !== 'undefined' && userData.name) ? userData.name : 'Me';
    
    section.classList.toggle('hidden');
    
    if(!section.classList.contains('hidden')) {
            setTimeout(() => {
            const input = document.getElementById(`comment-input-${postId}`);
            if(input) input.focus();
            }, 50);
            
            // Fetch comments
            list.innerHTML = '<div class="text-xs text-secondary-text text-center py-2">Loading comments...</div>';
            
            try {
                const response = await fetch(`${API_BASE_URL}/get_comment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ post_id: postId, limit: 20 })
                });
                const data = await response.json();
                
                if(data.success && data.data && data.data.items.length > 0) {
                    const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');

                    list.innerHTML = data.data.items.map(comment => {
                        const user = comment.user || { name: 'Unknown', id: 0 };
                        const isLiked = comment.is_liked || false;
                        const likeCount = comment.like_count || 0;
                        const likeColorClass = isLiked ? 'text-pink-500' : 'text-secondary-text';
                        const likeFill = isLiked ? 1 : 0;
                        const isOwner = currentUser.id === user.id;
                        const isAdmin = currentUser.roles && (currentUser.roles.includes('admin') || currentUser.roles.includes('super admin'));

                        // Render Replies
                        let repliesHTML = `<div id="replies-container-${comment.id}" class="mt-2 pl-8 flex flex-col gap-2 border-l border-white/10 ml-2 ${comment.replies && comment.replies.length > 0 ? '' : 'hidden'}">`;
                        
                        if(comment.replies && comment.replies.length > 0) {
                            repliesHTML += comment.replies.map(reply => {
                                const replyUser = reply.creator || { name: 'Unknown', id: 0 };
                                const replyIsLiked = reply.is_liked || false;
                                const replyLikeCount = reply.like_count || 0;
                                const rLikeColor = replyIsLiked ? 'text-pink-500' : 'text-secondary-text';
                                const rLikeFill = replyIsLiked ? 1 : 0;
                                const isReplyOwner = currentUser.id === replyUser.id;
                                
                                return `
                                <div class="flex gap-3 items-start animate-fade-in" id="post-comment-row-${reply.id}">
                                    ${renderAvatarHTML(replyUser, "w-6 h-6 rounded-full border border-white/10 cursor-pointer object-cover", `onclick="window.location.href='profile.html?id=${replyUser.id}'"`)}
                                    <div class="flex-1">
                                        <div class="bg-white/5 rounded-xl p-2 px-3 border border-white/10 group/reply relative">
                                            <div class="flex justify-between items-start mb-0.5">
                                                <h4 class="font-bold text-white text-[11px] cursor-pointer hover:underline" onclick="window.location.href='profile.html?id=${replyUser.id}'">${replyUser.name}</h4>
                                                
                                                <div class="flex items-center gap-2">
                                                    <span class="text-[9px] text-slate-500">${timeAgo(reply.created_at)}</span>
                                                    
                                                    <div class="relative group">
                                                        <button onclick="togglePostCommentMenu(event, this)" class="text-slate-500 hover:text-white p-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                                                            <span class="material-symbols-outlined text-[14px]">more_horiz</span>
                                                        </button>
                                                        <div class="post-comment-menu absolute right-0 top-5 w-24 bg-[#1e2330] border border-white/10 rounded-lg shadow-xl py-1 z-20 opacity-0 scale-95 pointer-events-none transition-all duration-200 origin-top-right">
                                                            ${isReplyOwner ? `
                                                            <button onclick="editPostReply(${reply.id})" class="w-full text-left px-3 py-1.5 text-[10px] text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-1.5">
                                                                <span class="material-symbols-outlined text-[12px]">edit</span> Edit
                                                            </button>` : ''}
                                                            
                                                            ${isReplyOwner || isAdmin ? `
                                                            <button onclick="deletePostReply(${reply.id}, this)" class="w-full text-left px-3 py-1.5 text-[10px] text-red-400 hover:bg-white/10 flex items-center gap-1.5">
                                                                <span class="material-symbols-outlined text-[12px]">delete</span> Delete
                                                            </button>` : ''}

                                                            ${!isReplyOwner ? `
                                                            <button onclick="openReportModal(${reply.id}, 'reply')" class="w-full text-left px-3 py-1.5 text-[10px] text-yellow-500 hover:bg-white/10 flex items-center gap-1.5">
                                                                <span class="material-symbols-outlined text-[12px]">flag</span> Report
                                                            </button>` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <p class="text-slate-300 text-xs whitespace-pre-wrap comment-text break-words">${reply.reply}</p>
                                            ${reply.attachments && reply.attachments.length > 0 ? `
                                            <div class="mt-2 flex flex-wrap gap-2">
                                                ${reply.attachments.map(att => {
                                                    const path = att.file_path.startsWith('http') ? att.file_path : `${window.PUBLIC_URL}/${att.file_path}`;
                                                    if (['image', 'jpg', 'png', 'jpeg', 'gif'].includes(att.file_type) || /\.(jpg|jpeg|png|gif)$/i.test(path)) {
                                                        return `<div class="relative group cursor-pointer" onclick="openMediaModal('${path}', 'image')"><img src="${path}" class="w-32 h-32 object-cover rounded-lg border border-white/10" alt="Attachment"></div>`;
                                                    } else if (['video', 'mp4', 'mov', 'avi'].includes(att.file_type) || /\.(mp4|mov|avi)$/i.test(path)) {
                                                        return `<div class="relative group w-32 h-32 cursor-pointer" onclick="openMediaModal('${path}', 'video')"><video src="${path}" class="w-full h-full object-cover rounded-lg border border-white/10"></video><div class="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all"><span class="material-symbols-outlined text-white text-3xl">play_circle</span></div></div>`;
                                                    } else {
                                                        return `<a href="${path}" target="_blank" class="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"><span class="material-symbols-outlined text-slate-400">description</span><span class="text-xs text-blue-400 underline">View Attachment</span></a>`;
                                                    }
                                                }).join('')}
                                            </div>` : ''}
                                        </div>
                                        <div class="flex items-center gap-3 mt-1 ml-2">
                                            <button onclick="likeReply(${reply.id}, this)" class="flex items-center gap-1 text-[10px] font-medium ${rLikeColor} hover:text-pink-500 transition-colors">
                                                <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' ${rLikeFill}">favorite</span>
                                                <span onclick="openUserListModal(${reply.id}, 'reply')" class="cursor-pointer hover:text-white">${replyLikeCount > 0 ? replyLikeCount : 'Like'}</span>
                                            </button>
                                            <button onclick="toggleReplyInput(${comment.id}, '@${replyUser.name.replace(/\s+/g, '').toLowerCase()} ')" class="flex items-center gap-1 text-[10px] font-medium text-secondary-text hover:text-white transition-colors">
                                                <span class="material-symbols-outlined text-[14px]">reply</span>
                                                <span>Reply</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                `;
                            }).join('');
                        }
                        repliesHTML += '</div>';

                        return `
                             <div class="flex gap-3 items-start animate-fade-in group/comment" id="post-comment-row-${comment.id}">
                                ${renderAvatarHTML(user, "w-8 h-8 rounded-full border border-white/10 cursor-pointer object-cover", `onclick="window.location.href='profile.html?id=${user.id}'"`)}
                                <div class="flex-1">
                                    <div class="bg-white/5 rounded-2xl p-3 border border-white/10 relative">
                                        <div class="flex justify-between items-start mb-1">
                                            <div class="flex flex-col">
                                                <h4 class="font-bold text-white text-sm cursor-pointer hover:text-blue-400 transition-colors" onclick="window.location.href='profile.html?id=${user.id}'">${user.name}</h4>
                                                <span class="text-[10px] text-secondary-text">${timeAgo(comment.created_at)}</span>
                                            </div>
                                            
                                            <div class="relative group">
                                                <button onclick="togglePostCommentMenu(event, this)" class="text-slate-500 hover:text-white p-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                                    <span class="material-symbols-outlined text-[16px]">more_horiz</span>
                                                </button>
                                                <!-- Dropdown -->
                                                <div class="post-comment-menu absolute right-0 top-6 w-32 bg-[#1e2330] border border-white/10 rounded-lg shadow-xl py-1 z-20 opacity-0 scale-95 pointer-events-none transition-all duration-200 origin-top-right">
                                                    ${isOwner ? `
                                                    <button onclick="editPostComment(${comment.id})" class="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                                                        <span class="material-symbols-outlined text-[14px]">edit</span> Edit
                                                    </button>` : ''}
                                                    
                                                    ${isOwner || isAdmin ? `
                                                    <button onclick="deletePostComment(${comment.id}, this)" class="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/10 flex items-center gap-2">
                                                        <span class="material-symbols-outlined text-[14px]">delete</span> Delete
                                                    </button>` : ''}

                                                    ${!isOwner ? `
                                                    <button onclick="openReportModal(${comment.id}, 'comment')" class="w-full text-left px-3 py-2 text-xs text-yellow-500 hover:bg-white/10 flex items-center gap-2">
                                                        <span class="material-symbols-outlined text-[14px]">flag</span> Report
                                                    </button>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <p class="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap comment-text break-words">${comment.comment}</p>
                                        ${comment.attachments && comment.attachments.length > 0 ? `
                                        <div class="mt-2 flex flex-wrap gap-2">
                                            ${comment.attachments.map(att => {
                                                const path = att.file_path.startsWith('http') ? att.file_path : `${window.PUBLIC_URL}/${att.file_path}`;
                                                if (['image', 'jpg', 'png', 'jpeg', 'gif'].includes(att.file_type) || /\.(jpg|jpeg|png|gif)$/i.test(path)) {
                                                    return `<div class="relative group cursor-pointer" onclick="openMediaModal('${path}', 'image')"><img src="${path}" class="w-32 h-32 object-cover rounded-lg border border-white/10" alt="Attachment"></div>`;
                                                } else if (['video', 'mp4', 'mov', 'avi'].includes(att.file_type) || /\.(mp4|mov|avi)$/i.test(path)) {
                                                    return `<div class="relative group w-32 h-32 cursor-pointer" onclick="openMediaModal('${path}', 'video')"><video src="${path}" class="w-full h-full object-cover rounded-lg border border-white/10"></video><div class="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all"><span class="material-symbols-outlined text-white text-3xl">play_circle</span></div></div>`;
                                                } else {
                                                    return `<a href="${path}" target="_blank" class="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"><span class="material-symbols-outlined text-slate-400">description</span><span class="text-xs text-blue-400 underline">View Attachment</span></a>`;
                                                }
                                            }).join('')}
                                        </div>` : ''}
                                    </div>
                                    <div class="flex items-center gap-4 mt-1.5 ml-2">
                                        <button onclick="likeComment(${comment.id}, this)" class="flex items-center gap-1.5 text-xs font-medium ${likeColorClass} hover:text-pink-500 transition-colors group">
                                            <span class="material-symbols-outlined text-[16px] group-hover:scale-110 transition-transform" style="font-variation-settings: 'FILL' ${likeFill}">favorite</span>
                                            <span class="group-hover:text-white">${likeCount > 0 ? likeCount : 'Like'}</span>
                                        </button>
                                        <button onclick="toggleReplyInput(${comment.id})" class="flex items-center gap-1.5 text-xs font-medium text-secondary-text hover:text-blue-400 transition-colors">
                                            <span class="material-symbols-outlined text-[16px]">chat_bubble</span>
                                            <span>Reply</span>
                                        </button>
                                    </div>

                                    <!-- Reply Input -->
                                    <div id="reply-box-${comment.id}" class="hidden mt-3 ml-2 flex gap-2 items-center animate-fade-in-up">
                                         <!-- Avatar or just input? -->
                                         <button class="shrink-0">
                                            ${renderAvatarHTML(currentUserData || userData, "w-6 h-6 rounded-full border border-white/10 object-cover")}
                                         </button>
                                         <div class="flex-1 relative">
                                            <textarea id="reply-input-${comment.id}" 
                                                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all resize-none overflow-hidden"
                                                rows="1"
                                                placeholder="Write a reply..."
                                                oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'"></textarea>
                                            <button onclick="submitReply(${comment.id})" class="absolute right-2 bottom-1.5 p-1 rounded-lg text-blue-400 hover:bg-blue-600/20 hover:text-white transition-all">
                                                <span class="material-symbols-outlined text-[16px]">send</span>
                                            </button>
                                            <div class="absolute right-10 bottom-1.5">
                                                <label for="reply-file-${comment.id}" class="cursor-pointer text-slate-400 hover:text-white transition-colors p-1">
                                                    <span class="material-symbols-outlined text-[18px]">attach_file</span>
                                                    <input type="file" id="reply-file-${comment.id}" class="hidden" onchange="handleCommentFileSelect(event, 'reply-preview-${comment.id}')">
                                                </label>
                                            </div>
                                         </div>
                                    </div>
                                    <div id="reply-preview-${comment.id}" class="mt-2 ml-12 hidden"></div>

                                    ${repliesHTML}
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    list.innerHTML = '<div class="text-xs text-secondary-text text-center py-4">No comments yet. Be the first to say something!</div>';
                }
            } catch(e) {
                console.error(e);
                list.innerHTML = '<div class="text-xs text-red-400 text-center py-2">Failed to load comments.</div>';
            }
    }
}

function toggleReplyInput(commentId, mention = '') {
    const box = document.getElementById(`reply-box-${commentId}`);
    const input = document.getElementById(`reply-input-${commentId}`);
    
    box.classList.remove('hidden');
    
    if(mention) {
        input.value = mention;
    }
    
    setTimeout(() => {
        input.focus();
        if(mention) input.setSelectionRange(input.value.length, input.value.length);
    }, 50);
}

async function likeComment(commentId, btn) {
    const icon = btn.querySelector('.material-symbols-outlined');
    const bgClass = btn.classList.contains('text-pink-500');
    const countSpan = btn.querySelector('span:last-child');
    let count = parseInt(countSpan.innerText) || 0;

    if (bgClass) {
        btn.classList.remove('text-pink-500');
        btn.classList.add('text-secondary-text');
        icon.style.fontVariationSettings = "'FILL' 0";
        count = Math.max(0, count - 1);
    } else {
        btn.classList.add('text-pink-500');
        btn.classList.remove('text-secondary-text');
        icon.style.fontVariationSettings = "'FILL' 1";
        count++;
    }
    countSpan.innerText = count > 0 ? count : 'Like';

    try {
        await fetch(`${API_BASE_URL}/add_reaction_to_comment`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment_id: commentId, type: 1 })
        });
    } catch (e) { console.error(e); }
}

async function likeReply(replyId, btn) {
    const icon = btn.querySelector('.material-symbols-outlined');
    const bgClass = btn.classList.contains('text-pink-500');
    const countSpan = btn.querySelector('span:last-child');
    let count = parseInt(countSpan.innerText) || 0;

    if (bgClass) {
        btn.classList.remove('text-pink-500');
        btn.classList.add('text-secondary-text');
        icon.style.fontVariationSettings = "'FILL' 0";
        count = Math.max(0, count - 1);
    } else {
        btn.classList.add('text-pink-500');
        btn.classList.remove('text-secondary-text');
        icon.style.fontVariationSettings = "'FILL' 1";
        count++;
    }
    countSpan.innerText = count > 0 ? count : 'Like';
    
    try {
        await fetch(`${API_BASE_URL}/add_reaction_to_comment_reply`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment_reply_id: replyId, type: 1 })
        });
    } catch (e) {
        console.error(e);
    }
}

async function submitReply(commentId) {
    const input = document.getElementById(`reply-input-${commentId}`);
    const content = input.value.trim();
    if(!content) return;

    try {
        const fileInput = document.getElementById(`reply-file-${commentId}`);
        const formData = new FormData();
        formData.append('comment_id', commentId);
        formData.append('reply', content);

        if (fileInput && fileInput.files.length > 0) {
            formData.append('attachments[]', fileInput.files[0]);
        }

        const response = await fetch(`${API_BASE_URL}/create_comment_reply`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('auth_token')}` },
            body: formData
        });
        const data = await response.json();
        
        if(response.status === 200 || response.status === 202 || data.success) {
                input.value = '';
                toggleReplyInput(commentId);
                showToast('Reply posted! ↩️');
                
                // Immediate Append
                if(data.data) {
                    const reply = data.data; // data.data should be the reply object
                    const container = document.getElementById(`replies-container-${commentId}`);
                    
                    if(container) {
                        container.classList.remove('hidden');
                        const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');
                        
                        // Handle attachments if returned
                        let attachmentHtml = '';
                        if(reply.attachments && reply.attachments.length > 0) {
                            // ... simple loop logic ... 
                        }
                        
                        const replyHtml = `
                        <div class="flex gap-3 items-start animate-fade-in" id="post-comment-row-${reply.id}">
                            ${renderAvatarHTML(currentUser, "w-6 h-6 rounded-full border border-white/10 cursor-pointer object-cover", `onclick="window.location.href='profile.html?id=${currentUser.id}'"`)}
                            <div class="flex-1">
                                <div class="bg-white/5 rounded-xl p-2 px-3 border border-white/10 group/reply relative">
                                    <div class="flex justify-between items-start mb-0.5">
                                        <h4 class="font-bold text-white text-[11px] cursor-pointer hover:underline" onclick="window.location.href='profile.html?id=${currentUser.id}'">${currentUser.name}</h4>
                                        <div class="flex items-center gap-2">
                                            <span class="text-[9px] text-slate-500">Just now</span>
                                            <div class="relative group">
                                                <button onclick="togglePostCommentMenu(event, this)" class="text-slate-500 hover:text-white p-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                                                    <span class="material-symbols-outlined text-[14px]">more_horiz</span>
                                                </button>
                                                <div class="post-comment-menu absolute right-0 top-5 w-24 bg-[#1e2330] border border-white/10 rounded-lg shadow-xl py-1 z-20 opacity-0 scale-95 pointer-events-none transition-all duration-200 origin-top-right">
                                                    <button onclick="editPostReply(${reply.id})" class="w-full text-left px-3 py-1.5 text-[10px] text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-1.5">
                                                        <span class="material-symbols-outlined text-[12px]">edit</span> Edit
                                                    </button>
                                                    <button onclick="deletePostReply(${reply.id}, this)" class="w-full text-left px-3 py-1.5 text-[10px] text-red-400 hover:bg-white/10 flex items-center gap-1.5">
                                                        <span class="material-symbols-outlined text-[12px]">delete</span> Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p class="text-slate-300 text-xs whitespace-pre-wrap comment-text break-words">${content}</p>
                                </div>
                            </div>
                        </div>`;
                        
                        container.insertAdjacentHTML('beforeend', replyHtml);
                    } else {
                        // Fallback if container not found (e.g. strange state), reload
                         if (typeof loadTabContent === 'function') loadTabContent();
                         else if (typeof loadPosts === 'function') loadPosts();
                    }
                } else {
                     // Fallback if no data
                     if (typeof loadTabContent === 'function') loadTabContent();
                     else if (typeof loadPosts === 'function') loadPosts();
                }
        } else {
                showToast(data.message || 'Failed to reply', 'error');
        }
    } catch(e) {
            console.error(e);
            showToast('Error replying', 'error');
    }
}

async function submitComment(postId) {
        const input = document.getElementById(`comment-input-${postId}`);
        const content = input.value.trim();
        if(!content) return;

        try {
            const fileInput = document.getElementById(`comment-file-${postId}`);
            const formData = new FormData();
            formData.append('post_id', postId);
            formData.append('comment', content);
            
            if (fileInput && fileInput.files.length > 0) {
                // Laravel expects array for multiple, checking singular implementation
                // Based on previous code, controller expects 'attachments' array
                formData.append('attachments[]', fileInput.files[0]);
            }

            const response = await fetch(`${API_BASE_URL}/create_comment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // Content-Type must be undefined for FormData boundary
                },
                body: formData
            });
            
            const data = await response.json();
            
            if(data.success) {
                input.value = '';
                showToast('Comment posted! 💬');
                toggleCommentSection(postId); // Close on success
                
                // This is a profile-specific or dashboard-specific callback.
                // We'll check if loadTabContent (profile) or loadPosts (dashboard) exists
                if (typeof loadTabContent === 'function') loadTabContent();
                else if (typeof loadPosts === 'function') loadPosts();
                else if (typeof loadPostDetail === 'function') loadPostDetail();
                
            } else {
                showToast(data.message || 'Failed to post comment', 'error');
            }
        } catch(e) {
            console.error(e);
            showToast('Error posting comment', 'error');
        }
}

async function likePost(id, btn) {
    const icon = btn.querySelector('.material-symbols-outlined');
    const isLiked = btn.classList.contains('text-pink-500');
    const countSpan = btn.nextElementSibling;
    let currentCount = parseInt(countSpan.innerText) || 0;
    
    if (isLiked) {
        btn.classList.remove('text-pink-500');
        btn.classList.add('text-secondary-text');
        icon.style.fontVariationSettings = "'FILL' 0";
        if(currentCount > 0) countSpan.innerText = currentCount - 1 || '';
    } else {
        btn.classList.remove('text-secondary-text');
        btn.classList.add('text-pink-500');
        icon.style.fontVariationSettings = "'FILL' 1";
        countSpan.innerText = currentCount + 1;
    }

    try {
        await fetch(`${API_BASE_URL}/add_reaction_to_post`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                post_id: id,
                type: 1 
            })
        });
    } catch (e) {
        console.error(e);
        // Revert on error if needed
    }
}

// Likers Modal Logic
// Generic User List Modal Logic
if (typeof window.likersModalOpen === 'undefined') {
    window.likersModalOpen = false;
}
// Remove let to avoid SyntaxError

// Can be called with (id, type) for fetching, OR (title, userList) for direct display
async function openUserListModal(arg1, arg2) {
    const modal = document.getElementById('likers-modal');
    const list = document.getElementById('likers-list');
    
    if(!modal) return console.error("User list modal element not found");

    modal.classList.remove('hidden');
    setTimeout(() => modal.firstElementChild.classList.remove('scale-95', 'opacity-0'), 10);
    window.likersModalOpen = true;

    const titleEl = modal.querySelector('h3');
    list.innerHTML = '<div class="text-center text-slate-400 py-8">Loading...</div>';

    // Check if arg2 is an array (Direct Mode for Followers/Following)
    if (Array.isArray(arg2)) {
        if (titleEl) titleEl.textContent = arg1; // arg1 is Title
        renderUserList(arg2, list);
        return;
    }

    // Fetch Mode (Likers)
    const id = arg1;
    const type = arg2 || 'post'; // post, comment, reply

    if(titleEl) titleEl.textContent = type === 'post' ? 'Post Likes' : type === 'comment' ? 'Comment Likes' : 'Reply Likes';

    let endpoint = '/get_post_reactions';
    let body = { post_id: id };

    if (type === 'comment') {
        endpoint = '/get_comment_reactions';
        body = { comment_id: id };
    } else if (type === 'reply') {
        endpoint = '/get_reply_reactions';
        body = { reply_id: id };
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await response.json();

        if (data.success && data.data.items) {
            renderUserList(data.data.items, list);
        } else {
            list.innerHTML = '<div class="text-center text-slate-500 py-8">No users found.</div>';
        }
    } catch(e) {
        console.error(e);
        list.innerHTML = `<div class="text-center text-red-400 py-8">Failed to load.</div>`;
    }
}

function renderUserList(users, container) {
    if (!users || users.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-500 py-8">List is empty.</div>';
        return;
    }

    container.innerHTML = users.map(user => {
        // Handle varying structure if API returns nested object, but typically we want the User object
        // If 'creator' exists (from reactions), use it, otherwise assume 'user' IS the user object
        const u = user.creator || user; 
        
        return `
        <div class="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors cursor-pointer" onclick="window.location.href='profile.html?id=${u.id}'">
            <div class="flex items-center gap-3">
                ${renderAvatarHTML(u, "w-10 h-10 rounded-full border border-white/10 object-cover")}
                <div>
                    <h4 class="font-bold text-white text-sm">${u.name || 'Unknown User'}</h4>
                    <p class="text-xs text-slate-400">@${(u.name || '').replace(/\s+/g, '').toLowerCase()}</p>
                </div>
            </div>
             <!-- Optional: Add Follow Button here if needed in future -->
        </div>
    `}).join('');
}

function closeLikersModal() {
    const modal = document.getElementById('likers-modal');
    if(!modal) return;
    
    modal.firstElementChild.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
    window.likersModalOpen = false;
}

// Initialize modal listener if element exists
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('likers-modal');
    if(modal) {
        modal.addEventListener('click', (e) => {
            if(e.target === modal) closeLikersModal();
        });
    }
});
// --- Report Functions ---
window.openReportModal = function(id, type) {
    window.closeAllPostMenus();
    document.getElementById('report-target-id').value = id;
    document.getElementById('report-target-type').value = type;
    document.getElementById('report-modal').classList.remove('hidden');
}

window.closeReportModal = function() {
    document.getElementById('report-modal').classList.add('hidden');
    // internal reset
    const input = document.getElementById('report-reason-input');
    if (input) input.value = '';
}

window.submitReport = async function() {
    const id = document.getElementById('report-target-id').value;
    const type = document.getElementById('report-target-type').value;
    const reasonInput = document.getElementById('report-reason-input');
    const reason = reasonInput.value.trim();

    if (!reason) {
        showToast('Please provide a reason for the report', 'error');
        return;
    }
    
    // Optimistic UI close
    closeReportModal();

    try {
        const response = await fetch(`${API_BASE_URL}/report_content`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                reportable_id: id,
                reportable_type: type, // 'post', 'comment', or 'reply'
                reason: reason
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showToast('Report submitted. Thank you for making our community safer.', 'success');
        } else {
            showToast(data.message || 'Failed to submit report', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Network error while reporting', 'error');
    }
}

async function sharePost(postId) {
    const shareUrl = `${window.location.origin}/post-detail-veiw.html?id=${postId}`;
    const shareData = {
        title: 'Check out this post!',
        text: 'Found this interesting post on Social App',
        url: shareUrl
    };

    let shared = false;

    // 1. Try Native Share (Mobile/Supported Desktops)
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            shared = true;
        } catch (err) {
            console.log('Share canceled or failed', err);
            // If user canceled, we arguably shouldn't count it, but distincting cancel vs error is hard consistently
        }
    } else {
        // 2. Fallback: Copy to Clipboard
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast('Link copied to clipboard! 📋', 'success');
            shared = true;
        } catch (err) {
            console.error('Clipboard failed', err);
            prompt('Copy this link:', shareUrl); // Ultimate fallback
            shared = true; // Assume they copied it
        }
    }

    // 3. If sharing action was initiated/completed, track it in backend (increment count)
    if (shared) {
        try {
            // We use the same 'share_post' endpoint. 
            // In the future, if you have distinct "Retweet" vs "External Share", you can add a 'type' field.
            // For now, this lets us track the "Share Count".
            fetch(`${API_BASE_URL}/share_post`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ post_id: postId })
            }).then(res => res.json()).then(data => {
                if(data.success && typeof loadPosts === 'function') {
                    // Optional: update UI count locally or reload
                    // loadPosts(); // Reloading might be disruptive if just copying link, maybe just leave count as is until refresh
                }
            });
        } catch (e) {
            console.error('Failed to track share', e);
        }
    }
}

// Post Actions: Edit & Delete

async function deletePost(postId) {
    if(!confirm("Are you sure you want to delete this post? This cannot be undone.")) return;
    
    // Optimistic UI: Remove from DOM immediately
    let removed = false;
    
    // Find the closest article or post container
    // Strategy: Look for the delete button that called this, but since we don't have 'this' reference passed efficiently in all calls (some are onclick="deletePost(id)"), 
    // we search for the specific post element by ID or internal attribute if possible.
    // Or we find ANY element related to this post ID.
    // best way: add id="post-${postId}" to article? createPostHTML doesn't seem to add it yet.
    // Fallback: search by content or unique button attribute.
    
    // Try to find the delete button for this post, or use a more robust selector if we added ID.
    // Currently createPostHTML produces: <article ...> ... deletePost(${post.id}) ... </article>
    // We can iterate articles or use XPath, but simpler is to assume we can find the button.
    const allDeleteBtns = Array.from(document.querySelectorAll(`button[onclick*="deletePost(${postId})"]`));
    allDeleteBtns.forEach(btn => {
         const article = btn.closest('article');
         if(article) {
             article.style.transition = "opacity 0.3s, transform 0.3s";
             article.style.opacity = "0";
             article.style.transform = "scale(0.95)";
             setTimeout(() => article.remove(), 300); // Remove after animation
             removed = true;
         }
    });

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/delete_post`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ id: postId })
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Post deleted successfully', 'success');
             // Also update cache if possible so reload doesn't bring it back
             try {
                 const cached = localStorage.getItem('home_posts_cache');
                 if(cached) {
                     let parsed = JSON.parse(cached);
                     // Helper to filter recursive
                     if(Array.isArray(parsed)) {
                         parsed = parsed.filter(p => p.id !== postId);
                     } else if (parsed.data && Array.isArray(parsed.data)) {
                         parsed.data = parsed.data.filter(p => p.id !== postId);
                     } else if (parsed.items && Array.isArray(parsed.items)) { // pagination wrapper
                         parsed.items = parsed.items.filter(p => p.id !== postId);
                     } else if (parsed.data && parsed.data.items && Array.isArray(parsed.data.items)) {
                         parsed.data.items = parsed.data.items.filter(p => p.id !== postId);
                     }
                     localStorage.setItem('home_posts_cache', JSON.stringify(parsed));
                 }
             } catch(e) { console.warn("Cache update failed", e); }

            if (!removed) {
                 // Only reload if we couldn't find/remove it visally
                 setTimeout(() => window.location.reload(), 1000); 
            }
        } else {
            showToast(data.message || 'Failed to delete post', 'error');
            // Restore if failed? (Rare, but good UX would be to unhide)
            if(removed) window.location.reload(); // Simplest fallback
        }
    } catch (e) {
        console.error(e);
        showToast('Error deleting post', 'error');
        if(removed) window.location.reload();
    }
}

async function editPost(postId) {
    // Try to find post in local cache first
    let post = null;
    const cached = localStorage.getItem('home_posts_cache');
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            const items = Array.isArray(parsed) ? parsed : (parsed.items ? parsed.items : (parsed.data ? parsed.data : []));
            post = items.find(p => p.id === postId);
        } catch (e) { console.error("Cache parse error", e); }
    }

    // If not in cache, fallback to simple prompt (or fetch individual post - simpler to prompt for now if completely missing, but likely in cache if clicked)
    if (post && typeof window.triggerEditPost === 'function') {
        window.triggerEditPost(post);
    } else {
        // Fallback for pages where triggerEditPost might not be available (e.g. profile page?)
        // If we are on profile page, we might not have triggerEditPost or the Create Post form.
        // CHECK: Does profile.html have Create Post form? Usually no.
        // User said: "agr post edit kr rha to wo upr jaga post create krta ha waha chla aya".
        // This implies if I am on Profile, I should probably redirect to Home?
        // Or if Profile has a create form.
        // Let's assume Home for now. If on profile, maybe redirect to home?
        if (window.location.pathname.includes('homefeed') || document.getElementById('create-post-content')) {
             if(post) window.triggerEditPost(post);
        } else {
             // Fallback to prompt if not on dashboard
             const newBody = prompt("Edit your post caption:", post ? post.body : "");
             if (newBody === null) return;
             
             try {
                const token = localStorage.getItem('auth_token');
                const response = await fetch(`${API_BASE_URL}/update_post`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ id: postId, body: newBody })
                });
                const data = await response.json();
                if (data.success) {
                    showToast('Post updated successfully', 'success');
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    showToast(data.message || 'Failed to update post', 'error');
                }
             } catch(e) { console.error(e); }
        }
    }
}

// --- Post Comment Actions ---
window.closeAllPostMenus = function() {
    document.querySelectorAll('.post-comment-menu.active').forEach(el => {
        el.classList.remove('active', 'scale-100', 'opacity-100');
        el.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
    });
};

window.togglePostCommentMenu = function(e, btn) {
    if(e) e.stopPropagation();
    const menu = btn.nextElementSibling;
    
    // Check if we are opening a menu that is already open (toggle off)
    let isAlreadyOpen = menu.classList.contains('active');
    
    // Close ALL menus first
    window.closeAllPostMenus();
    
    // If it wasn't open, open it now
    if (!isAlreadyOpen) {
        menu.classList.add('active', 'scale-100', 'opacity-100', 'pointer-events-auto');
        menu.classList.remove('scale-95', 'opacity-0', 'pointer-events-none');
    }
};

window.updatePostCommentCountUI = function(elementWithinPost, delta) {
    const section = elementWithinPost.closest('[id^="comment-section-"]');
    if(!section) return;
    
    const postId = section.id.replace('comment-section-', '');
    const postArticle = document.getElementById(`post-${postId}`);
    
    // Find the comment button. It calls toggleCommentSection(postId)
    let btn = null;
    const selector = `button[onclick*="toggleCommentSection(${postId})"]`;
    
    if(postArticle) {
        btn = postArticle.querySelector(selector);
    } else {
        btn = document.querySelector(selector);
    }
    
    if(btn) {
       const countSpan = btn.querySelector('span:last-child');
       if(countSpan) {
           let text = countSpan.innerText;
           let count = parseInt(text);
           if(isNaN(count)) count = 0; // 'Comment' = 0
           
           count += delta;
           
           if(count <= 0) countSpan.innerText = 'Comment';
           else countSpan.innerText = count;
       }
    }
};

window.deletePostComment = async function(commentId, btn) {
    window.closeAllPostMenus();
    if(!confirm("Delete this comment?")) return;
    
    updatePostCommentCountUI(btn, -1);
    
    const commentRow = document.getElementById(`post-comment-row-${commentId}`);
    
    // Optimistic Remove
    if(commentRow) {
        commentRow.style.transition = 'all 0.3s ease';
        commentRow.style.opacity = '0';
        setTimeout(() => commentRow.remove(), 300);
    }
    
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/delete_comment`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: commentId })
        });
        const data = await response.json();
        if(!data.success) {
            alert(data.message || 'Delete failed');
        } 
    } catch(e) { console.error(e); }
};

window.editPostComment = function(commentId) {
    window.closeAllPostMenus();
    const commentRow = document.getElementById(`post-comment-row-${commentId}`);
    const textP = commentRow.querySelector('.comment-text'); 
    const originalText = textP.textContent;
    
    textP.classList.add('hidden');
    
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container mt-2';
    editContainer.innerHTML = `
        <input type="text" class="w-full bg-[#151921] text-white text-xs rounded-lg px-3 py-2 border border-white/10 focus:border-blue-500 outline-none" value="${originalText.replace(/"/g, '&quot;')}">
        <div class="flex justify-end gap-2 mt-2">
            <button onclick="cancelPostCommentEdit(${commentId}, '${originalText.replace(/'/g, "\\'")}')" class="text-[10px] text-slate-400 hover:text-white px-2 py-1">Cancel</button>
            <button onclick="savePostCommentEdit(${commentId})" class="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-md font-bold">Save</button>
        </div>
    `;
    
    // Insert after p parent div (the bg-white/5 box)
    // Actually the comment-text is often inside the bubble.
    // textP.parentNode is the bubble div.
    textP.parentNode.insertBefore(editContainer, textP.nextSibling);
    
     // Hide Menu
    const menu = commentRow.querySelector('.post-comment-menu');
    if(menu) menu.classList.remove('active', 'scale-100', 'opacity-100');
};

window.cancelPostCommentEdit = function(commentId, originalText) {
    const commentRow = document.getElementById(`post-comment-row-${commentId}`);
    const textP = commentRow.querySelector('.comment-text');
    const editContainer = commentRow.querySelector('.edit-container');
    
    if(editContainer) editContainer.remove();
    textP.textContent = originalText;
    textP.classList.remove('hidden');
};

window.savePostCommentEdit = async function(commentId) {
    const commentRow = document.getElementById(`post-comment-row-${commentId}`);
    const editContainer = commentRow.querySelector('.edit-container');
    const input = editContainer.querySelector('input');
    const newText = input.value.trim();
    
    if(!newText) return;
    
    const textP = commentRow.querySelector('.comment-text');
    textP.textContent = newText;
    textP.classList.remove('hidden');
    editContainer.remove();
    
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/update_comment`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: commentId, comment: newText })
        });
        const data = await response.json();
         if(!data.success) {
            alert('Update failed: ' + data.message);
        }
    } catch(e) { console.error(e); }
};

window.editPostReply = function(replyId) {
    window.closeAllPostMenus();
    const row = document.getElementById(`post-comment-row-${replyId}`);
    const textP = row.querySelector('.comment-text'); 
    const originalText = textP.textContent;
    
    textP.classList.add('hidden');
    
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container mt-2';
    editContainer.innerHTML = `
        <input type="text" class="w-full bg-[#151921] text-white text-xs rounded-lg px-3 py-2 border border-white/10 focus:border-blue-500 outline-none" value="${originalText.replace(/"/g, '&quot;')}">
        <div class="flex justify-end gap-2 mt-2">
            <button onclick="cancelPostReplyEdit(${replyId}, '${originalText.replace(/'/g, "\\'")}')" class="text-[10px] text-slate-400 hover:text-white px-2 py-1">Cancel</button>
            <button onclick="savePostReply(${replyId})" class="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-md font-bold">Save</button>
        </div>
    `;
    textP.parentNode.insertBefore(editContainer, textP.nextSibling);

    const menu = row.querySelector('.post-comment-menu');
    if(menu) menu.classList.remove('active', 'scale-100', 'opacity-100');
};

window.cancelPostReplyEdit = function(replyId, originalText) {
    const row = document.getElementById(`post-comment-row-${replyId}`);
    const textP = row.querySelector('.comment-text');
    const editContainer = row.querySelector('.edit-container');
    
    if(editContainer) editContainer.remove();
    textP.textContent = originalText;
    textP.classList.remove('hidden');
};

window.savePostReply = async function(replyId) {
    const row = document.getElementById(`post-comment-row-${replyId}`);
    const editContainer = row.querySelector('.edit-container');
    const input = editContainer.querySelector('input');
    const newText = input.value.trim();
    
    if(!newText) return;
    
    const textP = row.querySelector('.comment-text');
    textP.textContent = newText;
    textP.classList.remove('hidden');
    editContainer.remove();
    
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/update_comment_reply`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: replyId, reply: newText })
        });
        const data = await response.json();
         if(!data.success) {
            showToast(data.message || 'Update failed', 'error');
        } else {
            showToast('Reply updated', 'success');
        }
    } catch(e) { console.error(e); }
};

// Global click closer for post menus
document.addEventListener('click', (e) => {
    if (!e.target.closest('.group.relative')) {
        document.querySelectorAll('.post-comment-menu.active').forEach(el => {
            el.classList.remove('active', 'scale-100', 'opacity-100');
            el.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
        });
    }
});

// New Delete Reply Function
window.deletePostReply = async function(replyId, btn) {
    window.closeAllPostMenus();
    if(!confirm("Delete this reply?")) return;
    
    updatePostCommentCountUI(btn, -1);
    
    // Optimistic Remove
    // Note: Render uses same ID convention for replies: post-comment-row-${reply.id}
    const row = document.getElementById(`post-comment-row-${replyId}`);
    if(row) {
        row.style.transition = 'all 0.3s ease';
        row.style.opacity = '0';
        setTimeout(() => row.remove(), 300);
    }
    
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/delete_comment_reply`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: replyId })
        });
        const data = await response.json();
        if(!data.success) {
            showToast(data.message || 'Delete failed', 'error');
        } 
    } catch(e) { console.error(e); }
};

// --- Attachment Helper Functions ---
window.handleFileSelect = function(event, previewId) {
    const file = event.target.files[0];
    const previewContainer = document.getElementById(previewId);
    if (!previewContainer) return;
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewContainer.innerHTML = `
                <div class="relative inline-block mt-2">
                    ${file.type.startsWith('image/') 
                        ? `<img src="${e.target.result}" class="h-24 w-auto rounded-lg border border-white/10 object-cover shadow-lg">` 
                        : `<div class="h-20 w-auto px-4 flex items-center justify-center bg-white/10 rounded-lg border border-white/10 gap-2"><span class="material-symbols-outlined text-white">description</span><span class="text-xs text-white">${file.name}</span></div>`
                    }
                    <button onclick="clearFileSelection('${event.target.id}', '${previewId}')" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600 transition-colors">
                        <span class="material-symbols-outlined text-[14px]">close</span>
                    </button>
                </div>
            `;
            previewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        previewContainer.innerHTML = '';
        previewContainer.classList.add('hidden');
    }
};

window.clearFileSelection = function(inputId, previewId) {
    const input = document.getElementById(inputId);
    if(input) input.value = '';
    const previewContainer = document.getElementById(previewId);
    if(previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.classList.add('hidden');
    }
};

// --- Updated Submit Logic with Previews ---

window.submitComment = async function(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    const fileInput = document.getElementById(`comment-file-${postId}`);
    
    if(!content && (!fileInput || fileInput.files.length === 0)) return;

    try {
        const formData = new FormData();
        formData.append('post_id', postId);
        formData.append('comment', content);
        
        if(fileInput && fileInput.files.length > 0) {
            formData.append('attachments[]', fileInput.files[0]);
        }

        const response = await fetch(`${API_BASE_URL}/create_comment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.token || localStorage.getItem('auth_token')}`
            },
            body: formData
        });

        const data = await response.json();
        
        if(data.success) {
            input.value = '';
            if(fileInput) fileInput.value = '';
            const previewId = `comment-preview-${postId}`;
            const previewContainer = document.getElementById(previewId);
            if(previewContainer) {
                previewContainer.innerHTML = '';
                previewContainer.classList.add('hidden');
            }

            showToast('Comment posted! 💬');
            // Refresh comments logic
            if(typeof toggleCommentSection === 'function') {
                 toggleCommentSection(postId);
                 setTimeout(() => toggleCommentSection(postId), 100); 
            }
        } else {
            showToast(data.message || 'Failed to post comment', 'error');
        }
    } catch(e) {
        console.error(e);
        showToast('Error posting comment', 'error');
    }
};

window.submitReply = async function(commentId) {
    const input = document.getElementById(`reply-input-${commentId}`);
    const content = input.value.trim();
    const fileInput = document.getElementById(`reply-file-${commentId}`);

    if(!content && (!fileInput || fileInput.files.length === 0)) return;

    try {
        const formData = new FormData();
        formData.append('comment_id', commentId);
        formData.append('reply', content);

        if (fileInput && fileInput.files.length > 0) {
            formData.append('attachments[]', fileInput.files[0]);
        }

        const response = await fetch(`${API_BASE_URL}/create_comment_reply`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.token || localStorage.getItem('auth_token')}`
            },
            body: formData
        });

        const data = await response.json();
        
        if(data.success) {
            input.value = '';
            if(fileInput) fileInput.value = '';
            const previewId = `reply-preview-${commentId}`;
            const previewContainer = document.getElementById(previewId);
            if(previewContainer) {
                previewContainer.innerHTML = '';
                previewContainer.classList.add('hidden');
            }

            showToast('Reply posted! 💬');
            
            // Refresh context
            if (typeof loadTabContent === 'function') loadTabContent();
            else if (typeof loadPosts === 'function') loadPosts();
            else if (typeof loadPostDetail === 'function') loadPostDetail();

        } else {
            showToast(data.message || 'Failed to post reply', 'error');
        }
    } catch(e) {
        console.error(e);
        showToast('Error posting reply', 'error');
    }
};

/**
 * Handles file selection for comments and replies, showing a preview.
 */
window.handleCommentFileSelect = function(event, previewId) {
    const file = event.target.files[0];
    const container = document.getElementById(previewId);
    if(!container) return;
    
    container.innerHTML = '';
    container.classList.add('hidden');
    
    if (file) {
        container.classList.remove('hidden');
        const reader = new FileReader();
        
        if (file.type.startsWith('image/')) {
            reader.onload = function(e) {
                container.innerHTML = `
                    <div class="relative inline-block group mt-2">
                        <img src="${e.target.result}" class="h-20 w-auto rounded-lg border border-white/10 object-cover bg-black/50">
                        <button type="button" onclick="clearCommentFile('${event.target.id}', '${previewId}')" class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-lg transition-colors z-10 flex">
                            <span class="material-symbols-outlined text-[14px]">close</span>
                        </button>
                    </div>`;
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
             container.innerHTML = `
                <div class="relative inline-block group mt-2">
                    <div class="h-20 w-32 bg-black rounded-lg border border-white/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-white/50 text-2xl">videocam</span>
                    </div>
                    <button type="button" onclick="clearCommentFile('${event.target.id}', '${previewId}')" class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-lg transition-colors z-10 flex">
                        <span class="material-symbols-outlined text-[14px]">close</span>
                    </button>
                    <span class="text-[10px] text-slate-400 block mt-1 truncate max-w-[120px]">${file.name}</span>
                </div>`;
        } else {
             container.innerHTML = `
                <div class="relative inline-block group mt-2">
                    <div class="h-10 px-3 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">attachment</span>
                        <span class="text-xs text-slate-300 truncate max-w-[150px]">${file.name}</span>
                    </div>
                    <button type="button" onclick="clearCommentFile('${event.target.id}', '${previewId}')" class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-lg transition-colors z-10 flex">
                        <span class="material-symbols-outlined text-[14px]">close</span>
                    </button>
                </div>`;
        }
    }
}

/**
 * Clears the selected file from the input and hides the preview.
 */
window.clearCommentFile = function(inputId, previewId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(previewId);
    if(input) {
        input.value = ''; // Reset input
    }
    if(container) {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
}

/**
 * Opens a modal to view media (image/video).
 * Dynamically creates the modal if it doesn't exist.
 */
window.openMediaModal = function(src, type) {
    let modal = document.getElementById('media-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'media-modal';
        modal.className = 'fixed inset-0 z-[100] hidden animate-fade-in';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/95 backdrop-blur-md transition-opacity" onclick="closeMediaModal()"></div>
            <div class="absolute inset-0 flex items-center justify-center p-4">
                <div class="relative max-h-[90vh] max-w-[90vw] overflow-visible group">
                     <button onclick="closeMediaModal()" class="absolute -top-12 right-0 z-50 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all border border-white/10">
                        <span class="material-symbols-outlined text-[24px]">close</span>
                     </button>
                     <div id="media-modal-content" class="flex items-center justify-center shadow-2xl rounded-lg overflow-hidden ring-1 ring-white/10 bg-black"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const contentFn = document.getElementById('media-modal-content');
    contentFn.innerHTML = ''; // Clear previous
    
    // Normalize Source
    if (src.startsWith('storage/')) {
        src = `${window.PUBLIC_URL}/${src}`; // Ensure full path if relative
    }
    
    if (type === 'video') {
        contentFn.innerHTML = `
            <video src="${src}" controls autoplay class="max-h-[85vh] max-w-full rounded-lg outline-none"></video>
        `;
    } else {
        contentFn.innerHTML = `
            <img src="${src}" class="max-h-[85vh] max-w-full object-contain rounded-lg" alt="Preview">
        `;
    }
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

/**
 * Closes the media modal.
 */
window.closeMediaModal = function() {
    const modal = document.getElementById('media-modal');
    if (modal) {
        modal.classList.add('hidden');
        const content = document.getElementById('media-modal-content');
        if(content) content.innerHTML = ''; // Stop video playback
    }
    document.body.style.overflow = '';
}
