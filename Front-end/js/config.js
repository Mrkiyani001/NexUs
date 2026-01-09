/**
 * Global Configuration
 * Central source of truth for API URLs
 */

// Auto-detect Local Environment
if (typeof IS_LOCAL === 'undefined') {
    var IS_LOCAL = window.location.hostname === '127.0.0.1' || 
                   window.location.hostname === 'localhost' || 
                   window.location.protocol === 'file:';
}

// Auto-detect Local Environment
if (typeof IS_LOCAL === 'undefined') {
    var IS_LOCAL = window.location.hostname === '127.0.0.1' || 
                   window.location.hostname === 'localhost' || 
                   window.location.protocol === 'file:';
}

// Dynamic API Host: Matches 'localhost' or '127.0.0.1' to prevent Cross-Site mismatches
var localApiHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? window.location.hostname 
    : '127.0.0.1';

var API_BASE_URL = IS_LOCAL
    ? `http://${localApiHost}:8000/api`
    : 'https://web.kiyanibhai.site/api';

var PUBLIC_URL = IS_LOCAL
    ? `http://${localApiHost}:8000`
    : 'https://web.kiyanibhai.site';

// Expose to window for global access
window.API_BASE_URL = API_BASE_URL;
window.PUBLIC_URL = PUBLIC_URL;

console.log('App Config Loaded:', { API_BASE_URL, PUBLIC_URL });