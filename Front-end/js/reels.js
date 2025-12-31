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
let replyingTo = null;

function setupTabs() {
    const tabForYou = document.getElementById('tab-foryou');
    const tabFollowing = document.getElementById('tab-following');

    if (!tabForYou || !tabFollowing) return;

    tabForYou.addEventListener('click', () => switchTab('foryou'));
    tabFollowing.addEventListener('click', () => switchTab('following'));


}

function switchTab(mode) {
    if (currentMode === mode && mode !== 'saved') return; // Allow re-click on saved? or just return
    if (currentMode === mode) return;

    currentMode = mode;

    const tabForYou = document.getElementById('tab-foryou');
    const tabFollowing = document.getElementById('tab-following');
    const sidebarSaved = document.getElementById('sidebar-saved');

    // Active classes
    const activeClass = "bg-white/10 backdrop-blur-md text-white border-white/10 border";
    const inactiveClass = "bg-transparent text-white/70";

    // Clean classes
    const removeActive = (el) => {
        if (!el) return;
        el.className = el.className.replace(activeClass, "").replace(inactiveClass, "").trim();
        el.classList.add("px-4", "py-1.5", "rounded-full", "text-xs", "font-semibold", "transition-all", "hover:bg-white/10");
    };

    removeActive(tabForYou);
    removeActive(tabFollowing);

    // Apply new state
    if (mode === 'foryou') {
        tabForYou.classList.add(...activeClass.split(" "));
        tabFollowing.classList.add(...inactiveClass.split(" "));
    } else if (mode === 'following') {
        tabFollowing.classList.add(...activeClass.split(" "));
        tabForYou.classList.add(...inactiveClass.split(" "));
    } else if (mode === 'saved') {
        // Deactivate header tabs
        tabForYou.classList.add(...inactiveClass.split(" "));
        tabFollowing.classList.add(...inactiveClass.split(" "));
        // Maybe Style sidebar item? Leaving as is for now implies just "View" change
    }

    fetchReels(mode);
}

async function fetchReels(mode = 'foryou') {
    const container = document.getElementById('reels-container');
    if (!container) return; // Exit if container doesn't exist (e.g. on profile page)

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
        let endpoint;
        if (mode === 'following') {
            endpoint = `${API_BASE_URL}/get_following_reels`;
        } else if (mode === 'saved') {
            endpoint = `${API_BASE_URL}/get_saved_reels`;
        } else {
            endpoint = `${API_BASE_URL}/get_all_reels`;
        }

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

    // Check if path already has 'storage/' prefix
    if (cleanPath.startsWith('storage/')) {
        return `${window.PUBLIC_URL}/${cleanPath}`;
    }

    // Default: Append storage/
    return `${window.PUBLIC_URL}/storage/${cleanPath}`;
};

function createReelElement(reel) {
    const div = document.createElement('div');
    div.className = 'snap-center relative shrink-0 w-full h-[calc(100vh-80px)] md:h-[calc(100vh-40px)] rounded-xl overflow-hidden shadow-2xl bg-black border border-white/5 mb-4 group';

    // Construct URLs using the centralized helper
    const videoUrl = getStorageUrl(reel.video_path);
    const thumbUrl = getStorageUrl(reel.thumbnail_path);

    // Unified Avatar Logic
    const userAvatar = getProfilePicture(reel.user);
    const userName = reel.user ? reel.user.name : 'Unknown User';

    div.innerHTML = `
        <video 
            class="h-full w-full object-cover bg-black"
            src="${videoUrl}" 
            loop 
            playsinline
            onclick="togglePlay(this)"
            onerror="console.error('Video failed to load:', this.src)">
        </video>
        ${thumbUrl ? `<img src="${thumbUrl}" class="absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-500 pointer-events-none" id="thumb-${reel.id}">` : ''}
        
        <div class="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"></div>
        <div class="absolute inset-0 reel-overlay-gradient pointer-events-none"></div>
        
        <!-- Action Buttons -->
        <div class="absolute right-4 bottom-24 flex flex-col items-center gap-5 z-30">
        <!-- Like Button -->
        <button onclick="toggleLike(this, ${reel.id})" class="flex flex-col items-center gap-1 group/btn">
            <div class="p-2.5 rounded-full bg-white/10 backdrop-blur-md group-hover/btn:bg-red-500/20 transition-all border border-white/10 group-active/btn:scale-90">
                <span class="material-symbols-outlined text-white text-[28px] group-hover/btn:text-red-500 transition-colors ${reel.is_liked ? 'text-red-500 fill-current' : ''}" style="${reel.is_liked ? "font-variation-settings: 'FILL' 1;" : ''}">favorite</span>
            </div>
            <span class="text-white font-medium text-xs drop-shadow-md hidden md:block">${formatNumber(reel.likes_count || 0)}</span>
        </button>

        <!-- Save Button -->
        <button onclick="toggleSave(this, ${reel.id})" class="flex flex-col items-center gap-1 group/btn">
            <div class="p-2.5 rounded-full bg-white/10 backdrop-blur-md group-hover/btn:bg-yellow-500/20 transition-all border border-white/10 group-active/btn:scale-90">
                <span class="material-symbols-outlined text-white text-[28px] group-hover/btn:text-yellow-500 transition-colors ${reel.is_saved ? 'text-yellow-500 fill-current' : ''}" style="${reel.is_saved ? "font-variation-settings: 'FILL' 1;" : ''}">bookmark</span>
            </div>
             <span class="text-white font-medium text-xs drop-shadow-md hidden md:block">Save</span>
        </button>

        <!-- Comment Button -->
        <button onclick="openComments(${reel.id})" class="flex flex-col items-center gap-1 group/btn">
                <div class="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 transition-all group-hover/btn:bg-white/20 group-hover/btn:scale-110 active:scale-95">
                    <span class="material-symbols-outlined text-white text-[28px]">chat_bubble</span>
                </div>
                <span class="text-xs font-bold text-white drop-shadow-md hidden md:block">${reel.comments_count || 0}</span>
            </button>
            <button onclick="shareReel(${reel.id})" class="group/btn flex flex-col items-center gap-1">
                <div class="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 transition-all group-hover/btn:bg-white/20 group-hover/btn:scale-110 active:scale-95">
                    <span class="material-symbols-outlined text-white text-[28px]">send</span>
                </div>
                <span class="text-xs font-bold text-white drop-shadow-md hidden md:block">Share</span>
            </button>

            <!-- More Actions (3 Dots) -->
            <div class="relative group/menu">
                <button onclick="toggleReelMenu(event, this)" class="flex flex-col items-center gap-1 group/btn">
                    <div class="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 transition-all group-hover/btn:bg-white/20 group-hover/btn:scale-110 active:scale-95">
                        <span class="material-symbols-outlined text-white text-[28px]">more_horiz</span>
                    </div>
                </button>
                <!-- Dropdown Menu -->
                <div class="absolute right-14 bottom-0 w-48 bg-[#1e2330]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible transition-all duration-300 z-50 overflow-hidden origin-bottom-right transform scale-95 click-dropdown">
                    ${(() => {
                        const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');
                        const isOwner = currentUser.id === reel.user.id;
                        const roles = currentUser.roles ? currentUser.roles.map(r => (typeof r === 'object' ? r.name : r).toLowerCase()) : [];
                        const isAdmin = roles.some(r => ['admin', 'super admin', 'superadmin', 'moderator'].includes(r));
                        
                        let items = '';
                        if (isOwner) {
                            items += `
                            <button onclick="editReel(${reel.id})" class="min-w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-white/10 flex items-center gap-3 transition-colors">
                                <span class="material-symbols-outlined text-[20px]">edit</span> Edit
                            </button>`;
                        }
                        if (isOwner || isAdmin) {
                            items += `
                            <button onclick="deleteReel(${reel.id})" class="min-w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/10 flex items-center gap-3 transition-colors border-t border-white/5">
                                <span class="material-symbols-outlined text-[20px]">delete</span> Delete
                            </button>`;
                        }
                        if (!isOwner) {
                            items += `
                             <button onclick="openReportModal(${reel.id}, 'reel')" class="min-w-full text-left px-4 py-3 text-sm text-yellow-400 hover:bg-white/10 flex items-center gap-3 transition-colors">
                                <span class="material-symbols-outlined text-[20px]">flag</span> Report
                            </button>`;
                        }
                        return items;
                    })()}
                </div>
            </div>
        </div>
        
        <!-- Mute Toggle (Top Right) -->
        <div class="absolute top-4 right-4 z-30">
             <button onclick="toggleMute(this, ${reel.id})" class="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/60 transition-colors">
                <span class="material-symbols-outlined text-white text-[18px]">volume_up</span>
             </button>
        </div>

        <!-- User Info & Caption -->
        <div class="absolute bottom-0 left-0 w-full p-6 z-20 flex flex-col gap-3">
            <div class="flex items-center gap-3">
                <div onclick="window.location.href='profile.html?id=${reel.user.id}'" class="h-10 w-10 rounded-full border-2 border-white p-0.5 cursor-pointer hover:scale-105 transition-transform">
                    <img alt="Avatar" class="h-full w-full rounded-full object-cover" src="${userAvatar}" />
                </div>
                <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                        <span onclick="window.location.href='profile.html?id=${reel.user.id}'" class="text-sm font-bold text-white drop-shadow-md cursor-pointer hover:underline">${userName}</span>
                        ${(() => {
            const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');
            if (currentUser.id === reel.user.id) return '';

            const status = reel.user.follow_status || 'none';
            if (status === 'accepted') {
                return `<button onclick="toggleFollowReel(${reel.user.id}, this)" class="text-[10px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10 backdrop-blur-sm hover:bg-red-500/20 hover:text-red-400 transition-colors">Following</button>`;
            } else if (status === 'pending') {
                return `<button onclick="toggleFollowReel(${reel.user.id}, this)" class="text-[10px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10 backdrop-blur-sm">Requested</button>`;
            } else {
                return `<button onclick="toggleFollowReel(${reel.user.id}, this)" class="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md border border-blue-400/20 backdrop-blur-sm hover:bg-blue-400/20 transition-colors">Follow</button>`;
            }
        })()}
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
            // View Count Trigger (> 2s)
            if (video.currentTime > 2 && !video.processedView) {
                video.processedView = true; // Local flag on element
                incrementReelView(reel.id);
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

// Toggle Like
const toggleLike = async (btn, reelId) => {
    // Optimistic UI Update
    const icon = btn.querySelector('.material-symbols-outlined');
    const countSpan = btn.querySelector('span.text-xs');
    const isLiked = icon.classList.contains('text-red-500');
    let currentCount = parseInt(countSpan.textContent.replace(/,/g, '')) || 0;

    // Toggle State
    if (isLiked) {
        icon.classList.remove('text-red-500', 'fill-current');
        icon.style.fontVariationSettings = "'FILL' 0";
        currentCount = Math.max(0, currentCount - 1);
    } else {
        icon.classList.add('text-red-500', 'fill-current');
        icon.style.fontVariationSettings = "'FILL' 1";
        currentCount++;
    }

    // Update Count Display
    countSpan.textContent = formatNumber(currentCount);

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
            // Revert on failure
            if (isLiked) {
                icon.classList.add('text-red-500', 'fill-current');
                icon.style.fontVariationSettings = "'FILL' 1";
                currentCount++;
            } else {
                icon.classList.remove('text-red-500', 'fill-current');
                icon.style.fontVariationSettings = "'FILL' 0";
                currentCount--;
            }
            countSpan.textContent = formatNumber(currentCount);
            console.error('Like failed:', data.message);
        }
    } catch (error) {
        console.error('Error liking reel:', error);
        // Revert?
    }
};


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
    if (event) event.stopPropagation();
};



// Toggle Follow User from Reel
const toggleFollowReel = async (userId, btn) => {
    // Avoid multiple clicks
    if (btn.disabled) return;
    btn.disabled = true;

    const currentText = btn.innerText.trim();
    const isFollowing = currentText === 'Following' || currentText === 'Requested';

    // Optimistic Update
    if (isFollowing) {
        // Switch to Follow
        btn.innerText = 'Follow';
        btn.className = "text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md border border-blue-400/20 backdrop-blur-sm hover:bg-blue-400/20 transition-colors";
    } else {
        // Switch to Following
        btn.innerText = 'Following';
        btn.className = "text-[10px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10 backdrop-blur-sm hover:bg-red-500/20 hover:text-red-400 transition-colors";
    }

    try {
        const token = localStorage.getItem('auth_token');
        const endpoint = isFollowing ? `${API_BASE_URL}/unfollow` : `${API_BASE_URL}/follow`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId })
        });
        const data = await response.json();

        if (!data.success) {
            // Revert on failure
            if (isFollowing) {
                btn.innerText = currentText; // Restore 'Following' or 'Requested'
                btn.className = "text-[10px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10 backdrop-blur-sm hover:bg-red-500/20 hover:text-red-400 transition-colors";
            } else {
                btn.innerText = 'Follow';
                btn.className = "text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md border border-blue-400/20 backdrop-blur-sm hover:bg-blue-400/20 transition-colors";
            }
            console.error('Follow toggle failed:', data.message);
        } else {
            // If success, update strict status if needed (e.g. if it was requested)
            if (!isFollowing && data.status === 'pending') {
                btn.innerText = 'Requested';
            }
        }
    } catch (e) {
        console.error(e);
        // Revert?
    } finally {
        btn.disabled = false;
    }
};

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
        if (data.success) {
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
    
    // Helper to get current user ID usually stored in global or localStorage
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const currentUserId = userData.id;

    list.innerHTML = comments.map(comment => {
        const user = comment.user || { name: 'Unknown' };
        const avatar = getProfilePicture(user);
        const replyCount = comment.replies_count || 0;
        const isOwner = currentUserId === user.id;

        // Pre-render Replies
        let repliesHTML = '';
        if(comment.replies && comment.replies.length > 0) {
            repliesHTML = comment.replies.map(reply => {
                const rUser = reply.creator || reply.user || { name: 'Unknown' };
                const rAvatar = getProfilePicture(rUser);
                const rIsOwner = currentUserId === rUser.id;
                
                return `
                    <div class="flex gap-3 items-start group/reply relative" id="comment-row-r-${reply.id}">
                         <img src="${rAvatar}" class="w-6 h-6 rounded-full border border-white/10 object-cover mt-1 shrink-0">
                         <div class="flex-1 space-y-1 min-w-0">
                             <div class="flex justify-between items-start">
                                 <div class="flex items-baseline gap-2">
                                     <span class="text-xs font-bold text-white truncate">${rUser.name}</span>
                                     <span class="text-[10px] text-slate-500 whitespace-nowrap">${timeAgo(reply.created_at)}</span>
                                 </div>
                                 
                                 ${rIsOwner ? `
                                 <div class="relative group">
                                     <button onclick="toggleCommentMenu(event, this)" class="text-slate-500 hover:text-white p-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                                         <span class="material-symbols-outlined text-[14px]">more_horiz</span>
                                     </button>
                                     <div class="comment-menu absolute right-0 top-5 w-24 bg-[#1e2330] border border-white/10 rounded-lg shadow-xl py-1 z-20 opacity-0 scale-95 pointer-events-none transition-all duration-200 origin-top-right">
                                         <button onclick="editReelComment(${reply.id}, 'reply')" class="w-full text-left px-3 py-1.5 text-[10px] text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-1.5">
                                             <span class="material-symbols-outlined text-[12px]">edit</span> Edit
                                         </button>
                                         <button onclick="deleteReelComment(${reply.id}, this, 'reply')" class="w-full text-left px-3 py-1.5 text-[10px] text-red-400 hover:bg-white/10 flex items-center gap-1.5">
                                             <span class="material-symbols-outlined text-[12px]">delete</span> Delete
                                         </button>
                                     </div>
                                 </div>
                                 ` : ''}
                     </div>
                                 ${(() => {
                                     if(reply.attachments && reply.attachments.length > 0) {
                                         return reply.attachments.map(att => {
                                             const url = `${window.PUBLIC_URL}/storage/comment_replies/${att.file_path}`;
                                             if(['jpg','jpeg','png','gif'].includes(att.file_type?.toLowerCase())) {
                                                return `<img onclick="openMediaModal('${url}', 'image')" src="${url}" class="mt-2 h-20 w-auto rounded-lg border border-white/10 object-cover cursor-pointer hover:opacity-90">`;
                                             } else if (['mp4','mov','avi'].includes(att.file_type?.toLowerCase())) {
                                                 return `<div onclick="openMediaModal('${url}', 'video')" class="mt-2 h-20 w-32 bg-black rounded-lg border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 relative group/vid">
                                                            <span class="material-symbols-outlined text-white/50 group-hover/vid:text-white text-3xl">play_circle</span>
                                                         </div>`;
                                             }
                                             return '';
                                         }).join('');
                                     } 
                                     return '';
                                 })()}
                                 <p class="text-sm text-slate-300 leading-snug comment-text break-words">${reply.reply}</p>
                                 
                                 <!-- Reply Action on Reply -->
                             <div class="flex items-center gap-4 mt-0.5">
                                <button onclick="initiateReply(${comment.id}, '${rUser.name.replace(/'/g, "\\\'")}')" class="text-[10px] font-bold text-slate-500 hover:text-white transition-colors">Reply</button>
                             </div>
                         </div>
                         <button onclick="toggleReplyLike(this, ${reply.id})" class="text-slate-500 hover:text-red-500 transition-colors p-1 group/like shrink-0">
                             <span class="material-symbols-outlined text-[12px] ${reply.is_liked ? 'text-red-500 fill-current' : ''}">favorite</span>
                         </button>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="flex gap-3 items-start group/comment" id="comment-row-c-${comment.id}">
                 <img src="${avatar}" class="w-8 h-8 rounded-full border border-white/10 object-cover mt-1 shrink-0">
                 <div class="flex-1 space-y-1 min-w-0">
                     <div class="flex justify-between items-start">
                         <div class="flex items-baseline gap-2">
                             <span class="text-sm font-bold text-white truncate">${user.name}</span>
                             <span class="text-xs text-slate-500 whitespace-nowrap">${timeAgo(comment.created_at)}</span>
                         </div>
                         
                         ${isOwner ? `
                         <div class="relative group">
                            <button onclick="toggleCommentMenu(event, this)" class="text-slate-500 hover:text-white p-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                <span class="material-symbols-outlined text-[16px]">more_horiz</span>
                            </button>
                            <!-- Dropdown -->
                            <div class="comment-menu absolute right-0 top-6 w-32 bg-[#1e2330] border border-white/10 rounded-lg shadow-xl py-1 z-20 opacity-0 scale-95 pointer-events-none transition-all duration-200 origin-top-right">
                                <button onclick="editReelComment(${comment.id}, 'comment')" class="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                                    <span class="material-symbols-outlined text-[14px]">edit</span> Edit
                                </button>
                                <button onclick="deleteReelComment(${comment.id}, this, 'comment')" class="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/10 flex items-center gap-2">
                                    <span class="material-symbols-outlined text-[14px]">delete</span> Delete
                                </button>
                            </div>
                         </div>
                         ` : ''}
                     </div>
                     
                     ${(() => {
                         if(comment.attachments && comment.attachments.length > 0) {
                             return `<div class="mt-2 flex flex-wrap gap-2">
                                 ${comment.attachments.map(att => {
                                     let path = att.file_path;
                                     if (!path.startsWith('http')) {
                                         const baseUrl = window.PUBLIC_URL || '';
                                         if (path.startsWith('storage/')) {
                                             path = `${baseUrl}/${path}`;
                                         } else {
                                             path = `${baseUrl}/storage/comments/${path}`;
                                         }
                                     }

                                     if(['image', 'jpg', 'jpeg', 'png', 'gif'].includes(att.file_type?.toLowerCase()) || /\.(jpg|jpeg|png|gif)$/i.test(path)) {
                                        return `<img onclick="openMediaModal('${path}', 'image')" src="${path}" class="h-24 w-auto rounded-lg border border-white/10 object-cover cursor-pointer hover:opacity-90">`;
                                     } else if (['video', 'mp4', 'mov', 'avi'].includes(att.file_type?.toLowerCase()) || /\.(mp4|mov|avi)$/i.test(path)) {
                                         return `<div onclick="openMediaModal('${path}', 'video')" class="h-24 w-40 bg-black rounded-lg border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 relative group/vid">
                                                    <span class="material-symbols-outlined text-white/50 group-hover/vid:text-white text-3xl">play_circle</span>
                                                 </div>`;
                                     }
                                     return '';
                                 }).join('')}
                             </div>`;
                         } 
                         return '';
                     })()}

                     <p class="text-sm text-slate-300 leading-snug comment-text break-words">${comment.comment}</p>
                     
                     <div class="flex items-center gap-4 mt-1">
                        <button onclick="initiateReply(${comment.id}, '${user.name.replace(/'/g, "\\\'")}')" class="text-xs font-bold text-slate-500 hover:text-white transition-colors">Reply</button>
                        ${replyCount > 0 ? `
                            <button onclick="toggleReplies(${comment.id})" class="text-xs font-bold text-slate-500 hover:text-white transition-colors flex items-center gap-1">
                                <span class="w-4 h-[1px] bg-slate-600"></span> 
                                View ${replyCount} replies
                            </button>
                        ` : ''}
                     </div>
                     
                     <!-- Replies Container -->
                     <div id="replies-${comment.id}" class="hidden pl-8 pt-2 space-y-3">
                        ${repliesHTML}
                     </div>
                 </div>
                 <button onclick="toggleCommentLike(this, ${comment.id})" class="text-slate-500 hover:text-red-500 transition-colors p-1 group/like shrink-0">
                     <span class="material-symbols-outlined text-[14px] ${comment.is_liked ? 'text-red-500 fill-current' : ''}">favorite</span>
                 </button>
            </div>
        `;
    }).join('');
}

function initiateReply(commentId, username) {
    replyingTo = { id: commentId }; // Store Global
    const input = document.getElementById('comment-input');
    if (input) {
        input.value = '';
        input.placeholder = `Replying to ${username}...`;
        input.focus();
        // Show indicator if avail
        const indicator = document.getElementById('reply-indicator');
        if(indicator) {
            indicator.classList.remove('hidden');
            document.getElementById('replying-to-text').textContent = `Replying to ${username}`;
        }
    }
}

async function toggleReplies(commentId) {
    const container = document.getElementById(`replies-${commentId}`);
    if (!container) return;

    // Just toggle if content exists (and not just loading text)
    if (container.children.length > 0 && !container.textContent.includes('Loading')) {
        container.classList.toggle('hidden');
        return;
    }

    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        container.innerHTML = '<div class="text-xs text-slate-500 pl-4">Loading replies...</div>';
        
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_BASE_URL}/get_comment_replies`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment_id: commentId })
            });
            const data = await response.json();
             if (data.success) {
                const replies = data.data.data ? data.data.data : data.data; // Handle pagination structure
                // We need a renderReplies function or just map it here.
                // Re-using the map logic from renderComments is best but dry.
                // For now, let's just use empty if empty.
                 if (replies.length > 0) {
                     // Since we don't have a standalone renderReplies function exposed nicely (it's inside renderComments map),
                     // we should ideally refactor. But for this fix, I'll allow the fetch fallback to render.
                     // IMPORTANT: The Optimistic approach relies on PRE-RENDERING in renderComments.
                     // This fetch block is a fallback for when 'replies' weren't eager loaded.
                     // If we are here, it means we don't have them yet.
                     container.innerHTML = replies.map(reply => {
                        const rUser = reply.creator || reply.user || { name: 'Unknown' };
                        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
                        const rIsOwner = userData.id === rUser.id;
                        const rAvatar = getProfilePicture(rUser);
                         return `
                            <div class="flex gap-3 items-start group/reply relative" id="comment-row-${reply.id}">
                                <img src="${rAvatar}" class="w-6 h-6 rounded-full border border-white/10 object-cover mt-1 shrink-0">
                                <div class="flex-1 space-y-1 min-w-0">
                                    <div class="flex justify-between items-start">
                                        <div class="flex items-baseline gap-2">
                                            <span class="text-xs font-bold text-white truncate">${rUser.name}</span>
                                            <span class="text-[10px] text-slate-500 whitespace-nowrap">${timeAgo(reply.created_at)}</span>
                                        </div>
                                        ${rIsOwner ? `
                                        <div class="relative group">
                                            <button onclick="toggleCommentMenu(event, this)" class="text-slate-500 hover:text-white p-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                                                <span class="material-symbols-outlined text-[14px]">more_horiz</span>
                                            </button>
                                            <div class="comment-menu absolute right-0 top-5 w-24 bg-[#1e2330] border border-white/10 rounded-lg shadow-xl py-1 z-20 opacity-0 scale-95 pointer-events-none transition-all duration-200 origin-top-right">
                                                <button onclick="editReelComment(${reply.id})" class="w-full text-left px-3 py-1.5 text-[10px] text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-1.5">
                                                    <span class="material-symbols-outlined text-[12px]">edit</span> Edit
                                                </button>
                                                <button onclick="deleteReelComment(${reply.id}, this)" class="w-full text-left px-3 py-1.5 text-[10px] text-red-400 hover:bg-white/10 flex items-center gap-1.5">
                                                    <span class="material-symbols-outlined text-[12px]">delete</span> Delete
                                                </button>
                                            </div>
                                        </div>
                                        ` : ''}
                                    </div>
                                    ${(() => {
                                         if(reply.attachments && reply.attachments.length > 0) {
                                             return `<div class="mt-2 flex flex-wrap gap-2">
                                                 ${reply.attachments.map(att => {
                                                     let path = att.file_path;
                                                     if (!path.startsWith('http')) {
                                                         const baseUrl = window.PUBLIC_URL || '';
                                                         if (path.startsWith('storage/')) {
                                                             path = `${baseUrl}/${path}`;
                                                         } else {
                                                             path = `${baseUrl}/storage/comment_replies/${path}`;
                                                         }
                                                     }
                                                     
                                                     if(['image', 'jpg', 'jpeg', 'png', 'gif'].includes(att.file_type?.toLowerCase()) || /\.(jpg|jpeg|png|gif)$/i.test(path)) {
                                                        return `<img onclick="openMediaModal('${path}', 'image')" src="${path}" class="h-20 w-auto rounded-lg border border-white/10 object-cover cursor-pointer hover:opacity-90">`;
                                                     } else if (['video', 'mp4', 'mov', 'avi'].includes(att.file_type?.toLowerCase()) || /\.(mp4|mov|avi)$/i.test(path)) {
                                                         return `<div onclick="openMediaModal('${path}', 'video')" class="h-20 w-32 bg-black rounded-lg border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 relative group/vid">
                                                                    <span class="material-symbols-outlined text-white/50 group-hover/vid:text-white text-3xl">play_circle</span>
                                                                 </div>`;
                                                     }
                                                     return '';
                                                 }).join('')}
                                             </div>`;
                                         } 
                                         return '';
                                     })()}
                                    <p class="text-sm text-slate-300 leading-snug comment-text break-words">${reply.reply}</p>
                                </div>
                                <button onclick="toggleReplyLike(this, ${reply.id})" class="text-slate-500 hover:text-red-500 transition-colors p-1 group/like shrink-0">
                                    <span class="material-symbols-outlined text-[12px] ${reply.is_liked ? 'text-red-500 fill-current' : ''}">favorite</span>
                                </button>
                            </div>`;
                     }).join('');
                 } else {
                     container.innerHTML = '<div class="text-xs text-slate-500 pl-4">No replies yet.</div>';
                 }
             }
        } catch(e) { console.error(e); container.innerHTML = '<div class="text-xs text-red-500 pl-4">Error loading.</div>'; }
    } else {
        container.classList.add('hidden');
    }
}

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
                     ${(() => {
                          if(reply.attachments && reply.attachments.length > 0) {
                              return `<div class="mt-2 flex flex-wrap gap-2">
                                  ${reply.attachments.map(att => {
                                      let path = att.file_path;
                                      if (!path.startsWith('http')) {
                                          const baseUrl = window.PUBLIC_URL || '';
                                          if (path.startsWith('storage/')) {
                                              path = `${baseUrl}/${path}`;
                                          } else {
                                              path = `${baseUrl}/storage/comment_replies/${path}`;
                                          }
                                      }

                                      if(['image', 'jpg', 'jpeg', 'png', 'gif'].includes(att.file_type?.toLowerCase()) || /\.(jpg|jpeg|png|gif)$/i.test(path)) {
                                         return `<img onclick="openMediaModal('${path}', 'image')" src="${path}" class="h-20 w-auto rounded-lg border border-white/10 object-cover cursor-pointer hover:opacity-90">`;
                                      } else if (['video', 'mp4', 'mov', 'avi'].includes(att.file_type?.toLowerCase()) || /\.(mp4|mov|avi)$/i.test(path)) {
                                          return `<div onclick="openMediaModal('${path}', 'video')" class="h-20 w-32 bg-black rounded-lg border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 relative group/vid">
                                                     <span class="material-symbols-outlined text-white/50 group-hover/vid:text-white text-3xl">play_circle</span>
                                                  </div>`;
                                      }
                                      return '';
                                  }).join('')}
                              </div>`;
                          } 
                          return '';
                      })()}
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
    } catch (e) { console.error(e); }
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
    } catch (e) { console.error(e); }
}


// Send Comment

    /* const sendHandler = async () => {
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
                const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');
                const displayAvatar = currentUser.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'User')}&background=random`;
                // The backend should return the created object in data.data
                const newId = data.data ? data.data.id : Date.now(); 

                if (replyingTo) {
                    // Optimistic Reply
                    const commentId = replyingTo.id;
                    const repliesContainer = document.getElementById(`replies-${commentId}`);
                    if (repliesContainer) {
                        repliesContainer.classList.remove('hidden');
                        const newReplyHTML = `
                            <div class="flex gap-3 items-start group/reply relative" id="comment-row-r-${newId}">
                                 <img src="${displayAvatar}" class="w-6 h-6 rounded-full border border-white/10 object-cover mt-1 shrink-0">
                                 <div class="flex-1 space-y-1 min-w-0">
                                     <div class="flex justify-between items-start">
                                         <div class="flex items-baseline gap-2">
                                             <span class="text-xs font-bold text-white truncate">${currentUser.name || 'You'}</span>
                                             <span class="text-[10px] text-slate-500 whitespace-nowrap">Just now</span>
                                         </div>
                                         <div class="relative group">
                                             <button onclick="toggleCommentMenu(event, this)" class="text-slate-500 hover:text-white p-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                                                 <span class="material-symbols-outlined text-[14px]">more_horiz</span>
                                             </button>
                                             <div class="comment-menu absolute right-0 top-5 w-24 bg-[#1e2330] border border-white/10 rounded-lg shadow-xl py-1 z-20 opacity-0 scale-95 pointer-events-none transition-all duration-200 origin-top-right">
                                                 <button onclick="editReelComment(${newId}, 'reply')" class="w-full text-left px-3 py-1.5 text-[10px] text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-1.5">
                                                     <span class="material-symbols-outlined text-[12px]">edit</span> Edit
                                                 </button>
                                                 <button onclick="deleteReelComment(${newId}, this, 'reply')" class="w-full text-left px-3 py-1.5 text-[10px] text-red-400 hover:bg-white/10 flex items-center gap-1.5">
                                                     <span class="material-symbols-outlined text-[12px]">delete</span> Delete
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                     <p class="text-sm text-slate-300 leading-snug comment-text break-words">${text}</p>
                                     
                                     <!-- Reply Action on Reply (Optimistic) -->
                                     <div class="flex items-center gap-4 mt-0.5">
                                        <button onclick="initiateReply(${commentId}, '${(currentUser.name || 'You').replace(/'/g, "\\'")}')" class="text-[10px] font-bold text-slate-500 hover:text-white transition-colors">Reply</button>
                                     </div>
                                 </div>
                                 <button class="text-slate-500 hover:text-red-500 transition-colors p-1 group/like shrink-0">
                                     <span class="material-symbols-outlined text-[12px]">favorite</span>
                                 </button>
                            </div>
                         `;
                        repliesContainer.insertAdjacentHTML('beforeend', newReplyHTML);
                    }

                    // Reset UI
                   replyingTo = null;
                   document.getElementById('reply-indicator').classList.add('hidden');
                   commentInput.placeholder = "Add a comment...";
                } else {
                    // Optimistic Comment
                    const list = document.getElementById('comments-list');
                    if (list) {
                        // Check if "No comments yet" exists
                        if(list.innerText.includes('No comments yet')) list.innerHTML = '';

                        const newCommentHTML = `
                            <div class="flex gap-3 items-start group/comment" id="comment-row-c-${newId}">
                                 <img src="${displayAvatar}" class="w-8 h-8 rounded-full border border-white/10 object-cover mt-1 shrink-0">
                                 <div class="flex-1 space-y-1 min-w-0">
                                     <div class="flex justify-between items-start">
                                         <div class="flex items-baseline gap-2">
                                             <span class="text-sm font-bold text-white truncate">${currentUser.name || 'You'}</span>
                                             <span class="text-xs text-slate-500 whitespace-nowrap">Just now</span>
                                         </div>
                                         <div class="relative group">
                                            <button onclick="toggleCommentMenu(event, this)" class="text-slate-500 hover:text-white p-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                                <span class="material-symbols-outlined text-[16px]">more_horiz</span>
                                            </button>
                                            <div class="comment-menu absolute right-0 top-6 w-32 bg-[#1e2330] border border-white/10 rounded-lg shadow-xl py-1 z-20 opacity-0 scale-95 pointer-events-none transition-all duration-200 origin-top-right">
                                                <button onclick="editReelComment(${newId}, 'comment')" class="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                                                    <span class="material-symbols-outlined text-[14px]">edit</span> Edit
                                                </button>
                                                <button onclick="deleteReelComment(${newId}, this, 'comment')" class="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/10 flex items-center gap-2">
                                                    <span class="material-symbols-outlined text-[14px]">delete</span> Delete
                                                </button>
                                            </div>
                                         </div>
                                     </div>
                                     
                                     <p class="text-sm text-slate-300 leading-snug comment-text break-words">${text}</p>
                                     
                                     <div class="flex items-center gap-4 mt-1">
                                        <button onclick="initiateReply(${newId}, '${(currentUser.name || 'You').replace(/'/g, "\\'")}')" class="text-xs font-bold text-slate-500 hover:text-white transition-colors">Reply</button>
                                     </div>
                                     <div id="replies-${newId}" class="hidden pl-8 pt-2 space-y-3"></div>
                                 </div>
                                 <button class="text-slate-500 hover:text-red-500 transition-colors p-1 group/like shrink-0">
                                     <span class="material-symbols-outlined text-[14px]">favorite</span>
                                 </button>
                            </div>
                        `;
                        list.insertAdjacentHTML('afterbegin', newCommentHTML);

                        // Scroll to top
                        list.scrollTop = 0;
                    }

                    // Update Reel Comment Count
                    const commentBtn = document.querySelector(`button[onclick="openComments('${currentReelIdForComments}')"] span:last-child, button[onclick="openComments(${currentReelIdForComments})"] span:last-child`);
                    if (commentBtn) {
                        let c = parseInt(commentBtn.textContent.replace(/,/g, '')) || 0;
                        commentBtn.textContent = formatNumber(c + 1);
                    }
                }
                commentInput.value = '';
            }
        } catch (e) {
            console.error(e);
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalIcon;
        }
    };


    sendBtn.addEventListener('click', sendHandler);
    commentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendHandler();
    });

    // Cancel Reply Logic
    const cancelReplyBtn = document.getElementById('cancel-reply-btn');
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', () => {
             replyingTo = null;
             document.getElementById('reply-indicator').classList.add('hidden');
             commentInput.placeholder = "Add a comment...";
        });
    }
} */

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

// Dedicated Follow function for Reel Overlay
window.followUserReel = async (userId, btn) => {
    if (!userId) return;

    // Determine action based on current state (detected by UI content)
    const isFollowing = btn.innerText.includes('Following') || btn.innerText.includes('Requested');
    const originalHTML = btn.outerHTML;

    if (isFollowing) {
        // Toggle to Unfollow (revert to Follow button)
        btn.outerHTML = `<button onclick="followUserReel(${userId}, this)" class="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded-md border border-blue-400/20 backdrop-blur-sm hover:bg-blue-400/20 transition-colors" id="temp-follow-${userId}">Follow</button>`;

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_BASE_URL}/unfollow`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId })
            });
            const data = await response.json();
            if (!data.success) {
                const newBtn = document.getElementById(`temp-follow-${userId}`);
                if (newBtn) newBtn.outerHTML = originalHTML; // Revert
                console.error('Unfollow failed:', data.message);
            }
        } catch (e) {
            console.error(e);
            const newBtn = document.getElementById(`temp-follow-${userId}`);
            if (newBtn) newBtn.outerHTML = originalHTML;
        }

    } else {
        // Toggle to Follow
        btn.outerHTML = `<span class="text-[10px] font-bold text-slate-300 bg-white/10 px-1.5 py-0.5 rounded-md border border-white/10 backdrop-blur-sm" id="temp-following-${userId}">Following</span>`;

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_BASE_URL}/follow`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId })
            });
            const data = await response.json();

            if (!data.success) {
                const span = document.getElementById(`temp-following-${userId}`);
                if (span) span.outerHTML = originalHTML;
                console.error('Follow failed:', data.message);
            } else {
                const status = data.data && data.data.status ? data.data.status : 'accepted';
                const span = document.getElementById(`temp-following-${userId}`);
                if (span && status === 'pending') {
                    span.innerText = 'Requested';
                }
            }
        } catch (e) {
            console.error(e);
            const span = document.getElementById(`temp-following-${userId}`);
            if (span) span.outerHTML = originalHTML;
        }
    }
};

// --- Comment Submission Logic ---

const sendCommentBtn = document.getElementById('send-comment-btn');
const commentInput = document.getElementById('comment-input');
const cancelReplyBtn = document.getElementById('cancel-reply-btn');

if (sendCommentBtn && commentInput) {
    sendCommentBtn.addEventListener('click', async () => {
        const text = commentInput.value.trim();
        const fileInput = document.getElementById('reel-comment-file');
        const hasFile = fileInput && fileInput.files.length > 0;

        if (!text && !hasFile) return;

        // Visual Feedback
        sendCommentBtn.disabled = true;
        const originalIcon = sendCommentBtn.innerHTML;
        sendCommentBtn.innerHTML = '<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>';

        try {
            const token = localStorage.getItem('auth_token');
            const formData = new FormData();
            
            // Check if Replying
            if (replyingTo) {
                // Reply
                formData.append('comment_id', replyingTo.id);
                // Schema requires 'reply' text. Send space if empty but file exists.
                const contentToSend = text || (hasFile ? ' ' : '');
                formData.append('reply', contentToSend);
                if (hasFile) formData.append('attachments[]', fileInput.files[0]);

                const response = await fetch(`${API_BASE_URL}/create_comment_reply`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await response.json();

                if (data.success) {
                    showToast('Reply sent', 'success');
                    
                    // Optimistic Reply
                    const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');
                    const displayAvatar = getProfilePicture(currentUser);
                    const newId = data.data ? data.data.id : Date.now();
                    const commentId = replyingTo.id;
                    const repliesContainer = document.getElementById(`replies-${commentId}`);
                    
                    if (repliesContainer) {
                        repliesContainer.classList.remove('hidden');
                        if (repliesContainer.innerHTML.includes('No replies yet')) repliesContainer.innerHTML = '';
                        
                        const newReplyHTML = `
                            <div class="flex gap-3 items-start group/reply relative" id="comment-row-r-${newId}">
                                 <img src="${displayAvatar}" class="w-6 h-6 rounded-full border border-white/10 object-cover mt-1 shrink-0">
                                 <div class="flex-1 space-y-1 min-w-0">
                                     <div class="flex justify-between items-start">
                                         <div class="flex items-baseline gap-2">
                                             <span class="text-xs font-bold text-white truncate">${currentUser.name || 'You'}</span>
                                             <span class="text-[10px] text-slate-500 whitespace-nowrap">Just now</span>
                                         </div>
                                         <div class="relative group">
                                             <button onclick="toggleCommentMenu(event, this)" class="text-slate-500 hover:text-white p-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                                                 <span class="material-symbols-outlined text-[14px]">more_horiz</span>
                                             </button>
                                             <div class="comment-menu absolute right-0 top-5 w-24 bg-[#1e2330] border border-white/10 rounded-lg shadow-xl py-1 z-20 opacity-0 scale-95 pointer-events-none transition-all duration-200 origin-top-right">
                                                 <button onclick="editReelComment(${newId}, 'reply')" class="w-full text-left px-3 py-1.5 text-[10px] text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-1.5">
                                                     <span class="material-symbols-outlined text-[12px]">edit</span> Edit
                                                 </button>
                                                 <button onclick="deleteReelComment(${newId}, this, 'reply')" class="w-full text-left px-3 py-1.5 text-[10px] text-red-400 hover:bg-white/10 flex items-center gap-1.5">
                                                     <span class="material-symbols-outlined text-[12px]">delete</span> Delete
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                     
                                     ${(() => {
                                         // 1. Try server data
                                         if(data.data && data.data.attachments && data.data.attachments.length > 0) {
                                              return data.data.attachments.map(att => {
                                                 const url = `${window.PUBLIC_URL}/storage/comment_replies/${att.file_path}`;
                                                 if(['jpg','jpeg','png','gif'].includes(att.file_type?.toLowerCase())) {
                                                    return `<img onclick="openMediaModal('${url}', 'image')" src="${url}" class="mt-2 h-20 w-auto rounded-lg border border-white/10 object-cover cursor-pointer hover:opacity-90">`;
                                                 } else if (['mp4','mov','avi'].includes(att.file_type?.toLowerCase())) {
                                                     return `<div onclick="openMediaModal('${url}', 'video')" class="mt-2 h-20 w-32 bg-black rounded-lg border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 relative group/vid">
                                                                <span class="material-symbols-outlined text-white/50 group-hover/vid:text-white text-3xl">play_circle</span>
                                                             </div>`;
                                                 }
                                                 return '';
                                              }).join('');
                                         }
                                         // 2. Fallback to local file (Optimistic)
                                         else if (hasFile && fileInput.files[0]) {
                                             const file = fileInput.files[0];
                                             const url = URL.createObjectURL(file);
                                             if(file.type.startsWith('image/')) {
                                                 return `<img onclick="openMediaModal('${url}', 'image')" src="${url}" class="mt-2 h-20 w-auto rounded-lg border border-white/10 object-cover cursor-pointer hover:opacity-90">`;
                                             } else if (file.type.startsWith('video/')) {
                                                  return `<div onclick="openMediaModal('${url}', 'video')" class="mt-2 h-20 w-32 bg-black rounded-lg border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 relative group/vid">
                                                             <span class="material-symbols-outlined text-white/50 group-hover/vid:text-white text-3xl">play_circle</span>
                                                          </div>`;
                                             }
                                         }
                                         return '';
                                     })()}

                                     <p class="text-sm text-slate-300 leading-snug comment-text break-words">${text}</p>
                                     
                                     <!-- Reply Action on Reply (Optimistic) -->
                                     <div class="flex items-center gap-4 mt-0.5">
                                        <button onclick="initiateReply(${commentId}, '${(currentUser.name || 'You').replace(/'/g, "\\'")}')" class="text-[10px] font-bold text-slate-500 hover:text-white transition-colors">Reply</button>
                                     </div>
                                 </div>
                                 <button class="text-slate-500 hover:text-red-500 transition-colors p-1 group/like shrink-0">
                                     <span class="material-symbols-outlined text-[12px]">favorite</span>
                                 </button>
                            </div>
                         `;
                        repliesContainer.insertAdjacentHTML('beforeend', newReplyHTML);
                    }

                    // Reset
                    commentInput.value = '';
                    clearReelCommentFile();
                    cancelReplyMode();
                } else {
                    showToast(data.message || 'Failed to reply', 'error');
                }
            } else {
                // Top-level Comment
                if (!currentReelIdForComments) return;
                formData.append('reel_id', currentReelIdForComments);
                // Schema requires 'comment' text. Send space if empty but file exists.
                const contentToSend = text || (hasFile ? ' ' : '');
                formData.append('comment', contentToSend);
                if (hasFile) formData.append('attachments[]', fileInput.files[0]);

                const response = await fetch(`${API_BASE_URL}/create_comment`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await response.json();

                if (data.success) {
                    showToast('Comment posted', 'success');
                    // Increment Count UI
                    const commentBtn = document.querySelector(`button[onclick="openComments('${currentReelIdForComments}')"] span:last-child, button[onclick="openComments(${currentReelIdForComments})"] span:last-child`);

                    if(commentBtn) {
                        let c = parseInt(commentBtn.textContent.replace(/,/g, '')) || 0;
                        commentBtn.textContent = formatNumber(c + 1);
                    }
                    
                    // Optimistic UI Update
                    const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');
                    const displayAvatar = getProfilePicture(currentUser); // Use helper
                    // Backend created object is expected in data.data
                    const createdComment = data.data || {
                        id: Date.now(),
                        user: currentUser,
                        comment: text,
                        created_at: new Date().toISOString(),
                        attachments: hasFile ? [{ file_path: fileInput.files[0].name, file_type: fileInput.files[0].name.split('.').pop() }] : [] // Rough mock if data missing
                    };
                    // Ideally use the returned full object from backend if available
                    
                    const list = document.getElementById('comments-list');
                    if(list) {
                         if(list.innerText.includes('No comments yet')) list.innerHTML = '';
                         
                         const newCommentHTML = `
                            <div class="flex gap-3 items-start group/comment" id="comment-row-c-${createdComment.id}">
                                 <img src="${displayAvatar}" class="w-8 h-8 rounded-full border border-white/10 object-cover mt-1 shrink-0">
                                 <div class="flex-1 space-y-1 min-w-0">
                                     <div class="flex justify-between items-start">
                                         <div class="flex items-baseline gap-2">
                                             <span class="text-sm font-bold text-white truncate">${currentUser.name || 'You'}</span>
                                             <span class="text-xs text-slate-500 whitespace-nowrap">Just now</span>
                                         </div>
                                         <div class="relative group">
                                            <button onclick="toggleCommentMenu(event, this)" class="text-slate-500 hover:text-white p-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                                <span class="material-symbols-outlined text-[16px]">more_horiz</span>
                                            </button>
                                            <div class="comment-menu absolute right-0 top-6 w-32 bg-[#1e2330] border border-white/10 rounded-lg shadow-xl py-1 z-20 opacity-0 scale-95 pointer-events-none transition-all duration-200 origin-top-right">
                                                <button onclick="editReelComment(${createdComment.id}, 'comment')" class="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                                                    <span class="material-symbols-outlined text-[14px]">edit</span> Edit
                                                </button>
                                                <button onclick="deleteReelComment(${createdComment.id}, this, 'comment')" class="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/10 flex items-center gap-2">
                                                    <span class="material-symbols-outlined text-[14px]">delete</span> Delete
                                                </button>
                                            </div>
                                         </div>
                                     </div>
                                     
                                     ${(() => {
                                         // 1. Try server data
                                         if(data.data && data.data.attachments && data.data.attachments.length > 0) {
                                              return data.data.attachments.map(att => {
                                                 const url = `${window.PUBLIC_URL}/storage/comments/${att.file_path}`;
                                                 if(['jpg','jpeg','png','gif'].includes(att.file_type?.toLowerCase())) {
                                                    return `<img onclick="openMediaModal('${url}', 'image')" src="${url}" class="mt-2 h-24 w-auto rounded-lg border border-white/10 object-cover cursor-pointer hover:opacity-90">`;
                                                 } else if (['mp4','mov','avi'].includes(att.file_type?.toLowerCase())) {
                                                     return `<div onclick="openMediaModal('${url}', 'video')" class="mt-2 h-24 w-40 bg-black rounded-lg border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 relative group/vid">
                                                                <span class="material-symbols-outlined text-white/50 group-hover/vid:text-white text-3xl">play_circle</span>
                                                             </div>`;
                                                 }
                                                 return '';
                                              }).join('');
                                         }
                                         // 2. Fallback to local file (Optimistic)
                                         else if (hasFile && fileInput.files[0]) {
                                              const file = fileInput.files[0];
                                              const url = URL.createObjectURL(file);
                                              if(file.type.startsWith('image/')) {
                                                  return `<img onclick="openMediaModal('${url}', 'image')" src="${url}" class="mt-2 h-24 w-auto rounded-lg border border-white/10 object-cover cursor-pointer hover:opacity-90">`;
                                              } else if (file.type.startsWith('video/')) {
                                                   return `<div onclick="openMediaModal('${url}', 'video')" class="mt-2 h-24 w-40 bg-black rounded-lg border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 relative group/vid">
                                                              <span class="material-symbols-outlined text-white/50 group-hover/vid:text-white text-3xl">play_circle</span>
                                                           </div>`;
                                              }
                                         }
                                         return '';
                                     })()}

                                     <p class="text-sm text-slate-300 leading-snug comment-text break-words">${text}</p>
                                     
                                     <div class="flex items-center gap-4 mt-1">
                                         <button onclick="initiateReply(${createdComment.id}, '${(currentUser.name || 'You').replace(/'/g, "\\'")}')" class="text-xs font-bold text-slate-500 hover:text-white transition-colors">Reply</button>
                                     </div>
                                     <div id="replies-${createdComment.id}" class="hidden pl-8 pt-2 space-y-3"></div>
                                 </div>
                                 <button class="text-slate-500 hover:text-red-500 transition-colors p-1 group/like shrink-0">
                                     <span class="material-symbols-outlined text-[14px]">favorite</span>
                                 </button>
                            </div>
                        `;
                        list.insertAdjacentHTML('beforeend', newCommentHTML);
                        list.scrollTop = list.scrollHeight;
                    }
                    
                    // Reset Inputs AFTER rendering optimistic UI so we can access files[0]
                    commentInput.value = '';
                    clearReelCommentFile();
                } else {
                    showToast(data.message || 'Failed to post', 'error');
                }
            }
        } catch (e) {
            console.error(e);
            showToast('Network error', 'error');
        } finally {
            sendCommentBtn.disabled = false;
            sendCommentBtn.innerHTML = originalIcon;
        }
    });
}

// Enter key support
if (commentInput) {
    commentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendCommentBtn.click();
        }
    });
}

// Reply Mode Helpers
window.initiateReply = function(commentId, username) {
    replyingTo = { id: commentId, username: username };
    
    const indicator = document.getElementById('reply-indicator');
    const text = document.getElementById('replying-to-text');
    const input = document.getElementById('comment-input');
    
    if(indicator && text) {
        text.textContent = `Replying to ${username}`;
        indicator.classList.remove('hidden');
    }
    
    if(input) {
        input.focus();
        input.placeholder = `Reply to ${username}...`;
    }
}

const cancelReplyMode = () => {
    replyingTo = null;
    const indicator = document.getElementById('reply-indicator');
    const input = document.getElementById('comment-input');
    
    if(indicator) indicator.classList.add('hidden');
    if(input) input.placeholder = "Add a comment...";
}

if(cancelReplyBtn) {
    cancelReplyBtn.addEventListener('click', cancelReplyMode);
}

const viewedReelsSession = new Set();
async function incrementReelView(reelId) {
    if (viewedReelsSession.has(reelId)) return;
    viewedReelsSession.add(reelId);

    try {
        const token = localStorage.getItem('auth_token');
        await fetch(`${API_BASE_URL}/add_view_to_reel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reel_id: reelId })
        });
    } catch (e) {
        console.error('View count error:', e);
    }
}
window.incrementReelView = incrementReelView;

// Reel Actions: Edit & Delete

window.deleteReel = async function deleteReel(reelId) {
    if(!confirm("Are you sure you want to delete this reel?")) return;
    
    // Optimistic UI: Remove Reel Slide immediately
    const reelContainer = document.querySelector(`.snap-center[data-id="${reelId}"]`) || 
                          // try to find by button context if id not set on container
                          Array.from(document.querySelectorAll('button')).find(b => b.onclick && b.onclick.toString().includes(`deleteReel(${reelId})`))?.closest('.snap-center');
    
    let removed = false;
    if (reelContainer) {
        // Animation
        reelContainer.style.transition = "opacity 0.3s, transform 0.3s";
        reelContainer.style.opacity = "0";
        reelContainer.style.transform = "scale(0.9)";
        setTimeout(() => reelContainer.remove(), 300);
        removed = true;
    }

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/delete_reel`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: reelId })
        });
        
        const data = await response.json();
        if(data.success) {
            showToast('Reel deleted', 'success');
             // Update local cache
            try {
                const cached = localStorage.getItem('reels_cache');
                if(cached) {
                    let parsed = JSON.parse(cached);
                    if(Array.isArray(parsed)) parsed = parsed.filter(r => r.id !== reelId);
                    else if (parsed.data) parsed.data = parsed.data.filter(r => r.id !== reelId);
                    localStorage.setItem('reels_cache', JSON.stringify(parsed));
                }
            } catch(e) {}
            
            if(!removed) setTimeout(() => window.location.reload(), 1000);
        } else {
             showToast(data.message || 'Error', 'error');
             if(removed) window.location.reload();
        }
    } catch(e) {
        console.error(e);
        if(removed) window.location.reload();
    }
};

window.editReel = async (reelId) => {
    // Check if we have the reel object in cache or DOM.
    // Since we don't have the full object passed here easily without `this` context or passing it,
    // we can find it in `localStorage` 'reels_cache'.
    let reel = null;
    try {
        const cached = localStorage.getItem('reels_cache');
        if (cached) {
            const parsed = JSON.parse(cached);
             // handle pagination wrapper if exists
            const items = Array.isArray(parsed) ? parsed : (parsed.data ? parsed.data : []);
            reel = items.find(r => r.id === reelId);
        }
    } catch(e) { console.error(e); }

    if (reel) {
        localStorage.setItem('edit_reel_data', JSON.stringify(reel));
        window.location.href = 'create-reel.html';
    } else {
        // Fallback: Fetch it or Prompt?
        // If we can't find it to pass data, better to alert user or try to fetch.
        // For now, let's try to fetch it via API if available, or just alert.
        // Or redirection to create-reel.html?edit_id=ID and let that page fetch it.
        // I prefer the second approach for robustness.
        window.location.href = `create-reel.html?edit_id=${reelId}`;
    }
};

// --- Utils: Toast & Report (Copied here for Reels context) ---

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return; // Should be in HTML

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl backdrop-blur-md border border-white/10 transform transition-all duration-300 translate-y-10 opacity-0 z-[100] ${
        type === 'success' ? 'bg-[#1c1f27]/90 text-green-400' : 'bg-[#1c1f27]/90 text-red-400'
    }`;
    
    toast.innerHTML = `
        <span class="material-symbols-outlined text-[20px]">${type === 'success' ? 'check_circle' : 'error'}</span>
        <span class="text-sm font-medium text-white">${message}</span>
    `;

    container.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    });

    // Remove after 3s
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Report Functions ---

window.openReportModal = function(id, type) {
    const modal = document.getElementById('report-modal');
    if(modal) {
        document.getElementById('report-target-id').value = id;
        document.getElementById('report-target-type').value = type;
        modal.classList.remove('hidden');
    }
}

window.closeReportModal = function() {
    const modal = document.getElementById('report-modal');
    if(modal) modal.classList.add('hidden');
    const input = document.getElementById('report-reason-input');
    if (input) input.value = '';
}

window.submitReport = async function() {
    const id = document.getElementById('report-target-id').value;
    const type = document.getElementById('report-target-type').value;
    const reasonInput = document.getElementById('report-reason-input');
    const reason = reasonInput.value.trim();

    if (!reason) {
        showToast('Please provide a reason', 'error');
        return;
    }
    
    closeReportModal();

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/report_content`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                reportable_id: id,
                reportable_type: type,
                reason: reason
            })
        });

        const data = await response.json();
        if (data.success) {
            showToast('Report submitted.', 'success');
        } else {
            showToast(data.message || 'Failed to submit report', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Network error', 'error');
    }
}

// --- Menu Toggle Helper ---
// --- Menu Toggle Helper ---
// --- Comment Actions (Edit/Delete) ---

window.toggleCommentMenu = function(e, btn) {
    if(e) e.stopPropagation();
    const menu = btn.nextElementSibling;
    
    // Close others
    document.querySelectorAll('.comment-menu.active').forEach(el => {
        if(el !== menu) el.classList.remove('active', 'scale-100', 'opacity-100');
    });
    
    if (menu.classList.contains('active')) {
        menu.classList.remove('active', 'scale-100', 'opacity-100');
        menu.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
    } else {
        menu.classList.add('active', 'scale-100', 'opacity-100', 'pointer-events-auto');
        menu.classList.remove('scale-95', 'opacity-0', 'pointer-events-none');
    }
};

// Close menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.relative.group')) {
        document.querySelectorAll('.comment-menu.active').forEach(el => {
             el.classList.remove('active', 'scale-100', 'opacity-100');
             el.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
        });
    }
});

window.deleteReelComment = async function(commentId, btn, type) {
    if(!confirm("Delete this?")) return;
    
    // Check local element by ID prefix
    const prefix = type === 'reply' ? 'comment-row-r-' : 'comment-row-c-';
    const commentRow = document.getElementById(`${prefix}${commentId}`);
    
    // Optimistic Remove
    if(commentRow) {
        commentRow.style.transition = 'all 0.3s ease';
        commentRow.style.opacity = '0';
        commentRow.style.transform = 'translateX(20px)';
        setTimeout(() => commentRow.remove(), 300);
    }
    
    try {
        const token = localStorage.getItem('auth_token');
        // Define endpoint and body based on type
        const endpoint = type === 'reply' ? `${API_BASE_URL}/delete_comment_reply` : `${API_BASE_URL}/delete_comment`;
        
        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: commentId })
        });
        const data = await response.json();
        if(!data.success) {
            alert(data.message || 'Delete failed');
            // TODO: Restore UI if failed?
        } else {
             // Decrement Count (Only for Top Level Comments)
             if (type !== 'reply' && currentReelIdForComments) {
                 const commentBtn = document.querySelector(`button[onclick="openComments('${currentReelIdForComments}')"] span:last-child, button[onclick="openComments(${currentReelIdForComments})"] span:last-child`);
                 if(commentBtn) {
                     let c = parseInt(commentBtn.textContent.replace(/,/g, '')) || 0;
                     if(c > 0) commentBtn.textContent = formatNumber(c - 1);
                 }
             }
        }
    } catch(e) {
        console.error(e);
        alert('Error deleting');
    }
};

window.editReelComment = function(commentId, type) {
    const prefix = type === 'reply' ? 'comment-row-r-' : 'comment-row-c-';
    const commentRow = document.getElementById(`${prefix}${commentId}`);
    if (!commentRow) return;

    const textP = commentRow.querySelector('.comment-text');
    const originalText = textP.textContent;
    
    // Hide original text
    textP.classList.add('hidden');
    
    // Create Edit Input
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container mt-2';
    // Pass type to saveEditComment
    editContainer.innerHTML = `
        <input type="text" class="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none" value="${originalText.replace(/"/g, '&quot;')}">
        <div class="flex justify-end gap-2 mt-2">
            <button onclick="cancelEditComment(${commentId}, '${originalText.replace(/'/g, "\\'")}', '${type}')" class="text-xs text-slate-400 hover:text-white px-2 py-1">Cancel</button>
            <button onclick="saveEditComment(${commentId}, '${type}')" class="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-md font-bold">Save</button>
        </div>
    `;
    
    // Insert after p
    textP.parentNode.insertBefore(editContainer, textP.nextSibling);
    
    // Hide Menu explicitly
    const menu = commentRow.querySelector('.comment-menu');
    if(menu) {
        menu.classList.remove('active', 'scale-100', 'opacity-100', 'pointer-events-auto');
        menu.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
    }
};

window.cancelEditComment = function(commentId, originalText, type) {
    const prefix = type === 'reply' ? 'comment-row-r-' : 'comment-row-c-';
    const commentRow = document.getElementById(`${prefix}${commentId}`);
    if (!commentRow) return;

    const textP = commentRow.querySelector('.comment-text');
    const editContainer = commentRow.querySelector('.edit-container');
    
    if(editContainer) editContainer.remove();
    textP.textContent = originalText;
    textP.classList.remove('hidden');
};

window.saveEditComment = async function(commentId, type) {
    const prefix = type === 'reply' ? 'comment-row-r-' : 'comment-row-c-';
    const commentRow = document.getElementById(`${prefix}${commentId}`);
    const editContainer = commentRow.querySelector('.edit-container');
    const input = editContainer.querySelector('input');
    const newText = input.value.trim();
    
    if(!newText) return;
    
    // Optimistic Update
    const textP = commentRow.querySelector('.comment-text');
    textP.textContent = newText;
    textP.classList.remove('hidden');
    editContainer.remove();
    
    try {
        const token = localStorage.getItem('auth_token');
        let endpoint = `${API_BASE_URL}/update_comment`;
        let body = { id: commentId, comment: newText };

        if (type === 'reply') {
            endpoint = `${API_BASE_URL}/update_comment_reply`;
            body = { id: commentId, reply: newText };
        }

        const response = await fetch(endpoint, {
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        
        if(!data.success) {
            alert('Update failed: ' + data.message);
        }
    } catch(e) {
        console.error(e);
        alert('Update error');
    }
};


// Global click to close menus
document.addEventListener('click', (e) => {
    // If click is NOT inside a menu group
    if(!e.target.closest('.group\\/menu')) {
        document.querySelectorAll('.active-reel-menu').forEach(el => {
            el.classList.remove('active-reel-menu', 'opacity-100', 'visible');
        });
    }
});

// --- File Attachment Logic for Reels ---

const handleReelCommentFileSelect = (event) => {
    const file = event.target.files[0];
    const previewContainer = document.getElementById('reel-comment-attachment-preview');
    if (!previewContainer) return;

    previewContainer.innerHTML = '';
    previewContainer.classList.add('hidden');

    if (file) {
        previewContainer.classList.remove('hidden');
        const reader = new FileReader();

        const removeBtnHTML = `
            <button onclick="clearReelCommentFile()" class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-colors z-10 flex cursor-pointer">
                <span class="material-symbols-outlined text-[14px]">close</span>
            </button>
        `;

        if (file.type.startsWith('image/')) {
            reader.onload = function (e) {
                previewContainer.innerHTML = `
                    <div class="relative inline-block group">
                        <img src="${e.target.result}" class="h-16 w-auto rounded-md border border-white/10 object-cover bg-black/50">
                        ${removeBtnHTML}
                    </div>`;
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            previewContainer.innerHTML = `
                <div class="relative inline-block group">
                     <div class="h-16 w-24 bg-black rounded-md border border-white/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-white/50 text-2xl">videocam</span>
                    </div>
                    ${removeBtnHTML}
                    <span class="text-[10px] text-slate-400 block mt-1 truncate max-w-[100px]">${file.name}</span>
                </div>`;
        }
    }
};
// Attach listener globally or ensuring call
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('reel-comment-file');
    if(fileInput) {
        fileInput.addEventListener('change', handleReelCommentFileSelect);
    }
});

window.clearReelCommentFile = function() {
    const fileInput = document.getElementById('reel-comment-file');
    const previewContainer = document.getElementById('reel-comment-attachment-preview');
    
    if(fileInput) fileInput.value = '';
    if(previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.classList.add('hidden');
    }
};

window.handleReelCommentFileSelect = handleReelCommentFileSelect;

// Share Functionality
window.shareReel = async (reelId) => {
    const shareUrl = `${window.location.origin}/reels.html?id=${reelId}`;
    const shareData = {
        title: 'Check out this Reel!',
        text: 'Watch this amazing reel on NexUs',
        url: shareUrl
    };

    // Use Native Share if available (Mobile)
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            return;
        } catch (err) {
            console.log('Share canceled or failed', err);
        }
    }

    // Fallback: Custom Modal for Desktop/Unsupported
    const existingModal = document.getElementById('share-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'share-modal';
    modal.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in';
    modal.innerHTML = `
        <div class="w-full max-w-sm bg-[#1e2330] border border-white/10 rounded-2xl p-6 shadow-2xl relative transform transition-all scale-100">
            <button onclick="document.getElementById('share-modal').remove()" class="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                <span class="material-symbols-outlined">close</span>
            </button>
            
            <h3 class="text-lg font-bold text-white mb-2">Share Reel</h3>
            <p class="text-sm text-slate-400 mb-6">Share this reel with your friends.</p>
            
            <div class="space-y-3">
                 <button onclick="copyToClipboard('${shareUrl}', this)" class="w-full flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group">
                    <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <span class="material-symbols-outlined">link</span>
                    </div>
                    <div class="flex-1 text-left">
                        <p class="font-bold text-white text-sm">Copy Link</p>
                        <p class="text-xs text-slate-500 truncate max-w-[200px]">${shareUrl}</p>
                    </div>
                </button>
                
                <a href="https://wa.me/?text=${encodeURIComponent(shareUrl)}" target="_blank" class="w-full flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group">
                    <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 group-hover:bg-green-500 group-hover:text-white transition-colors">
                         <span class="material-symbols-outlined">chat</span>
                    </div>
                     <div class="flex-1 text-left">
                        <p class="font-bold text-white text-sm">Share on WhatsApp</p>
                    </div>
                </a>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
};

window.copyToClipboard = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
        const originalHtml = btn.innerHTML;
        const iconDiv = btn.querySelector('.w-10');
        
        iconDiv.className = "w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white transition-colors";
        iconDiv.innerHTML = '<span class="material-symbols-outlined">check</span>';
        
        const textP = btn.querySelector('div.flex-1 p:first-child');
        textP.textContent = "Copied!";

        setTimeout(() => {
             btn.innerHTML = originalHtml;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
};
