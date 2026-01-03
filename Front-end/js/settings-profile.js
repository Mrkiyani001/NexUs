document.addEventListener('DOMContentLoaded', async () => {
    // API_BASE_URL is defined in config.js
    const apiBaseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://127.0.0.1:8000/api';
    const authToken = localStorage.getItem('auth_token'); 

    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }

    // Toggle Elements
    const privacyToggleBtn = document.querySelector('#privacy-toggle-btn');
    const friendReqToggleBtn = document.querySelector('#friend-req-toggle-btn');
    const updatePassBtn = document.querySelector('#update-password-btn');
    const deactivateBtn = document.querySelector('#deactivate-btn');
    const deleteAccountBtn = document.querySelector('#delete-account-btn');
    const passwordForm = document.querySelector('form');
    
    // Notification Checkboxes
    const emailLoginAlert = document.getElementById('email-login-alert');
    const pushLoginAlert = document.getElementById('push-login-alert');
    const suspiciousActivityAlert = document.getElementById('suspicious-activity-alert');

    // Helper to get headers
    function getHeaders() {
        return {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    async function loadSettings() {
        try {
            const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
            if (!userData.id) {
                // If no user data, try to fetch/me or redirect
                // specific implementation depends on strictness. 
                // For now, if no ID, we can't fetch settings easily without a /me endpoint.
                // Assuming we stored user_data on login.
                window.location.href = 'login.html';
                return;
            }
            window.currentUserId = userData.id;

            const response = await fetch(`${apiBaseUrl}/getUser`, { 
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ id: userData.id })
            });

            const data = await response.json();
            console.log('Settings Data Recvd:', data);

            if (data.success || data.status) {
                const user = data.data;
                updateUI(user);
            } else {
                 showToast(data.message || 'Failed to load settings', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error loading settings', 'error');
        }
    }

    function updateUI(user) {
        setToggleState(privacyToggleBtn, user.is_private);
        setToggleState(friendReqToggleBtn, user.allow_friend_request);
        
        if (emailLoginAlert) emailLoginAlert.checked = user.email_login_alerts;
        if (pushLoginAlert) pushLoginAlert.checked = user.push_login_alerts;
        if (suspiciousActivityAlert) suspiciousActivityAlert.checked = user.suspicious_activity_alerts;

        window.currentUserId = user.id;

        // Update Header Avatar
        // Update Header Avatar, Name, and Handle
        const headerAvatar = document.getElementById('header-user-avatar');
        const headerName = document.getElementById('header-user-name');
        const headerHandle = document.getElementById('header-user-handle');

        if (headerAvatar) {
             const avatarUrl = getProfilePicture(user);
             
             if (headerAvatar.tagName === 'IMG') {
                 headerAvatar.src = avatarUrl;
             } else {
                 headerAvatar.style.backgroundImage = `url("${avatarUrl}")`;
             }
             headerAvatar.setAttribute('title', user.name || 'User');
        }

        if (headerName) headerName.textContent = user.name || 'User';
        if (headerHandle) headerHandle.textContent = `@${(user.name || 'user').toLowerCase().replace(/\s+/g, '')}`;
    }

    function setToggleState(btn, isActive) {
        if (!btn) return;
        const span = btn.querySelector('span');
        if (isActive) {
            btn.classList.remove('bg-surface-highlight', 'border', 'border-text-secondary/30');
            btn.classList.add('bg-primary');
            span.classList.remove('left-1', 'bg-text-secondary');
            span.classList.add('right-1', 'bg-white');
        } else {
            btn.classList.add('bg-surface-highlight', 'border', 'border-text-secondary/30');
            btn.classList.remove('bg-primary');
            span.classList.add('left-1', 'bg-text-secondary');
            span.classList.remove('right-1', 'bg-white');
        }
        btn.dataset.active = isActive;
    }

    // Event Listeners for Toggles
    if (privacyToggleBtn) {
        privacyToggleBtn.addEventListener('click', () => {
             const currentState = privacyToggleBtn.dataset.active === 'true';
             const newState = !currentState;
             toggleSetting('is_private', newState ? 1 : 0, privacyToggleBtn, newState);
        });
    }

    if (friendReqToggleBtn) {
        friendReqToggleBtn.addEventListener('click', () => {
             const currentState = friendReqToggleBtn.dataset.active === 'true';
             const newState = !currentState;
             toggleSetting('allow_friend_request', newState ? 1 : 0, friendReqToggleBtn, newState);
        });
    }

    if (emailLoginAlert) {
        emailLoginAlert.addEventListener('change', (e) => {
            if (e.isTrusted) updateNotificationSetting('email_login_alerts', emailLoginAlert);
        });
    }
    if (pushLoginAlert) {
        pushLoginAlert.addEventListener('change', (e) => {
            if (e.isTrusted) updateNotificationSetting('push_login_alerts', pushLoginAlert);
        });
    }
    if (suspiciousActivityAlert) {
        suspiciousActivityAlert.addEventListener('change', (e) => {
             if (e.isTrusted) updateNotificationSetting('suspicious_activity_alerts', suspiciousActivityAlert);
        });
    }

    async function toggleSetting(key, value, btn, boolState) {
        // Optimistic UI update
        if (btn) setToggleState(btn, boolState); 
        
        try {
            const formData = new FormData();
            formData.append(key, value);
            
            const response = await fetch(`${apiBaseUrl}/update_profile`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                },
                body: formData
            });
            
            const data = await response.json();
            if (!data.success && !data.status) {
                throw new Error(data.message || 'Update failed');
            }
            showToast('Settings updated', 'success');
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
            if(btn) setToggleState(btn, !boolState); // Revert
        }
    }

    async function updateNotificationSetting(key, checkbox) {
         const originalState = !checkbox.checked; // State before change
         const newValue = checkbox.checked ? 1 : 0;
         
         try {
             const formData = new FormData();
             formData.append(key, newValue);
             
             const response = await fetch(`${apiBaseUrl}/update-profile`, {
                 method: 'POST',
                 headers: {
                     'Authorization': `Bearer ${authToken}`,
                     'Accept': 'application/json'
                 },
                 body: formData
             });
             
             const data = await response.json();
             if (!data.success && !data.status) {
                 throw new Error(data.message || 'Update failed');
             }
             showToast('Settings updated', 'success');
         } catch (error) {
             console.error(error);
             showToast(error.message, 'error');
             checkbox.checked = originalState; // Revert
         }
    }

    // Password Change
    if (updatePassBtn && passwordForm) {
        const inputs = passwordForm.querySelectorAll('input');
        const currentPassInput = inputs[0];
        const newPassInput = inputs[1];
        const confirmPassInput = inputs[2];
        const strengthMeterBars = passwordForm.querySelectorAll('.flex.gap-1\\.5 > div');
        const strengthText = passwordForm.querySelector('p.text-xs');

        // Regex for validations
        const hasLetters = /[a-zA-Z]/;
        const hasNumbers = /[0-9]/;
        const hasSymbols = /[^a-zA-Z0-9]/;

        function validatePassword(password) {
            let strength = 0;
            if (password.length >= 8) strength++;
            if (hasLetters.test(password)) strength++;
            if (hasNumbers.test(password)) strength++;
            if (hasSymbols.test(password)) strength++;
            return strength;
        }

        function updateStrengthMeter(password) {
            const strength = validatePassword(password);
            
            // Reset bars
            strengthMeterBars.forEach(bar => {
                bar.className = 'h-1 flex-1 rounded-full bg-surface-highlight transition-all duration-300';
            });

            // Update text and bars
            if (password.length === 0) {
                strengthText.textContent = '';
                strengthText.className = 'text-xs px-1 font-medium min-h-[1.25rem]'; // maintain height
                return;
            }

            if (password.length < 8) {
                strengthText.textContent = 'Too short (min 8 chars)';
                strengthText.className = 'text-xs text-red-500 px-1 font-medium';
                strengthMeterBars[0].classList.replace('bg-surface-highlight', 'bg-red-500');
            } else if (strength < 3) {
                strengthText.textContent = 'Weak (mix letters & numbers)';
                strengthText.className = 'text-xs text-yellow-500 px-1 font-medium';
                strengthMeterBars[0].classList.replace('bg-surface-highlight', 'bg-yellow-500');
                strengthMeterBars[1].classList.replace('bg-surface-highlight', 'bg-yellow-500');
            } else if (strength === 3) {
                 strengthText.textContent = 'Medium (add symbols)';
                 strengthText.className = 'text-xs text-blue-500 px-1 font-medium';
                 strengthMeterBars[0].classList.replace('bg-surface-highlight', 'bg-blue-500');
                 strengthMeterBars[1].classList.replace('bg-surface-highlight', 'bg-blue-500');
                 strengthMeterBars[2].classList.replace('bg-surface-highlight', 'bg-blue-500');
            } else if (strength === 4) {
                strengthText.textContent = 'Strong password';
                strengthText.className = 'text-xs text-green-500 px-1 font-medium';
                strengthMeterBars.forEach(bar => bar.classList.replace('bg-surface-highlight', 'bg-green-500'));
            }
        }

        newPassInput.addEventListener('input', (e) => updateStrengthMeter(e.target.value));

        updatePassBtn.addEventListener('click', async () => {
            const currentPass = currentPassInput.value;
            const newPass = newPassInput.value;
            const confirmPass = confirmPassInput.value;

            if (!currentPass || !newPass || !confirmPass) {
                showToast('Please fill all fields', 'error');
                return;
            }
            if (newPass.length < 8) {
                 showToast('Password must be at least 8 characters', 'error');
                 return;
            }
            if (!hasLetters.test(newPass) || !hasNumbers.test(newPass) || !hasSymbols.test(newPass)) {
                showToast('Password must contain alphabets, numbers, and symbols', 'error');
                return;
            }
            if (newPass !== confirmPass) {
                showToast('New passwords do not match', 'error');
                return;
            }

            try {
                if (!window.currentUserId) {
                    showToast('User not loaded', 'error');
                    return;
                }

                const response = await fetch(`${apiBaseUrl}/updatePassword`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        id: window.currentUserId,
                        current_password: currentPass,
                        password: newPass,
                        password_confirmation: confirmPass
                    })
                });

                const data = await response.json();
                if (data.success || data.status) {
                    showToast('Password updated successfully', 'success');
                    passwordForm.reset();
                    updateStrengthMeter(''); // Reset meter
                } else {
                    showToast(data.message, 'error');
                }
            } catch (error) {
                showToast('Error updating password', 'error');
            }
        });
    }

    // Password Visibility Toggles
    const togglePasswordBtns = document.querySelectorAll('button span.material-symbols-outlined');
    
    togglePasswordBtns.forEach(span => {
        if(span.innerText.includes('visibility_off')) {
            const btn = span.closest('button');
            if(btn) {
                btn.addEventListener('click', () => {
                   const inputContainer = btn.closest('.relative');
                   const input = inputContainer.querySelector('input');
                   
                   if(input) {
                       if(input.type === 'password') {
                           input.type = 'text';
                           span.innerText = 'visibility';
                       } else {
                           input.type = 'password';
                           span.innerText = 'visibility_off';
                       }
                   }
                });
            }
        }
    });

    // Deactivate Account
    if (deactivateBtn) {
        deactivateBtn.addEventListener('click', async () => {
             if(confirm("Are you sure you want to deactivate your account? You can reactivate it by logging in again.")){
                try {
                    const response = await fetch(`${apiBaseUrl}/deactivate_account`, {
                        method: 'POST',
                        headers: getHeaders()
                    });
                    const data = await response.json();
                    if(data.success || data.status){
                        showToast(data.message, 'success');
                        setTimeout(() => {
                           localStorage.removeItem('auth_token');
                           localStorage.removeItem('user_data');
                           window.location.href = 'login.html';
                        }, 1500);
                    } else {
                         showToast(data.message || 'Deactivation failed', 'error');
                    }
                } catch(e) {
                    showToast('Error deactivating account', 'error');
                }
             }
        });
    }

    // Delete Account
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            if(confirm("Are you sure you want to PERMANENTLY delete your account? This cannot be undone.")){
                 if (!window.currentUserId) return;
                 try {
                    const response = await fetch(`${apiBaseUrl}/delete_user`, {
                        method: 'DELETE',
                        headers: getHeaders(),
                        body: JSON.stringify({ id: window.currentUserId })
                    });
                    const data = await response.json();
                    if(data.success || data.status){
                        showToast('Account deleted', 'success');
                         setTimeout(() => {
                           localStorage.removeItem('auth_token');
                           localStorage.removeItem('user_data');
                           window.location.href = 'register.html';
                        }, 1500);
                    } else {
                        showToast(data.message || 'Delete failed', 'error');
                    }
                 } catch(e) {
                     showToast('Error deleting account', 'error');
                 }
            }
        });
    }

    // Initialize
    loadSettings();
});
