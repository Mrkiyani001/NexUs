/**
 * Reels Logic
 * Handles fetching and displaying reels from the API
 */

// Config loaded from config.js

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    fetchReels('foryou');
    populateUserProfile();
    fetchSuggestions();
});

let currentMode = 'foryou';

function setupTabs() {
    const tabForYou = document.getElementById('tab-foryou');
    const tabFollowing = document.getElementById('tab-following');

    if (!tabForYou || !tabFollowing) return;

    tabForYou.addEventListener('click', () => switchTab('foryou'));
    tabFollowing.addEventListener('click', () => switchTab('following'));
}

function switchTab(mode) {
    if (currentMode === mode) return;
    currentMode = mode;

    const tabForYou = document.getElementById('tab-foryou');
    const tabFollowing = document.getElementById('tab-following');
    
    // Active classes
    const activeClass = "bg-white/10 backdrop-blur-md text-white border-white/10 border";
    const inactiveClass = "bg-transparent text-white/70";

    // Clean classes
    const removeActive = (el) => {
        el.className = el.className.replace(activeClass, "").replace(inactiveClass, "").trim();
        el.classList.add("px-4", "py-1.5", "rounded-full", "text-xs", "font-semibold", "transition-all", "hover:bg-white/10");
    };

    removeActive(tabForYou);
    removeActive(tabFollowing);

    // Apply new state
    if (mode === 'foryou') {
        tabForYou.classList.add(...activeClass.split(" "));
        tabFollowing.classList.add(...inactiveClass.split(" "));
    } else {
        tabFollowing.classList.add(...activeClass.split(" "));
        tabForYou.classList.add(...inactiveClass.split(" "));
    }

    fetchReels(mode);
}

async function fetchReels(mode = 'foryou') {
    const container = document.getElementById('reels-container');
    const token = localStorage.getItem('auth_token');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        // Show loading state
        container.innerHTML = `
            <div class="h-full w-full flex items-center justify-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        `;

        // Determine Endpoint
        const endpoint = mode === 'following' 
            ? `${API_BASE_URL}/get_following_reels` 
            : `${API_BASE_URL}/get_all_reels`;

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            renderReels(data.data);
        } else {
            // Handle empty state specifically for Following
            if (mode === 'following' && (!data.data || data.data.length === 0)) {
                 container.innerHTML = `
                    <div class="h-full w-full flex flex-col items-center justify-center text-slate-500 min-h-[500px]">
                        <span class="material-symbols-outlined text-5xl mb-4 opacity-50">group_off</span>
                        <p class="text-lg font-medium text-white/80">No following reels</p>
                        <p class="text-sm opacity-60 text-center px-8">Follow people to see their reels here!</p>
                        <a href="homefeed-dashboard.html" class="mt-4 px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm hover:bg-primary/30 transition">Find People</a>
                    </div>
                `;
                return;
            }

            console.error('Failed to fetch reels:', data.message);
            container.innerHTML = `
                <div class="h-full w-full flex flex-col items-center justify-center text-slate-500">
                    <span class="material-symbols-outlined text-4xl mb-2">error</span>
                    <p>Failed to load reels</p>
                    <button onclick="fetchReels('${mode}')" class="mt-4 text-primary hover:underline">Try Again</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching reels:', error);
        container.innerHTML = `
            <div class="h-full w-full flex flex-col items-center justify-center text-slate-500">
                <span class="material-symbols-outlined text-4xl mb-2">wifi_off</span>
                <p>Connection error</p>
                <button onclick="fetchReels()" class="mt-4 text-primary hover:underline">Try Again</button>
            </div>
        `;
    }
}

function renderReels(reels) {
    const container = document.getElementById('reels-container');
    container.innerHTML = '';

    if (!reels || reels.length === 0) {
        container.innerHTML = `
            <div class="h-full w-full flex flex-col items-center justify-center text-slate-500 min-h-[500px]">
                <span class="material-symbols-outlined text-5xl mb-4 opacity-50">movie</span>
                <p class="text-lg font-medium">No reels yet</p>
                <p class="text-sm opacity-70">Be the first to create one!</p>
            </div>
        `;
        return;
    }

    // Observer for Autoplay
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (!video) return;

            if (entry.isIntersecting) {
                // Play video when in view
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Autoplay prevented:", error);
                        // Show play icon if autoplay fails (e.g. valid source but user interaction needed)
                        const playIcon = entry.target.querySelector(`[id^="play-icon-"]`);
                        if (playIcon) playIcon.style.opacity = '1';
                    });
                }
                // Hide play icon when playing
                const playIcon = entry.target.querySelector(`[id^="play-icon-"]`);
                if (playIcon) playIcon.style.opacity = '0';
            } else {
                // Pause when out of view
                video.pause();
                video.currentTime = 0; // Optional: reset to start
            }
        });
    }, { threshold: 0.6 }); // Play when 60% is visible

    reels.forEach(reel => {
        const reelEl = createReelElement(reel);
        container.appendChild(reelEl);
        observer.observe(reelEl);
    });
}

// Helper to construct URL (Centralized Logic)
const getProfilePicture = (user) => {
    if (!user) return `https://ui-avatars.com/api/?name=User&background=random`;

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
};

const getStorageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    // If path is in known public folders (profiles, posts) dont prepend storage
    if (cleanPath.startsWith('profiles/') || cleanPath.startsWith('posts/')) {
         return `${window.PUBLIC_URL}/${cleanPath}`;
    }
    return `${window.PUBLIC_URL}/storage/${cleanPath}`;
};

function createReelElement(reel) {
    const div = document.createElement('div');
div.className = 'snap-center relative shrink-0 w-full h-[calc(100vh-80px)] md:h-[calc(100vh-40px)] rounded-xl overflow-hidden shadow-2xl bg-black border border-white/5 mb-4 group';

// Construct URLs
// Ensure video path is correct. If it's a full URL, use it. If it's a relative path, prepend storage URL.
// Also remove any double slashes if present
let videoUrl = '';
if (reel.video_path) {
    if (reel.video_path.startsWith('http')) {
        videoUrl = reel.video_path;
    } else {
        // Clean path: remove leading slash if present
        const cleanPath = reel.video_path.startsWith('/') ? reel.video_path.substring(1) : reel.video_path;
        videoUrl = `${window.PUBLIC_URL}/storage/${cleanPath}`;
    }
}

let thumbUrl = '';
if (reel.thumbnail_path) {
    if (reel.thumbnail_path.startsWith('http')) {
        thumbUrl = reel.thumbnail_path;
    } else {
        const cleanThumb = reel.thumbnail_path.startsWith('/') ? reel.thumbnail_path.substring(1) : reel.thumbnail_path;
        thumbUrl = `${window.PUBLIC_URL}/storage/${cleanThumb}`;
    }
}

// Unified Avatar Logic
const userAvatar = getProfilePicture(reel.user);
const userName = reel.user ? reel.user.name : 'Unknown User';

div.innerHTML = `
        <video 
            class="h-full w-full object-cover bg-black"
            src="${videoUrl}" 
            loop 
            playsinline>
        </video>
        ${thumbUrl ? `<img src="${thumbUrl}" class="absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-500 pointer-events-none" id="thumb-${reel.id}">` : ''}
            muted 
            onclick="togglePlay(this)"
            onerror="console.error('Video failed to load:', this.src)"
        ></video>
        
        <div class="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"></div>
        <div class="absolute inset-0 reel-overlay-gradient pointer-events-none"></div>
        
        <!-- Action Buttons -->
        <div class="absolute right-4 bottom-24 flex flex-col items-center gap-5 z-20">
        <!-- Like Button -->
        <button onclick="toggleLike(this, ${reel.id})" class="flex flex-col items-center gap-1 group/btn">
            <div class="p-2.5 rounded-full bg-white/10 backdrop-blur-md group-hover/btn:bg-red-500/20 transition-all border border-white/10 group-active/btn:scale-90">
                <span class="material-symbols-outlined text-white text-[28px] group-hover/btn:text-red-500 transition-colors ${reel.is_liked ? 'text-red-500 fill-current' : ''}" style="${reel.is_liked ? "font-variation-settings: 'FILL' 1;" : ''}">favorite</span>
            </div>
            <span class="text-white font-medium text-xs drop-shadow-md">${formatNumber(reel.likes_count || 0)}</span>
        </button>

        <!-- Save Button -->
        <button onclick="toggleSave(this, ${reel.id})" class="flex flex-col items-center gap-1 group/btn">
            <div class="p-2.5 rounded-full bg-white/10 backdrop-blur-md group-hover/btn:bg-yellow-500/20 transition-all border border-white/10 group-active/btn:scale-90">
                <span class="material-symbols-outlined text-white text-[28px] group-hover/btn:text-yellow-500 transition-colors ${reel.is_saved ? 'text-yellow-500 fill-current' : ''}" style="${reel.is_saved ? "font-variation-settings: 'FILL' 1;" : ''}">bookmark</span>
            </div>
             <span class="text-white font-medium text-xs drop-shadow-md">Save</span>
        </button>

        <!-- Comment Button -->
        <button onclick="openComments(${reel.id})" class="flex flex-col items-center gap-1 group/btn">
                <div class="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 transition-all group-hover/btn:bg-white/20 group-hover/btn:scale-110 active:scale-95">
                    <span class="material-symbols-outlined text-white text-[28px]">chat_bubble</span>
                </div>
                <span class="text-xs font-bold text-white drop-shadow-md">${reel.comments_count || 0}</span>
            </button>
            <button onclick="shareReel(${reel.id})" class="group/btn flex flex-col items-center gap-1">
                <div class="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 transition-all group-hover/btn:bg-white/20 group-hover/btn:scale-110 active:scale-95">
                    <span class="material-symbols-outlined text-white text-[28px]">send</span>
                </div>
                <span class="text-xs font-bold text-white drop-shadow-md">Share</span>
            </button>
            <button class="group/btn flex flex-col items-center gap-1 mt-2">
                <div class="flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/10 transition-all">
                    <span class="material-symbols-outlined text-white text-[24px]">more_horiz</span>
                </div>
            </button>
        </div>

        <!-- Mute Toggle (Top Right) -->
        <div class="absolute top-4 right-4 z-30">
             <button onclick="toggleMute(this, ${reel.id})" class="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/60 transition-colors">
                <span class="material-symbols-outlined text-white/70 text-[18px]">volume_off</span>
             </button>
        </div>

        <!-- User Info & Caption -->
        <div class="absolute bottom-0 left-0 w-full p-6 z-20 flex flex-col gap-3">
            <div class="flex items-center gap-3">
                <div class="h-10 w-10 rounded-full border-2 border-white p-0.5 cursor-pointer hover:scale-105 transition-transform">
                    <img alt="Avatar" class="h-full w-full rounded-full object-cover" src="${userAvatar}" />
                </div>
                <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-white drop-shadow-md cursor-pointer hover:underline">${userName}</span>
                        <span class="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded-md border border-blue-400/20 backdrop-blur-sm">Follow</span>
                    </div>
                </div>
            </div>
            <div class="pr-16">
                <p class="text-sm text-white/90 font-medium leading-snug drop-shadow-md">
                    ${reel.caption || ''}
                </p>
            </div>
            
            <!-- Progress Bar (Visual Only for now) -->
            <div class="relative w-full h-1 bg-white/20 rounded-full mt-2 overflow-hidden group/progress cursor-pointer">
                <div class="absolute left-0 top-0 h-full w-[0%] bg-primary shadow-[0_0_10px_rgba(33,91,237,0.8)]" id="progress-${reel.id}"></div>
            </div>
        </div>

        <!-- Play/Pause Overlay Icon -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-300" id="play-icon-${reel.id}">
            <div class="bg-black/40 rounded-full p-4 backdrop-blur-sm">
                <span class="material-symbols-outlined text-white text-5xl">play_arrow</span>
            </div>
        </div>
    `;

    // Thumbnail Logic
    const video = div.querySelector('video');
    const thumbOverlay = div.querySelector(`[id^="thumb-"]`);

    if (video && thumbOverlay) {
        // Allow clicking on thumb to play
        thumbOverlay.style.pointerEvents = 'auto'; // Enable clicks
        thumbOverlay.onclick = () => togglePlay(video);
        
        video.addEventListener('timeupdate', () => {
            if (video.currentTime > 0.2) { // 0.2s delay to ensure first frame rendered
                thumbOverlay.style.opacity = '0';
            }
        });
        
        // Also hide on play just in case, but timeupdate is safer against black frames
        video.addEventListener('playing', () => {
            // setTimeout(() => thumbOverlay.style.opacity = '0', 200);
        });
    }

    return div;
}

const togglePlay = (video) => {
    if (video.paused) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
             playPromise.catch(error => { console.error("Play failed:", error); });
        }
        const container = video.parentElement;
        const playIcon = container.querySelector(`[id^="play-icon-"]`);
        if (playIcon) playIcon.style.opacity = '0';
    } else {
        video.pause();
        const container = video.parentElement;
        const playIcon = container.querySelector(`[id^="play-icon-"]`);
        if (playIcon) playIcon.style.opacity = '1';
    }
};
window.togglePlay = togglePlay;

// Toggle Save
const toggleSave = async (btn, reelId) => {
    // Optimistic UI Update
    const icon = btn.querySelector('.material-symbols-outlined');
    const isSaved = icon.classList.contains('text-yellow-500');
    
    if (isSaved) {
        icon.classList.remove('text-yellow-500', 'fill-current');
        icon.classList.add('text-white');
        icon.style.fontVariationSettings = "'FILL' 0";
    } else {
        icon.classList.add('text-yellow-500', 'fill-current');
        icon.classList.remove('text-white');
        icon.style.fontVariationSettings = "'FILL' 1";
    }

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${window.API_BASE_URL}/save_reel`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reel_id: reelId })
        });
        const data = await response.json();
        
        if (!data.success) {
            // Revert on failure
             if (isSaved) {
                icon.classList.add('text-yellow-500', 'fill-current');
                icon.classList.remove('text-white');
                icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                icon.classList.remove('text-yellow-500', 'fill-current');
                icon.classList.add('text-white');
                icon.style.fontVariationSettings = "'FILL' 0";
            }
            console.error('Save failed:', data.message);
        }
    } catch (error) {
        console.error('Error saving reel:', error);
    }
};

const toggleMute = (btn, videoId) => {
    // Navigate up to find the container, then find the video
    // Or closer: btn is in the action container.
    // The video is a sibling of the overlays.
    // Let's use the reel ID to find the video if possible, or traverse DOM.
    // Since we are inside the 'div', we can traverse up.
    
    // Easier: find the video relative to the button
    const container = btn.closest('.relative.shrink-0'); // The main reel container
    const video = container.querySelector('video');
    const icon = btn.querySelector('.material-symbols-outlined');

    if (video) {
        video.muted = !video.muted;
        if (video.muted) {
            icon.textContent = 'volume_off';
            icon.classList.add('text-white/70');
            icon.classList.remove('text-white');
        } else {
            icon.textContent = 'volume_up';
            icon.classList.remove('text-white/70');
            icon.classList.add('text-white');
        }
    }
    // Prevent bubbling to togglePlay
    if(event) event.stopPropagation();
};

// Toggle Like
const toggleLike = async (btn, reelId) => {
    // Optimistic UI
    const icon = btn.querySelector('.material-symbols-outlined');
    const label = btn.querySelector('span:last-child');
    let count = parseInt(label.textContent.replace('k', '000').replace('M', '000000')) || 0; // Simple parse
    // Better parse? formatNumber does the reverse. 
    // Actually we should store raw count or just increment/decrement
    
    // Check state
    const isLiked = icon.classList.contains('text-red-500');
    
    if (isLiked) {
        icon.classList.remove('text-red-500', 'fill-current');
        icon.classList.add('text-white');
        icon.style.fontVariationSettings = "'FILL' 0";
        // Decrement (visual only initially)
        // label.textContent = formatNumber(Math.max(0, count - 1)); // Hard to reverse formatNumber correctly without raw data. 
        // Let's assume we don't update count optimistically OR we rely on API to return new count? 
        // Reel API usually returns list.
        // We will just toggle icon.
    } else {
        icon.classList.add('text-red-500', 'fill-current');
        icon.classList.remove('text-white');
        icon.style.fontVariationSettings = "'FILL' 1";
    }

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${window.API_BASE_URL}/add_reaction_to_reel`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reel_id: reelId, type: 1 })
        });
        const data = await response.json();
        
        if (!data.success) {
            // Revert
             if (isLiked) {
                icon.classList.add('text-red-500', 'fill-current');
                icon.classList.remove('text-white');
                icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                icon.classList.remove('text-red-500', 'fill-current');
                icon.classList.add('text-white');
                icon.style.fontVariationSettings = "'FILL' 0";
            }
        }
    } catch (e) {
        console.error(e);
    }
}

// Share Reel
const shareReel = async (reelId) => {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${window.API_BASE_URL}/share_reel`, {
            method: 'POST',
            headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reel_id: reelId })
        });
        const data = await response.json();
        if(data.success) {
            alert('Reel shared successfully!');
        } else {
            alert('Failed to share reel');
        }
    } catch (e) {
        console.error(e);
        alert('Error sharing reel');
    }
}


// --- Comments Logic ---

let currentReelIdForComments = null;

function openComments(reelId) {
    currentReelIdForComments = reelId;
    const drawer = document.getElementById('comments-drawer');
    const backdrop = document.getElementById('comments-backdrop');
    
    // Show
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        drawer.classList.remove('translate-y-full');
    });

    // Populate user avatar in input
    const user = JSON.parse(localStorage.getItem('user_data') || '{}');
    const avatarImg = document.getElementById('comment-user-avatar');
    if (avatarImg) {
        avatarImg.src = getProfilePicture(user);
        avatarImg.style.opacity = '1';
    }

    // Load Comments
    fetchComments(reelId);
}

function closeComments() {
    const drawer = document.getElementById('comments-drawer');
    const backdrop = document.getElementById('comments-backdrop');
    
    drawer.classList.add('translate-y-full');
    backdrop.classList.add('opacity-0');
    
    setTimeout(() => {
        backdrop.classList.add('hidden');
        currentReelIdForComments = null;
    }, 300);
}

async function fetchComments(reelId) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '<div class="text-center text-slate-500 py-10">Loading...</div>';
    
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/get_reel_comments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reel_id: reelId, limit: 50 })
        });
        const data = await response.json();
        
        if (data.success && data.data && data.data.items) {
           renderComments(data.data.items);
        } else {
           list.innerHTML = '<div class="text-center text-slate-500 py-10">No comments yet.</div>';
        }
    } catch (e) {
        console.error(e);
        list.innerHTML = '<div class="text-center text-red-500 py-10">Error loading comments.</div>';
    }
}

function renderComments(comments) {
    const list = document.getElementById('comments-list');
    if (comments.length === 0) {
        list.innerHTML = '<div class="text-center text-slate-500 py-10">No comments yet.</div>';
        return;
    }
    
    list.innerHTML = comments.map(comment => {
        const user = comment.user || { name: 'Unknown' };
        const avatar = getProfilePicture(user);
        const replyCount = comment.replies_count || 0; // Assuming backend sends this, or we default 0
        
        return `
            <div class="flex gap-3 items-start" id="comment-${comment.id}">
                 <img src="${avatar}" class="w-8 h-8 rounded-full border border-white/10 object-cover mt-1">
                 <div class="flex-1 space-y-1">
                     <div class="flex items-baseline gap-2">
                         <span class="text-xs font-bold text-white">${user.name}</span>
                         <span class="text-[10px] text-slate-500">${timeAgo(comment.created_at)}</span>
                     </div>
                     <p class="text-sm text-slate-300 leading-snug">${comment.comment}</p>
                     
                     <div class="flex items-center gap-4 mt-1">
                        <button onclick="initiateReply(${comment.id}, '${user.name.replace(/'/g, "\\'")}')" class="text-xs font-bold text-slate-500 hover:text-white transition-colors">Reply</button>
                        ${replyCount > 0 ? `
                            <button onclick="toggleReplies(${comment.id})" class="text-xs font-bold text-slate-500 hover:text-white transition-colors flex items-center gap-1">
                                <span class="w-4 h-[1px] bg-slate-600"></span> 
                                View ${replyCount} replies
                            </button>
                        ` : ''}
                     </div>
                     
                     <!-- Replies Container -->
                     <div id="replies-${comment.id}" class="hidden pl-8 pt-2 space-y-3"></div>
                 </div>
                 <button onclick="toggleCommentLike(this, ${comment.id})" class="text-slate-500 hover:text-red-500 transition-colors p-1 group/like">
                     <span class="material-symbols-outlined text-[14px] ${comment.is_liked ? 'text-red-500 fill-current' : ''}">favorite</span>
                 </button>
            </div>
        `;
    }).join('');
}

// ... Reply Logic ... (existing)

function renderReplies(commentId, replies) {
     const container = document.getElementById(`replies-${commentId}`);
     if (!container) return;
     
     container.innerHTML = replies.map(reply => {
        const user = reply.user || { name: 'Unknown' };
        const avatar = getProfilePicture(user);
        
        return `
            <div class="flex gap-3 items-start">
                 <img src="${avatar}" class="w-6 h-6 rounded-full border border-white/10 object-cover mt-1">
                 <div class="flex-1 space-y-1">
                     <div class="flex items-baseline gap-2">
                         <span class="text-xs font-bold text-white">${user.name}</span>
                         <span class="text-[10px] text-slate-500">${timeAgo(reply.reply_created_at || reply.created_at)}</span>
                     </div>
                     <p class="text-sm text-slate-300 leading-snug">${reply.reply}</p>
                 </div>
                 <button onclick="toggleReplyLike(this, ${reply.id})" class="text-slate-500 hover:text-red-500 transition-colors p-1 group/like">
                     <span class="material-symbols-outlined text-[12px] ${reply.is_liked ? 'text-red-500 fill-current' : ''}">favorite</span>
                 </button>
            </div>
        `;
     }).join('');
}

// Comment Like Logic
async function toggleCommentLike(btn, id) {
    const icon = btn.querySelector('span');
    const isLiked = icon.classList.contains('text-red-500');
    
    // Optimistic
    if (isLiked) {
        icon.classList.remove('text-red-500', 'fill-current');
        icon.style.fontVariationSettings = "'FILL' 0";
    } else {
        icon.classList.add('text-red-500', 'fill-current');
        icon.style.fontVariationSettings = "'FILL' 1";
    }

    try {
        const token = localStorage.getItem('auth_token');
        await fetch(`${API_BASE_URL}/add_reaction_to_comment`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment_id: id, type: 1 })
        });
    } catch(e) { console.error(e); }
}

async function toggleReplyLike(btn, id) {
    const icon = btn.querySelector('span');
    const isLiked = icon.classList.contains('text-red-500');
    
    // Optimistic
    if (isLiked) {
        icon.classList.remove('text-red-500', 'fill-current');
        icon.style.fontVariationSettings = "'FILL' 0";
    } else {
        icon.classList.add('text-red-500', 'fill-current');
        icon.style.fontVariationSettings = "'FILL' 1";
    }

    try {
        const token = localStorage.getItem('auth_token');
        await fetch(`${API_BASE_URL}/add_reaction_to_comment_reply`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment_reply_id: id, type: 1 })
        });
    } catch(e) { console.error(e); }
}


// Send Comment
const sendBtn = document.getElementById('send-comment-btn');
const commentInput = document.getElementById('comment-input');

if (sendBtn && commentInput) {
    const sendHandler = async () => {
        const text = commentInput.value.trim();
        if (!text || !currentReelIdForComments) return;
        
        const originalIcon = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>';
        
        try {
            const token = localStorage.getItem('auth_token');
            let endpoint = `${API_BASE_URL}/create_comment`;
            let body = { reel_id: currentReelIdForComments, comment: text };
            
            if (replyingTo) {
                endpoint = `${API_BASE_URL}/create_comment_reply`;
                body = { comment_id: replyingTo.id, reply: text };
            }

            const response = await fetch(endpoint, {
                 method: 'POST',
                 headers: {
                     'Authorization': `Bearer ${token}`,
                     'Content-Type': 'application/json'
                 },
                 body: JSON.stringify(body)
            });
            const data = await response.json();
            
            if (data.success) {
                commentInput.value = '';
                if (replyingTo) {
                     // Reload replies for that comment
                     const commentId = replyingTo.id;
                     // Reset UI
                     replyingTo = null;
                     commentInput.placeholder = "Add a comment...";
                     // Refresh replies
                     const repliesContainer = document.getElementById(`replies-${commentId}`);
                     if(repliesContainer) {
                         repliesContainer.classList.remove('hidden');
                         repliesContainer.innerHTML = ''; // Clear to force reload or manually append
                         toggleReplies(commentId); // Will re-fetch
                     }
                } else {
                    fetchComments(currentReelIdForComments); // Reload all
                }
            }
        } catch(e) {
            console.error(e);
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalIcon;
        }
    };
    
    sendBtn.addEventListener('click', sendHandler);
    commentInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendHandler();
    });
}

// Simple timeAgo helper if not existing or can use existing if standardized
function timeAgo(dateString) { 
    // Reuse existing if possible, else minimal
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return Math.floor(hours / 24) + 'd';
}

// --- User Profile & Suggestions Logic ---

const populateUserProfile = () => {
    const user = JSON.parse(localStorage.getItem('user_data') || '{}');
    if (!user || !user.id) return;

    // Update Sidebar Profile
    // Selector targets the container in sidebar (assuming structure matches reels.html)
    const sidebarResult = document.querySelector('aside .flex.items-center.gap-3.rounded-xl.border');

    if (sidebarResult) {
        const img = sidebarResult.querySelector('img');
        const name = sidebarResult.querySelector('p.font-bold');
        const handle = sidebarResult.querySelector('p.text-xs');

        if (img) img.src = user.profile?.avatar ? (typeof user.profile.avatar === 'string' ? `${window.PUBLIC_URL}/${user.profile.avatar}` : `${window.PUBLIC_URL}/${user.profile.avatar.file_path}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;

        // Handle "blocked by orb" or 404
        if (img) {
            img.onerror = () => {
                img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;
            };
        }

        if (name) name.textContent = user.name;
        if (handle) handle.textContent = '@' + user.name.toLowerCase().replace(/\s+/g, '');
    }

    // Update Mobile Nav Profile Link
    // Mobile nav has 3 links: Home, Add, Reels, Profile. Profile is last 'a' tag.
    // Actually structure is: a(Home), div(Add), a(Reels), a(Profile)
    const mobileProfileLink = document.querySelector('nav.lg\\:hidden a[href="#"]:last-child');
    if (mobileProfileLink) mobileProfileLink.href = 'profile.html';
};

const fetchSuggestions = async () => {
    const list = document.getElementById('reels-suggestions-list');
    if (!list) return;

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/fetch_suggestions?limit=5`, {
            method: 'POST', // or GET depending on API (Controller shows POST for fetchSuggestions usually if using body, but here it uses query param? Let's check Controller)
            // Controller: fetchSuggestions(Request $request). Route?
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        // Note: Check if Route is POST or GET. If GET, remove body if any.

        const data = await response.json();
        if (data.success && data.data && data.data.items) {
            list.innerHTML = ''; // Clear loading state

            data.data.items.forEach(user => {
                let avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
                if (user.profile && user.profile.avatar) {
                    if (typeof user.profile.avatar === 'string') {
                        avatar = `${window.PUBLIC_URL}/${user.profile.avatar}`;
                    } else if (user.profile.avatar.file_path) {
                        avatar = `${window.PUBLIC_URL}/${user.profile.avatar.file_path}`;
                    }
                }

                const html = `
                    <div class="flex items-center justify-between gap-3 group">
                        <div class="flex items-center gap-2 cursor-pointer" onclick="window.location.href='profile.html?id=${user.id}'">
                            <div class="h-10 w-10 shrink-0 rounded-full bg-slate-200 bg-cover ring-2 ring-offset-2 ring-transparent group-hover:ring-primary dark:ring-offset-[#1c1f27] transition-all"
                                style="background-image: url('${avatar}');">
                            </div>
                            <div class="flex flex-col min-w-0">
                                <p class="text-sm font-bold text-slate-900 dark:text-white hover:underline truncate">${user.name}</p>
                                <p class="text-xs text-slate-500 dark:text-slate-400 truncate">Suggested for you</p>
                            </div>
                        </div>
                        <button onclick="followUser(${user.id}, this)"
                            class="text-xs font-bold text-primary hover:text-white hover:bg-primary px-3 py-1.5 rounded-lg transition-all shrink-0">Follow</button>
                    </div>
                `;
                list.insertAdjacentHTML('beforeend', html);
            });

            if (data.data.items.length === 0) {
                list.innerHTML = '<div class="text-center text-xs text-slate-500 py-2">No suggestions found.</div>';
            }

        } else {
            // If API fails or no items
            // list.innerHTML = '<div class="text-center text-xs text-slate-500 py-2">No suggestions available</div>';
            // actually stay silent or show empty
            if (data.message) console.log(data.message);
        }
    } catch (e) {
        console.error("Suggestions Error:", e);
    }
};

window.followUser = async (userId, btn) => {
    if (btn.disabled) return;
    const originalText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/follow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ user_id: userId })
        });
        const res = await response.json();

        if (res.success) {
            btn.textContent = 'Sent';
            btn.classList.replace('text-primary', 'text-green-500');
            btn.classList.add('bg-green-500/10');
            btn.onclick = null;
        } else {
            // alert(res.message);
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch (e) {
        console.error(e);
        btn.textContent = originalText;
        btn.disabled = false;
    }
};

// Helper for formatting numbers (e.g. 1.2k)
function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
}
