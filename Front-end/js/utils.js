// --- TOAST NOTIFICATION SYSTEM (Original Glass Style) ---

// 1. CSS Styles Injection
function injectToastStyles() {
    if (document.getElementById('toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        /* Toast Notification Container */
        #toast-container {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            width: max-content;
            max-width: 90vw;
        }

        /* Toast Card Style */
        .toast {
            background: rgba(16, 21, 34, 0.95);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 12px 24px;
            border-radius: 12px;
            color: white;
            font-size: 0.9rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            pointer-events: auto;
        }

        /* Visible State */
        .toast.show {
            opacity: 1;
            transform: translateY(0);
        }

        /* Types */
        .toast.success { border-left: 4px solid #215bed; }
        .toast.error { border-left: 4px solid #ef4444; }

        /* Icons */
        .toast .material-symbols-outlined {
            font-size: 20px;
        }
        .toast.success .material-symbols-outlined { color: #215bed; }
        .toast.error .material-symbols-outlined { color: #ef4444; }
    `;
    document.head.appendChild(style);
}

// Inject styles immediately
injectToastStyles();

// 2. Global Show Toast Function
window.showToast = function (message, type = 'success') {
    // Create Container if not exists
    const container = document.getElementById('toast-container') || (() => {
        const c = document.createElement('div');
        c.id = 'toast-container';
        document.body.appendChild(c);
        return c;
    })();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = type === 'success' ? 'check_circle' : 'error';
    
    toast.innerHTML = `
        <span class="material-symbols-outlined">${icon}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto Remove
    setTimeout(() => {
        if (toast.isConnected) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
};

// 3. Global Fetch Interceptor (For auto-logout on 401)
if (!window.isUtilsLoaded) {
    window.isUtilsLoaded = true;
    (function() {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            try {
                const response = await originalFetch(...args);

                // Handle 401 Unauthorized -> Logout
                if (response.status === 401) {
                    // Don't loop on login page
                    if (!window.location.pathname.includes('login.html')) {
                        localStorage.removeItem('auth_token');
                        window.location.href = 'login.html';
                    }
                }
                
                return response;
            } catch (error) {
                // If it's a network error, we might want to show a toast
                if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                    if (typeof window.showToast === 'function') {
                        window.showToast('Network error. Check connection.', 'error');
                    }
                }
                throw error;
            }
        };
    })();
}
