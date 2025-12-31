/**
 * Site Branding Script (Final Fixed Version)
 * Fetches site settings from API and updates the UI (Title, Logo, Favicon)
 */
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Config Check (Fallback to IP if config.js fails)
    // Agar PUBLIC_URL defined nahi hai to direct IP use karega
    const BASE_URL = (typeof PUBLIC_URL !== 'undefined') ? PUBLIC_URL : 'http://54.248.199.202';

    // Function to apply settings to UI
    const applySettings = (settings) => {
        if (!settings) return;

        const siteName = settings.site_name || 'NexUs';

        // A. Update Page Title
        document.title = siteName;

        // B. Update Logo Text
        const logoTextElements = document.querySelectorAll('#site-logo-text');
        logoTextElements.forEach(el => el.textContent = siteName);

        // C. Update Favicon (Browser Tab Icon)
        const faviconPath = settings.favicon ? `${BASE_URL}/storage/${settings.favicon}` : '';
        if (faviconPath) {
            let link = document.querySelector("link[rel*='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = faviconPath;
        }

        // D. Update Logo Image
        const logoPath = settings.logo ? `${BASE_URL}/storage/${settings.logo}` : '';
        const logoImgElements = document.querySelectorAll('#site-logo-img');

        logoImgElements.forEach(img => {
            if (img.tagName === 'IMG') {
                // Agar <img> tag hai (Dashboard waghaira mein)
                if (logoPath) {
                    img.src = logoPath;
                    img.style.display = 'block';
                } else {
                    img.style.display = 'none';
                }
            } else {
                // Agar <div> tag hai (Login Page case)
                if (logoPath) {
                    img.style.backgroundImage = `url('${logoPath}')`;
                    img.style.backgroundSize = 'cover'; // Ensure image fits
                    img.style.backgroundPosition = 'center';
                    img.textContent = ''; // Icon hata dein
                }
            }
        });

        // E. Update Footer
        const footerText = document.getElementById('site-footer-text');
        if (footerText) {
            footerText.textContent = `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`;
        }
    };

    // Expose function globally
    window.refreshSiteBranding = async () => {
        // 1. Pehle LocalStorage (Cache) se data uthao (Fast Load)
        const cachedSettings = localStorage.getItem('site_settings');
        if (cachedSettings) {
            try { applySettings(JSON.parse(cachedSettings)); } catch (e) { }
        }

        // 2. Phir Server se naya data lao
        try {
            const response = await fetch(`${BASE_URL}/api/settings?t=${new Date().getTime()}`, {
                headers: { 
                    'Content-Type': 'application/json', 
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    // Array handle karne ke liye check
                    let settings = Array.isArray(data.data) ? data.data[0] : data.data;
                    
                    // Save to Cache
                    localStorage.setItem('site_settings', JSON.stringify(settings));
                    
                    // Apply Updates
                    applySettings(settings);
                }
            }
        } catch (error) {
            console.error("Branding update failed:", error);
        }
    };

    // Start Process Immediately
    window.refreshSiteBranding();
});