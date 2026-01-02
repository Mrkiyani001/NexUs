
/**
 * Global Configuration
 * Central source of truth for API URLs
 */

// Toggle this for local vs production
if (typeof IS_LOCAL === 'undefined') {
    var IS_LOCAL = false; 
}

    var API_BASE_URL = IS_LOCAL
    ? 'http://127.0.0.1:8000/api'
    : 'https://web.kiyanibhai.site/api'; 

    var PUBLIC_URL = IS_LOCAL
    ? 'http://127.0.0.1:8000'
    : 'https://web.kiyanibhai.site';

// Expose to window for global access
window.API_BASE_URL = API_BASE_URL;
window.PUBLIC_URL = PUBLIC_URL;

console.log('App Config Loaded:', { API_BASE_URL, PUBLIC_URL });

