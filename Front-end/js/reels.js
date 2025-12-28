/**
 * Reels Logic
 * Handles fetching and displaying reels from the API
 */

const API_BASE_URL = 'http://127.0.0.1:8000/api';
const PUBLIC_URL = 'http://127.0.0.1:8000';

document.addEventListener('DOMContentLoaded', () => {
    fetchReels();
    populateUserProfile();
    fetchSuggestions();
});

async function fetchReels() {
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

        const response = await fetch(`${API_BASE_URL}/get_all_reels`, {
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
            console.error('Failed to fetch reels:', data.message);
            container.innerHTML = `
                <div class="h-full w-full flex flex-col items-center justify-center text-slate-500">
                    <span class="material-symbols-outlined text-4xl mb-2">error</span>
                    <p>Failed to load reels</p>
                    <button onclick="fetchReels()" class="mt-4 text-primary hover:underline">Try Again</button>
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

function createReelElement(reel) {
    const div = document.createElement('div');
    div.className = 'snap-center relative shrink-0 w-full h-[85vh] min-h-[600px] rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/5 mb-6 group';

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
            videoUrl = `${PUBLIC_URL}/storage/${cleanPath}`;
        }
    }

    let thumbUrl = '';
    if (reel.thumbnail_path) {
        if (reel.thumbnail_path.startsWith('http')) {
            thumbUrl = reel.thumbnail_path;
        } else {
            const cleanThumb = reel.thumbnail_path.startsWith('/') ? reel.thumbnail_path.substring(1) : reel.thumbnail_path;
            thumbUrl = `${PUBLIC_URL}/storage/${cleanThumb}`;
        }
    }

    const userAvatar = reel.user && reel.user.profile_picture ?
        (reel.user.profile_picture.startsWith('http') ? reel.user.profile_picture : `${PUBLIC_URL}/storage/${reel.user.profile_picture}`)
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.user ? reel.user.name : 'User')}&background=random`;
    const userName = reel.user ? reel.user.name : 'Unknown User';

    div.innerHTML = `
        <video 
            class="h-full w-full object-cover"
            src="${videoUrl}" 
            ${thumbUrl ? `poster="${thumbUrl}"` : ''}
            loop 
            playsinline
            muted 
            onclick="togglePlay(this)"
            onerror="console.error('Video failed to load:', this.src)"
        ></video>
        
        <div class="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"></div>
        <div class="absolute inset-0 reel-overlay-gradient pointer-events-none"></div>
        
        <!-- Action Buttons -->
        <div class="absolute right-4 bottom-24 flex flex-col items-center gap-5 z-20">
            <button class="group/btn flex flex-col items-center gap-1" onclick="likeReel(${reel.id})">
                <div class="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 transition-all group-hover/btn:bg-white/20 group-hover/btn:scale-110 active:scale-95">
                    <span class="material-symbols-outlined text-white text-[28px]">favorite</span>
                </div>
                <span class="text-xs font-bold text-white drop-shadow-md">${reel.likes_count || 0}</span>
            </button>
            <button class="group/btn flex flex-col items-center gap-1" onclick="openComments(${reel.id})">
                <div class="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 transition-all group-hover/btn:bg-white/20 group-hover/btn:scale-110 active:scale-95">
                    <span class="material-symbols-outlined text-white text-[28px]">chat_bubble</span>
                </div>
                <span class="text-xs font-bold text-white drop-shadow-md">${reel.comments_count || 0}</span>
            </button>
            <button class="group/btn flex flex-col items-center gap-1">
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

    return div;
}

function togglePlay(video) {
    if (video.paused) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => { console.error("Play failed:", error); });
        }
        // Update UI
        const container = video.parentElement;
        const playIcon = container.querySelector(`[id^="play-icon-"]`);
        if (playIcon) playIcon.style.opacity = '0';
    } else {
        video.pause();
        // Update UI
        const container = video.parentElement;
        const playIcon = container.querySelector(`[id^="play-icon-"]`);
        if (playIcon) playIcon.style.opacity = '1';
    }
}

// TODO: Implement Like functionality
function likeReel(id) {
    console.log('Like reel', id);
    // Call API to like
}

// TODO: Implement Comments functionality
function openComments(id) {
    console.log('Open comments for reel', id);
    // Show modal or redirect
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

        if (img) img.src = user.profile?.avatar ? (typeof user.profile.avatar === 'string' ? `${PUBLIC_URL}/${user.profile.avatar}` : `${PUBLIC_URL}/${user.profile.avatar.file_path}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;

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
                        avatar = `${PUBLIC_URL}/${user.profile.avatar}`;
                    } else if (user.profile.avatar.file_path) {
                        avatar = `${PUBLIC_URL}/${user.profile.avatar.file_path}`;
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
