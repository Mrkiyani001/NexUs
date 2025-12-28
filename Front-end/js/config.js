/**
 * Global Configuration
 * Central source of truth for API URLs
 */

// Toggle this for local vs production
const IS_LOCAL = true;

const API_BASE_URL = IS_LOCAL
    ? 'http://127.0.0.1:8000/api'
    : 'https://your-production-domain.com/api';

const PUBLIC_URL = IS_LOCAL
    ? 'http://127.0.0.1:8000'
    : 'https://your-production-domain.com';

// Expose to window for global access
window.API_BASE_URL = API_BASE_URL;
window.PUBLIC_URL = PUBLIC_URL;

console.log('App Config Loaded:', { API_BASE_URL, PUBLIC_URL });
