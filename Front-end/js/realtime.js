// realtime.js - Global Reverb/Echo Configuration & Listeners

const MAX_RETRIES = 5;
let retryCount = 0;

async function setupRealtimeConfig() {
    // 1. Check Window
    if (!window.currentUserData || !window.currentUserData.id) {
        // 2. Check LocalStorage
        const stored = localStorage.getItem('user_data');
        if (stored) {
            try {
                window.currentUserData = JSON.parse(stored);
                if (window.currentUserData.id) {
                    console.log("Realtime: User data loaded from localStorage");
                     proceedWithRealtime();
                     return;
                }
            } catch(e) {}
        }

        // 3. Active Fetch
        if (retryCount < MAX_RETRIES) {
             console.log(`Realtime: Fetching user data... (${retryCount + 1}/${MAX_RETRIES})`);
             try {
                const res = await fetch(`${API_BASE_URL}/getUser`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                if (data.success && data.data) {
                    window.currentUserData = data.data;
                    localStorage.setItem('user_data', JSON.stringify(data.data));
                    console.log("Realtime: User data fetched successfully");
                    proceedWithRealtime();
                    return;
                }
             } catch(e) {
                 console.error("Realtime: Fetch failed", e);
             }
             
             retryCount++;
             setTimeout(setupRealtimeConfig, 2000); // Retry fetch in 2s
             return;
        }
        console.warn("Realtime skipped: Unable to get user data.");
        return;
    }
    proceedWithRealtime();
}

async function proceedWithRealtime() {
    try {
        const response = await fetch(`${API_BASE_URL}/broadcasting/config`);
        const config = await response.json();

        // Check SSL (HTTPS)
        const isSecure = window.location.protocol === 'https:';
        const finalHost = (config.host === '0.0.0.0') ? window.location.hostname : config.host;

        window.Echo = new Echo({
            broadcaster: 'pusher',
            key: config.key,
            cluster: 'mt1',
            wsHost: finalHost,
            wsPort: isSecure ? 443 : (config.port ?? 8080),
            wssPort: isSecure ? 443 : (config.port ?? 8080),
            forceTLS: isSecure,
            enabledTransports: ['ws', 'wss'],
            disableStats: true,
            authorizer: (channel, options) => {
                return {
                    authorize: (socketId, callback) => {
                        fetch(`${API_BASE_URL}/broadcasting/auth`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Accept": "application/json",
                                "X-XSRF-TOKEN": decodeURIComponent(document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')[1] || '')
                            },
                            credentials: 'include',
                            body: JSON.stringify({
                                socket_id: socketId,
                                channel_name: channel.name
                            })
                        })
                            .then(response => {
                                if (!response.ok) throw new Error('Auth failed');
                                return response.json();
                            })
                            .then(data => callback(false, data))
                            .catch(error => callback(true, error));
                    }
                };
            }
        });

        console.log('🚀 Reverb Connected Globally');
        setupGlobalListeners();

        // If on message.html, trigger specific setup
        if (typeof setupRealtime === 'function') {
            setupRealtime(); // Call message.js specific logic (e.g. status ticks)
        }

    } catch (e) {
        console.error('❌ Reverb Config Error:', e);
    }
}

function setupGlobalListeners() {
    if (!window.Echo || !window.currentUserData) return;

    window.Echo.private(`chat.${window.currentUserData.id}`)
        .listen('MessagesEvent', (e) => {
            console.log('Global: New Message Received:', e);

            // 1. Mark as Delivered (Global Action)
            // We do this REGARDLESS of where the user is.
            if (e.message && e.message.id) {
                markAsDeliveredGlobal(e.message.id);
            }

            // 2. Show Toast (If NOT on message page, or chat closed)
            const isOnMessagePage = window.location.pathname.includes('message.html');
            // We assume message.js handles the active chat UI. 
            // If we are on message page, message.js might suppress toast if chat is open.
            // But if we are NOT on message page, we definitely show toast.
            if (!isOnMessagePage) {
                if (window.showToast) {
                    showToast(`New message from ${e.message.sender.name}`, 'success');
                }
            } else {
                // On message page, let message.js handle notifications to avoid duplicates,
                // UNLESS message.js logic decides otherwise.
                // But for safety, message.js usually handles the "Active Chat" check.
            }
        });
}

async function markAsDeliveredGlobal(messageId) {
    try {
        await fetch(`${API_BASE_URL}/message/delivered`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json',
                'X-XSRF-TOKEN': decodeURIComponent(document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')[1] || '')
            },
            credentials: 'include',
            body: JSON.stringify({ message_id: messageId }) // Updated param name
        });
        console.log("Global: Marked as delivered:", messageId);
    } catch (e) {
        console.error("Global: Failed to mark delivered", e);
    }
}

// Auto-start
document.addEventListener('DOMContentLoaded', () => {
    // Wait slightly for configs
    setTimeout(setupRealtimeConfig, 100);
});
