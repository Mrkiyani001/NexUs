/**
 * Notification Service
 * Handles fetching unread counts and managing UI badges across the app.
 */

const NotificationService = {
    unreadCount: 0,

    async fetchUnreadCount() {
        const token = localStorage.getItem('auth_token');
        // if (!token) return;

        try {
            // const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_BASE_URL}/get_unread_notification_count`, {
                credentials: 'include',
                headers: {
                    // 'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            const data = await response.json();
            if (data.success) {
                // Smart Refresh: Only update DOM if count changed
                if (this.unreadCount !== data.data.count) {
                    this.unreadCount = data.data.count;
                    this.updateBadges();
                }
            }
        } catch (error) {
            console.error('Error fetching notification count:', error);
        }
    },

    startPolling() {
        this.fetchUnreadCount().finally(() => {
            setTimeout(() => this.startPolling(), 3000);
        });
    },

    updateBadges() {
        // Desktop Badge
        const desktopBadge = document.getElementById('notif-badge-desktop');
        const mobileBadge = document.getElementById('notif-badge-mobile');

        if (this.unreadCount > 0) {
            if (desktopBadge) {
                desktopBadge.classList.remove('hidden');
                desktopBadge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
            }
            if (mobileBadge) {
                mobileBadge.classList.remove('hidden');
            }
        } else {
            if (desktopBadge) desktopBadge.classList.add('hidden');
            if (mobileBadge) mobileBadge.classList.add('hidden');
        }
    },

    async markAllAsRead() {
        const token = localStorage.getItem('auth_token');
        // if (!token) return;

        try {
            // const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_BASE_URL}/mark_notification_as_read`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    // 'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ id: 'all' })
            });
            const data = await response.json();
            if (data.success) {
                this.unreadCount = 0;
                this.updateBadges();
                return true;
            }
        } catch (error) {
            console.error('Error marking notifications as read:', error);
        }
        return false;
    },

    async markOneAsRead(id) {
        const token = localStorage.getItem('auth_token');
        // if (!token) return;

        try {
            // const token = localStorage.getItem('auth_token');
            await fetch(`${API_BASE_URL}/mark_notification_as_read`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    // 'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ id: id })
            });
            this.fetchUnreadCount(); // Refresh count
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    },

    async handleNotificationClick(notification) {
        console.log("Notification Clicked:", notification); // Debug Log
        await this.markOneAsRead(notification.id);

        // Determine redirect path based on notifiable_type or content
        if (notification.notifiable_type.includes('Post')) {
            // Admin Redirect for Flagged Posts
            if (notification.title.includes('Flagged') || notification.title.includes('Review')) {
                const targetUrl = 'admin%20panel/moderation-queue.html';
                console.log("Redirecting to Admin Queue:", targetUrl);
                window.location.href = targetUrl;
            } else {
                const targetUrl = `post-detail-veiw.html?id=${notification.notifiable_id}`;
                console.log("Redirecting to Post:", targetUrl);
                window.location.href = targetUrl;
            }
            // Handle Follow Request redirects
        } else if (notification.notifiable_type.includes('User')) {
            if (notification.title.includes('Request') || notification.title.includes('New Follower')) {
                if (notification.title.includes('Accepted')) {
                    // If accepted, view their profile
                    window.location.href = `profile.html?id=${notification.notifiable_id}`;
                } else {
                    // If incoming request, go to requests page
                    window.location.href = 'friendreq.html';
                }
            } else {
                window.location.href = `profile.html?id=${notification.notifiable_id}`;
            }
        } else if (notification.notifiable_type.includes('Comment')) {
            // If it's a comment, we usually want to view the post it belongs to
            // This might need more data from backend or a separate fetch
            // For now, let's assume notifiable_id is the relevant entity
            if (notification.text.toLowerCase().includes('post') || notification.title.toLowerCase().includes('post')) {
                // Try to guess if it's related to a post
                // Ideally backend should provide the post_id in data
            }
        }
    }
};
// Initialize Global Notification Polling
document.addEventListener('DOMContentLoaded', () => {
    // Check if we assume logged in (e.g. user_data exists or just try)
    if (localStorage.getItem('user_data')) {
        NotificationService.startPolling();
    }
});
document.addEventListener('DOMContentLoaded', () => {
    // Only fetch if logged in
    if (localStorage.getItem('user_data')) {
        NotificationService.fetchUnreadCount();
        // Set interval to check every 10 seconds (Safe Refresh)
        setInterval(() => NotificationService.fetchUnreadCount(), 10000);
    }
});
