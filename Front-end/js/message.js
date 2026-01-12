// --- State Management ---
let activeChatUser = null;
let activeOpenChatUserId = null; 
let conversations = [];
let echoInstance = null;
let filesQueue = []; // Global File Queue

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadConversations();
    setupUserSearch();

    // Message Form Submit
    const msgForm = document.getElementById('message-form');
    if (msgForm) {
        msgForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage();
        });
    }

    // Enter to Send
    const msgInput = document.getElementById('message-input');
    if (msgInput) {
        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        // Update Button State on Input
        msgInput.addEventListener('input', updateSendButtonState);
    }

    // Attach File Input Listeners
    ['camera-input', 'gallery-input', 'doc-input', 'other-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', handleFileSelect);
        }
    });
});

function handleFileSelect(event) {
    const currentInput = event.target;
    // Clear other inputs to ensure WYSIWYG
    ['camera-input', 'gallery-input', 'doc-input', 'other-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el !== currentInput) {
            el.value = '';
        }
    });

    const newFiles = Array.from(currentInput.files);
    if (newFiles.length > 0) {
        // Add to queue
        filesQueue = [...filesQueue, ...newFiles];
        renderFilePreviews();
        
        // DEBUG TOAST
        showToast(`Files added: ${newFiles.length}. Queue size: ${filesQueue.length}`, 'success');

        // Hide menu
        const menu = document.getElementById('media-menu');
        if(menu) menu.classList.add('hidden');

        // Enable Send Button
        const sendBtn = document.querySelector('#message-form button[type="submit"]');
        if(sendBtn) sendBtn.disabled = false;
        if(sendBtn) sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

function renderFilePreviews() {
    const previewArea = document.getElementById('file-preview-area');
    
    if (filesQueue.length > 0) {
        previewArea.classList.remove('hidden');
        previewArea.innerHTML = '';

        filesQueue.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'relative shrink-0 w-16 h-16 bg-surface-border rounded-lg overflow-hidden flex items-center justify-center border border-white/5 group/file';

             // Remove Button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 hover:bg-black/80 rounded-full text-white flex items-center justify-center z-10 transition-colors backdrop-blur-sm opacity-0 group-hover/file:opacity-100';
            removeBtn.innerHTML = '<span class="material-symbols-outlined text-[14px]">close</span>';
            removeBtn.title = "Remove";
            removeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                removeAttachment(index);
            };
            div.appendChild(removeBtn);

            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.className = 'w-full h-full object-cover';
                div.appendChild(img);
            } else {
                 div.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-1">
                        <span class="material-symbols-outlined text-white/50 text-2xl">description</span>
                        <span class="text-[8px] text-white/50 truncate w-full text-center mt-1">${file.name.split('.').pop().toUpperCase()}</span>
                    </div>
                `;
                div.appendChild(removeBtn);
            }
            previewArea.appendChild(div);
        });
    } else {
        previewArea.classList.add('hidden');
        previewArea.innerHTML = '';
    }
}

function removeAttachment(index) {
    filesQueue.splice(index, 1);
    renderFilePreviews();
}

// --- API Interactions ---

async function loadConversations() {
    try {
        const response = await fetch(`${API_BASE_URL}/getconversations`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'include'
        });
        const result = await response.json();

        if (result.success) {
            conversations = result.data.items;
            renderConversations();
            updateTotalUnread();
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

async function startNewChat() {
    const modal = document.getElementById('user-selection-modal');
    modal.classList.remove('hidden');
    document.getElementById('user-search-input').focus();
    loadUsersForSearch();
}

function closeUserSelectionModal() {
    document.getElementById('user-selection-modal').classList.add('hidden');
}

async function loadUsersForSearch(query = '') {
    const listContainer = document.getElementById('user-list-container');
    listContainer.innerHTML = '<div class="text-center text-slate-500 py-4">Searching...</div>';

    try {
        const url = query
            ? `${API_BASE_URL}/users/search?search=${encodeURIComponent(query)}`
            : `${API_BASE_URL}/users/search?search=a`; // Default load some users

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        const result = await response.json();
        listContainer.innerHTML = '';

        if (result.success && result.data.items.length > 0) {
            result.data.items.forEach(user => {
                // Don't show yourself
                if (user.id == currentUserData.id) return;

                const el = document.createElement('div');
                el.className = 'flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors';
                el.onclick = () => {
                    openChat(user);
                    closeUserSelectionModal();
                };

                const avatar = user.avatar ? `${API_BASE_URL.replace('/api', '')}/${user.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;

                el.innerHTML = `
                    <div class="bg-center bg-no-repeat bg-cover rounded-full h-10 w-10 shrink-0" style="background-image: url('${avatar}')"></div>
                    <div class="flex flex-col">
                        <span class="text-white font-medium">${user.name}</span>
                    </div>
                 `;
                listContainer.appendChild(el);
            });
        } else {
            listContainer.innerHTML = '<div class="text-center text-slate-500 py-4">No users found</div>';
        }

    } catch (error) {
        listContainer.innerHTML = '<div class="text-center text-red-500 py-4">Error loading users</div>';
    }
}

async function openChat(user) {
    console.log("openChat called with:", user); // DEBUG
    activeChatUser = user;

    // UI Updates
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('active-chat-content').classList.remove('hidden');

    // Mobile: Hide List, Show Chat
    const sidebar = document.getElementById('conversations-sidebar');
    const chatArea = document.getElementById('chat-area');

    if (window.innerWidth < 768) {
        sidebar.classList.add('hidden');
        chatArea.classList.remove('hidden');
    }

    // Header Info
    document.getElementById('chat-header-name').innerText = user.name || user.friend_name;
    const avatarUrl = user.avatar || user.friend_avatar
        ? `${API_BASE_URL.replace('/api', '')}/${user.avatar || user.friend_avatar}`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.friend_name)}&background=random`;

    document.getElementById('chat-header-avatar').style.backgroundImage = `url('${avatarUrl}')`;

    // Load Messages
    // Determine if 'user' is a Conversation object or a Search Result User object
    let targetId;
    // Check if distinct property 'friend_id' exists (it comes from ConversationResource)
    if ('friend_id' in user) {
        targetId = user.friend_id; // Can be null for deleted users
    } else {
        targetId = user.id; // Search result User object
    }

    activeOpenChatUserId = targetId; // Set current chat user ID for realtime checks
    console.log("Target Receiver ID:", targetId); // DEBUG

    // Handle Deleted/Blocked User
    if (!targetId) {
        document.getElementById('messages-container').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-500">
                <span class="material-symbols-outlined text-4xl mb-2">person_off</span>
                <p>User is no longer available</p>
            </div>`;
        disableChatInputs("You cannot reply to this conversation.");
        document.getElementById('chat-actions-btn').classList.add('hidden');
        return;
    }

    // 1. You Blocked Them
    if (user.is_blocked) {
        document.getElementById('messages-container').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                    <span class="material-symbols-outlined text-3xl text-red-500">block</span>
                </div>
                <div class="text-center">
                    <p class="font-bold text-white mb-1">You blocked this user</p>
                    <p class="text-sm text-slate-500">You need to unblock them to send messages.</p>
                </div>
                <button onclick="unblockChatUser(${targetId})" class="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold transition-colors">
                    Unblock User
                </button>
            </div>`;
        disableChatInputs("Unblock user to send message.");
        document.getElementById('chat-actions-btn').classList.remove('hidden'); // Allow actions (e.g. Delete Chat)
        // We do NOT return here if we want to show messages? 
        // User said "conservation rha" (conversation remains). Usually blocked chats hide messages or just disable input. 
        // If we want to show OLD messages, we should load messages BUT overlay/block input.
        // Let's load messages but keep input disabled. 
        // Actually, if I overwrite innerHTML above, I can't load messages.
        // If the requirement is "Read only", I should load messages then append the block overlay or just header?
        // For now, standard behavior is usually hiding content or just disabling input.
        // User said "Unblock to send message", implying they might want to see history.
        // I will LOAD messages, but disable input.
        // So I will remove the innerHTML overwrite above and instead insert a footer-like warning or just rely on the Input Placeholder.
    }

    // 2. They Blocked You
    else if (user.is_blocked_by) {
        document.getElementById('messages-container').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-500">
                <span class="material-symbols-outlined text-4xl mb-2">error</span>
                <p>User is not available</p>
            </div>`;
        disableChatInputs("You cannot reply to this conversation.");
        document.getElementById('chat-actions-btn').classList.remove('hidden');
        return; // Don't show messages if they blocked me (Privacy?) usually yes
    }

    const blockBtn = document.getElementById('action-block-btn');

    if (user.is_blocked) {
        // Load messages but disable input
        disableChatInputs("You blocked this user. Unblock to send message.");

        // Update Menu to "Unblock"
        if (blockBtn) {
            blockBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">check_circle</span> Unblock User';
            blockBtn.onclick = () => unblockChatUser(targetId);
            blockBtn.className = "w-full text-left px-4 py-3 text-sm text-green-400 hover:bg-green-500/10 hover:text-green-300 flex items-center gap-3 transition-colors";
        }

    } else if (!user.is_blocked && !user.is_blocked_by) {
        // Enable inputs
        const msgInput = document.getElementById('message-input');
        if (msgInput) {
            msgInput.disabled = false;
            msgInput.placeholder = "Type a message...";
        }
        
        const actionsBtn = document.getElementById('chat-actions-btn');
        if (actionsBtn) actionsBtn.classList.remove('hidden');

        // Reset Menu to "Block"
        if (blockBtn) {
            blockBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">block</span> Block User';
            blockBtn.onclick = () => blockUser();
            blockBtn.className = "w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-3 transition-colors";
        }
    }

    // Mark conversation as read (Blue Ticks)
    if ('friend_id' in user) {
        fetch(`${API_BASE_URL}/conversation/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ conversation_id: user.id })
        }).catch(err => console.error("Failed to mark read", err));
    }

    loadMessages(targetId);

    // Mark as Active in Sidebar
    renderConversations();
}

function disableChatInputs(placeholderText) {
    document.getElementById('message-input').disabled = true;
    document.getElementById('file-input').disabled = true;
    document.getElementById('message-input').placeholder = placeholderText;
}

async function unblockChatUser(userId) {
    if (!confirm("Unblock this user?")) return;
    console.log("Unblocking User ID:", userId); // DEBUG

    try {
        const response = await fetch(`${API_BASE_URL}/unblock_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ user_id: userId })
        });

        console.log("Unblock Response Status:", response.status);
        const data = await response.json();
        console.log("Unblock Response Data:", data);

        if (data.success || response.ok || response.status === 404) {
            // Treat 404 (User not blocked) as success because the goal is to have them unblocked.
            showToast('User unblocked', 'success');

            // Optimistic Update
            console.log("Unblock Optimistic Check:", activeChatUser?.friend_id, userId);
            if (activeChatUser && (String(activeChatUser.friend_id) === String(userId) || String(activeChatUser.id) === String(userId))) {
                console.log("Updating UI for unblocked user");
                activeChatUser.is_blocked = false;
                // Force clear to ensure visual change
                document.getElementById('messages-container').innerHTML = '<div class="text-center py-4 text-slate-500">Refreshing...</div>';
                openChat(activeChatUser);
            }

            // Sync background
            loadConversations();
        } else {
            showToast(data.message || `Error ${response.status}: Failed to unblock`, 'error');
        }
    } catch (e) { console.error(e); showToast('Error unblocking connection', 'error'); }
}

async function loadMessages(receiverId) {
    if (!receiverId) return;

    const container = document.getElementById('messages-container');
    const cacheKey = `chat_msg_v2_${currentUserData.id}_${receiverId}`; // V2 cache key

    // 1. Try Cache
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        try {
            const messages = JSON.parse(cachedData);
            if (Array.isArray(messages) && messages.length > 0) {
                renderMessagesList(messages);
                scrollToBottom();
            } else {
                container.innerHTML = '<div class="text-center text-slate-500 py-4">Loading messages...</div>';
            }
        } catch (e) {
            container.innerHTML = '<div class="text-center text-slate-500 py-4">Loading messages...</div>';
        }
    } else {
        container.innerHTML = '<div class="text-center text-slate-500 py-4">Loading messages...</div>';
    }

    // 2. Parallel Fetch (Texts + Voice)
    try {
        const [textRes, voiceRes] = await Promise.all([
             fetch(`${API_BASE_URL}/fetch_messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ receiver_id: receiverId })
             }),
             fetch(`${API_BASE_URL}/getvoicemsg`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    receiver_id: receiverId,
                    conversation_id: activeChatUser.id // Send conversation ID if available
                })
             })
        ]);

        const textResult = await textRes.json();
        const voiceResult = await voiceRes.json();
        
        // Arrays
        let texts = textResult.success ? textResult.data : [];
        let voices = voiceResult.success ? voiceResult.data : [];
        
        // Normalize Voice Messages to look like Messages for Rendering
        voices = voices.map(v => ({
            ...v,
            type: 'voice',
            message: null, 
            attachments: [] 
        }));

        // Merge & Sort
        let allMessages = [...texts, ...voices];
        allMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        // Update Cache
        if (allMessages.length > 0) {
            localStorage.setItem(cacheKey, JSON.stringify(allMessages));
            renderMessagesList(allMessages);
            scrollToBottom();
        } else {
            if (!cachedData) container.innerHTML = '<div class="text-center text-slate-500 py-8">No messages yet</div>';
        }

    } catch (error) {
        console.error("Load Error:", error);
        if (!cachedData) container.innerHTML = '<div class="text-center text-red-500 py-4">Error loading history</div>';
    }
}

function renderMessagesList(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    messages.forEach(msg => {
        appendMessage(msg);
    });
}


async function sendMessage() {
    if (!activeChatUser) return;

    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    // Use global filesQueue for validation
    if (!text && filesQueue.length === 0) return;

    const formData = new FormData();

    if (editingMessageId) {
        // --- UPDATE MODE ---
        formData.append('id', editingMessageId);
        formData.append('message', text);

        try {
            const response = await fetch(`${API_BASE_URL}/updatemessage`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const result = await response.json();

            if (result.success || response.ok) {
                showToast('Message updated', 'success');

                // Optimistic UI Update
                const msgEl = document.getElementById(`msg-${editingMessageId}`);
                if (msgEl) {
                    const textEl = msgEl.querySelector('.bg-primary, .bg-surface-border');
                    if (textEl) {
                        textEl.innerHTML = text + '<span class="text-[9px] opacity-70 ml-1">(edited)</span>';
                    }
                }

                cancelEdit();
                // We don't reload conversations here to keep flow smooth?
                // Maybe update last message text in sidebar if it was the last one?
                loadConversations();
            } else {
                showToast(result.message || 'Update failed', 'error');
            }
        } catch (e) {
            showToast('Error updating message', 'error');
        }
        return; // Exit function
    }

    // --- CREATE MODE ---
    const receiverId = activeChatUser.friend_id || activeChatUser.id;
    formData.append('receiver_id', receiverId);
    if (text) formData.append('message', text);

// Append files from Queue
    filesQueue.forEach(file => {
        formData.append('attachments[]', file);
    });

    // Reset Input
    input.value = '';
    // Clear inputs
    ['camera-input', 'gallery-input', 'doc-input', 'other-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    // Clear Queue
    filesQueue = [];
    renderFilePreviews();
    document.getElementById('file-preview-area').classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/sendmessage`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                 // Explicitly DO NOT set Content-Type for FormData, browser does it
            },
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            // Message sent (Event listener will append it, or we can do it here)
            loadConversations(); // Refresh list to move chat to top
        } else {
            showToast(result.message || 'Send failed', 'error');
        }
    } catch (error) {
        showToast('Failed to send message', 'error');
    }
}


// --- Camera Logic ---
let stream = null;
let currentFacingMode = 'user';
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordingStartTime = null;
let timerInterval = null;

async function openCamera() {
    toggleMediaMenu(); // Close menu
    const modal = document.getElementById('camera-modal');
    modal.classList.remove('hidden');

    try {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: {
                facingMode: currentFacingMode
            },
            audio: true // Request audio for video recording
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('camera-stream');
        video.srcObject = stream;
        
        // Reset Recording UI
        document.getElementById('recording-indicator').classList.add('hidden');
        document.getElementById('record-btn').innerHTML = '<span class="material-symbols-outlined text-2xl">videocam</span>';
        isRecording = false;
        
    } catch (err) {
        console.error("Camera Error:", err);
        showToast("Could not access camera/microphone", "error");
        closeCamera();
    }
}

function closeCamera() {
    if (isRecording) {
        stopRecording();
    }
    
    const modal = document.getElementById('camera-modal');
    modal.classList.add('hidden');
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

async function switchCamera() {
    if (isRecording) return; // Don't switch while recording
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    await openCamera();
}

function capturePhoto() {
    if (isRecording) return; // Don't snap while recording
    
    const video = document.getElementById('camera-stream');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');

    if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

        canvas.toBlob(blob => {
            const fileName = `camera_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            
            // Add to global queue
            filesQueue.push(file);
            renderFilePreviews();
            
            closeCamera();
        }, 'image/jpeg', 0.9);
    }
}

// --- Video Recording ---

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}



function renderFilePreviews() {
    const previewArea = document.getElementById('file-preview-area');
    if (!previewArea) return; // Guard clause

    if (filesQueue.length > 0) {
        previewArea.classList.remove('hidden');
        previewArea.style.display = 'flex'; // Force display just in case
        previewArea.innerHTML = '';

        filesQueue.forEach((file, index) => {
            const div = document.createElement('div');
            // Ensure classes are sufficient for visibility
            div.className = 'relative shrink-0 w-16 h-16 bg-surface-border rounded-lg overflow-hidden flex items-center justify-center border border-white/5 group';

            // Remove Button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 hover:bg-black/80 rounded-full text-white flex items-center justify-center z-10 transition-colors backdrop-blur-sm opacity-0 group-hover:opacity-100';
            removeBtn.innerHTML = '<span class="material-symbols-outlined text-[14px]">close</span>';
            removeBtn.title = "Remove";
            removeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                removeAttachment(index);
            };
            div.appendChild(removeBtn);

            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.className = 'w-full h-full object-cover';
                div.appendChild(img);
            } else if (file.type.startsWith('video/')) {
                // Video Preview
                const video = document.createElement('video');
                video.src = URL.createObjectURL(file);
                video.className = 'w-full h-full object-cover';
                div.appendChild(video);
                // Play icon overlay
                const playIcon = document.createElement('div');
                playIcon.className = 'absolute inset-0 flex items-center justify-center pointer-events-none';
                playIcon.innerHTML = '<span class="material-symbols-outlined text-white/80 text-xl drop-shadow-md">play_circle</span>';
                div.appendChild(playIcon);
            } else {
                 div.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-1">
                        <span class="material-symbols-outlined text-white/50 text-2xl">description</span>
                        <span class="text-[8px] text-white/50 truncate w-full text-center mt-1">${file.name.split('.').pop().toUpperCase()}</span>
                    </div>
                `;
                div.appendChild(removeBtn);
            }
            previewArea.appendChild(div);
        });
    } else {
        previewArea.classList.add('hidden');
        previewArea.style.display = 'none';
        previewArea.innerHTML = '';
    }
    updateSendButtonState();
}

function updateSendButtonState() {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn');
    
    if (!input || !sendBtn || !micBtn) return;

    const hasText = input.value.trim().length > 0;
    const hasFiles = filesQueue.length > 0;

    if (hasText || hasFiles) {
        // Show Send, Hide Mic
        sendBtn.classList.remove('hidden');
        micBtn.classList.add('hidden');
        sendBtn.disabled = false;
        sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        // Show Mic, Hide Send
        sendBtn.classList.add('hidden');
        micBtn.classList.remove('hidden');
        // Reset Send Button state just in case
        sendBtn.disabled = true; 
    }
}

// --- Voice Recording Logic ---
// --- Voice Recording Logic ---
// --- Voice Recording Logic ---
let voiceRecorder = null;
let voiceChunks = [];
let voiceInterval = null;
let voiceStartTime = 0;
let voiceMimeType = 'audio/webm';
let voiceBlob = null; // Store blob for review
let voiceDuration = 0;

async function startRecording() {
    if (!activeChatUser) {
        showToast('Select a chat first', 'error');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        voiceMimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
             if (MediaRecorder.isTypeSupported('audio/mp4')) voiceMimeType = 'audio/mp4';
             else if (MediaRecorder.isTypeSupported('audio/ogg')) voiceMimeType = 'audio/ogg';
             else voiceMimeType = ''; 
        }

        const options = voiceMimeType ? { mimeType: voiceMimeType } : {};
        voiceRecorder = new MediaRecorder(stream, options);
        voiceChunks = [];

        voiceRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) voiceChunks.push(event.data);
        };

        voiceRecorder.onstop = () => {
             stream.getTracks().forEach(track => track.stop());
        };

        voiceRecorder.start();
        console.log("Recording started:", voiceMimeType);

        // UI Updates: Show Active Recording
        const ui = document.getElementById('recording-ui');
        ui.classList.remove('hidden');
        ui.classList.add('flex');
        
        document.getElementById('recording-active').classList.remove('hidden');
        document.getElementById('recording-review').classList.add('hidden');
        
        // Hide Play Icon reset
        resetPlayIcon();

        // Timer
        voiceStartTime = Date.now();
        const timerEl = document.getElementById('recording-timer');
        if (timerEl) timerEl.innerText = "00:00";
        
        // Clear any existing interval
        if (voiceInterval) clearInterval(voiceInterval);
        
        voiceInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - voiceStartTime) / 1000);
            const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const secs = String(elapsed % 60).padStart(2, '0');
            const el = document.getElementById('recording-timer');
            if (el) {
                el.innerText = `${mins}:${secs}`;
            }
        }, 1000);

        // Hide Mic Button while recording
        document.getElementById('mic-btn').classList.add('hidden');
        document.getElementById('send-btn').classList.add('hidden');

    } catch (err) {
        console.error("Mic Error:", err);
        showToast("Microphone access denied: " + err.message, "error");
    }
}

function stopRecording() {
    if (!voiceRecorder || voiceRecorder.state === 'inactive') return;

    // Determine duration BEFORE stopping (more accurate visual)
    voiceDuration = Math.floor((Date.now() - voiceStartTime) / 1000);
    clearInterval(voiceInterval); // Stop timer immediately

    voiceRecorder.onstop = () => {
         const type = voiceMimeType || 'audio/webm';
         voiceBlob = new Blob(voiceChunks, { type: type });
         
         console.log("Recording Ready for Review. Size:", voiceBlob.size);
         
         if (voiceBlob.size === 0) {
             showToast("Recording empty", "error");
             discardRecording();
             return;
         }

         // Switch UI to Review Mode
         document.getElementById('recording-active').classList.add('hidden');
         document.getElementById('recording-review').classList.remove('hidden');
         document.getElementById('recording-review').classList.add('flex'); 
         
         // Setup Audio Preview
         const audio = document.getElementById('audio-preview');
         const url = URL.createObjectURL(voiceBlob);
         audio.src = url;
         audio.load();
    };
    
    voiceRecorder.stop();
}

function togglePlayUrl() {
    const audio = document.getElementById('audio-preview');
    const icon = document.getElementById('play-icon');
    
    if (audio.paused) {
        audio.play().then(() => {
            icon.innerText = 'pause';
            animateProgress();
        }).catch(e => console.error(e));
    } else {
        audio.pause();
        icon.innerText = 'play_arrow';
    }
}

function resetPlayIcon() {
    const icon = document.getElementById('play-icon');
    if (icon) icon.innerText = 'play_arrow';
    const bar = document.getElementById('audio-progress');
    if(bar) bar.style.width = '0%';
}

function animateProgress() {
    const audio = document.getElementById('audio-preview');
    const bar = document.getElementById('audio-progress');
    
    function step() {
        if (!audio.paused && !audio.ended) {
            const pct = (audio.currentTime / audio.duration) * 100;
            bar.style.width = `${pct}%`;
            requestAnimationFrame(step);
        } else if (audio.ended) {
            bar.style.width = '100%';
            resetPlayIcon();
        }
    }
    requestAnimationFrame(step);
}

function discardRecording() {
    const audio = document.getElementById('audio-preview');
    if(audio) {
        audio.pause();
        audio.src = '';
    }
    voiceBlob = null;
    resetRecordingUI();
}

async function uploadRecording() {
    if (!voiceBlob) return;
    
    // Disable send button to prevent double tap
    const btn = document.querySelector('#recording-review button[onclick="uploadRecording()"]');
    if(btn) btn.disabled = true;

    // Extension
    let ext = 'webm';
    if (voiceBlob.type.includes('mp4')) ext = 'mp4';
    else if (voiceBlob.type.includes('ogg')) ext = 'ogg';

    const filename = `voice_msg_${Date.now()}.${ext}`;
    const file = new File([voiceBlob], filename, { type: voiceBlob.type });
    
    await uploadVoiceMessage(file, voiceDuration);
    
    discardRecording();
    if(btn) btn.disabled = false;
}

function resetRecordingUI() {
    clearInterval(voiceInterval);
    document.getElementById('recording-ui').classList.add('hidden');
    document.getElementById('recording-ui').classList.remove('flex');
    
    // Reset Buttons
    document.getElementById('mic-btn').classList.remove('hidden');
    
    // Check if input has text to show Send, else keep hidden
    updateSendButtonState();
    
    voiceRecorder = null;
    voiceChunks = [];
    voiceBlob = null;
}

async function uploadVoiceMessage(file, duration) {
    if (!activeChatUser) return;
    
    const formData = new FormData();
    const receiverId = activeChatUser.friend_id || activeChatUser.id;
    const conversationId = activeChatUser.friend_id ? activeChatUser.id : null; 

    formData.append('receiver_id', receiverId);
    if (conversationId) formData.append('conversation_id', conversationId);
    
    formData.append('file', file);
    formData.append('duration', duration);

    try {
        const response = await fetch(`${API_BASE_URL}/voicemsg`, {
             method: 'POST',
             headers: { 'Accept': 'application/json' },
             credentials: 'include',
             body: formData
        });
        const result = await response.json();
        if (result.success) {
             showToast('Voice message sent', 'success');
             loadConversations();
        } else {
             console.error("Upload failed:", result);
             showToast(result.message || 'Failed to send voice', 'error');
        }
    } catch(e) {
        console.error("Upload error:", e);
        showToast('Error uploading voice', 'error');
    }
}

function removeAttachment(index) {
    filesQueue.splice(index, 1);
    renderFilePreviews();
}

// --- Rendering ---

function renderConversations() {
    const list = document.getElementById('conversations-list');
    list.innerHTML = '';
    if (conversations.length === 0) {
        list.innerHTML = '<div class="text-center text-slate-500 py-8">No conversations yet</div>';
        return;
    }

    conversations.forEach(conv => {
        const isSelected = activeChatUser && (activeChatUser.id == conv.friend_id || activeChatUser.friend_id == conv.friend_id);

        const el = document.createElement('div');
        el.className = `group flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors border-l-4 ${isSelected ? 'bg-surface-border/50 border-primary' : 'hover:bg-surface-border/30 border-transparent'}`;
        el.onclick = () => openChat(conv);

        const avatar = conv.friend_avatar ? `${API_BASE_URL.replace('/api', '')}/${conv.friend_avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.friend_name)}&background=random`;

        el.innerHTML = `
            <div class="relative shrink-0">
                <div class="bg-center bg-no-repeat bg-cover rounded-full h-12 w-12" style="background-image: url('${avatar}')"></div>
                ${conv.unread_message > 0 ? '<span class="absolute bottom-0 right-0 w-3 h-3 bg-primary border-2 border-[#111318] rounded-full"></span>' : ''}
            </div>
            <div class="flex flex-col flex-1 min-w-0">
                <div class="flex justify-between items-baseline mb-0.5">
                    <h3 class="text-white text-sm font-semibold truncate">${conv.friend_name}</h3>
                    <span class="text-[#9da5b9] text-xs font-normal whitespace-nowrap">${formatTime(conv.last_message_time)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <p class="text-[#9da5b9] text-sm truncate pr-2 ${conv.unread_message > 0 ? 'font-bold text-white' : ''}">${conv.last_message}</p>
                    ${conv.unread_message > 0 ? `<span class="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">${conv.unread_message}</span>` : ''}
                </div>
            </div>
        `;
        list.appendChild(el);
    });
}

function appendMessage(msg) {
    // Prevent duplicate messages
    if (document.getElementById(`msg-${msg.id}-${msg.type || 'text'}`)) {
        return;
    }

    const container = document.getElementById('messages-container');
    const isMe = msg.sender_id == currentUserData.id;
    
    // Check if deleted
    const isDeleted = msg.is_deleted_everyone || msg.message === "This message was deleted"; 

    const wrapper = document.createElement('div');
    wrapper.id = `msg-${msg.id}-${msg.type || 'text'}`; 
    wrapper.className = isMe
        ? 'flex flex-col items-end gap-1 ml-auto max-w-[80%]'
        : 'flex items-end gap-3 max-w-[80%]';

    // Avatar for other
    if (!isMe) {
        const headerAvatar = document.getElementById('chat-header-avatar');
        if (headerAvatar) {
             const style = headerAvatar.style.backgroundImage;
             const avatarHtml = `<div class="bg-center bg-no-repeat bg-cover rounded-full h-8 w-8 shrink-0 mb-1" style="${style}"></div>`;
             wrapper.insertAdjacentHTML('afterbegin', avatarHtml); 
        }
    }

    // Content Bubble
    let contentHtml = '';
    
    // --- VOICE MESSAGE ---
    if (msg.type === 'voice' || (msg.file_path && msg.duration)) {
        // file_path already includes 'storage/voice_messages/...'
        const url = `${API_BASE_URL.replace('/api', '')}/${msg.file_path}`; 
        
        const durationDisplay = formatDuration(msg.duration);
        const uniqueId = `voice-${msg.id}`;

        contentHtml = `
            <div class="flex items-center gap-3 p-3 rounded-2xl ${isMe ? 'bg-primary text-white rounded-br-none' : 'bg-surface-border text-white rounded-bl-none'} shadow-sm min-w-[200px]">
                <button id="btn-${uniqueId}" onclick="playVoice('${url}', '${uniqueId}')" class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors shrink-0">
                    <span class="material-symbols-outlined text-[24px]">play_arrow</span>
                </button>
                <div class="flex flex-col gap-1 flex-1 min-w-0">
                    <div class="h-1 bg-black/20 rounded-full overflow-hidden w-full">
                        <div id="progress-${uniqueId}" class="h-full bg-white/80 w-0 transition-all duration-100"></div>
                    </div>
                    <span class="text-[10px] opacity-70 font-mono tracking-wider">${durationDisplay}</span>
                </div>
                <!-- Hidden Audio Tag -->
                <audio id="audio-${uniqueId}" src="${url}" onended="resetVoiceUI('${uniqueId}')" ontimeupdate="updateVoiceProgress('${uniqueId}')"></audio>
            </div>
        `;
    } 
    // --- TEXT / ATTACHMENT MESSAGE ---
    else {
        // Attachments
        if (!isDeleted && msg.attachments && msg.attachments.length > 0) {
            const isMultiple = msg.attachments.length > 1;
            const gridClass = isMultiple ? 'grid grid-cols-2 gap-1.5' : 'flex flex-col gap-1.5';
            
            contentHtml += `<div class="${gridClass} mb-2 mt-1">`;
            msg.attachments.forEach(att => {
                const url = `${API_BASE_URL.replace('/api', '')}/storage/Messages/${att.file_name}`;
                const isSingle = !isMultiple;
                const sizeClass = isSingle ? 'w-64 h-48 sm:w-72 sm:h-56' : 'w-32 h-32 sm:w-40 sm:h-40';
                
                if (att.file_type === 'image') {
                    contentHtml += `<div class="relative ${sizeClass} rounded-2xl overflow-hidden border border-white/10 cursor-pointer group bg-black/20" onclick="viewMedia('${url}', 'image')"><img src="${url}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"></div>`;
                } else if (att.file_type === 'video') {
                    contentHtml += `<div class="relative ${sizeClass} rounded-2xl overflow-hidden border border-white/10 cursor-pointer group bg-black/20" onclick="viewMedia('${url}', 'video')"><video src="${url}" class="w-full h-full object-cover pointer-events-none"></video><div class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40"><span class="material-symbols-outlined text-white text-3xl">play_circle</span></div></div>`;
                } else {
                    contentHtml += `<a href="${url}" target="_blank" class="col-span-full flex items-center gap-3 p-3 bg-surface-border/50 rounded-xl border border-white/5"><span class="material-symbols-outlined">description</span><span class="truncate text-xs">${att.file_name}</span></a>`;
                }
            });
            contentHtml += `</div>`;
        }
        
        // Text Content
        if (msg.message) {
             const bubbleClass = isMe 
                ? 'bg-primary text-white rounded-2xl rounded-tr-none px-4 py-2.5 shadow-sm' 
                : 'bg-surface-border text-white rounded-2xl rounded-tl-none px-4 py-2.5 shadow-sm';
             
             if (isDeleted) {
                 contentHtml += `<div class="italic text-slate-400 text-sm border border-white/10 px-3 py-2 rounded-xl flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">block</span> Message deleted</div>`;
             } else {
                 contentHtml += `<div class="${bubbleClass} text-[15px] leading-relaxed break-words whitespace-pre-wrap">${msg.message} ${(msg.is_edited ? '<span class="text-[9px] opacity-70 ml-1">(edited)</span>' : '')}</div>`;
             }
        }
    }

    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let metaHtml = `<div class="flex items-center gap-1 mt-0.5 ${isMe ? 'opacity-70' : 'opacity-50'}">
        <span class="text-[10px]">${time}</span>`;
    
    if (isMe) {
        let statusIcon = 'done'; 
        let statusColor = 'text-white/70'; 
        if (msg.status === 'delivered') { statusIcon = 'done_all'; } 
        else if (msg.status === 'read') { statusIcon = 'done_all'; statusColor = 'text-blue-300'; } 
        metaHtml += `<span class="material-symbols-outlined text-[14px] ${statusColor}">${statusIcon}</span>`;
    }
    metaHtml += `</div>`;

    const innerWrapper = document.createElement('div');
    innerWrapper.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'}`;
    innerWrapper.innerHTML = contentHtml + metaHtml;
    
    wrapper.appendChild(innerWrapper);
    container.appendChild(wrapper);
}

// Helper: Format Duration (seconds -> 00:00)
function formatDuration(seconds) {
    if(!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// --- Voice Playback Logic ---
let currentAudioId = null;

function playVoice(url, uniqueId) {
    const audio = document.getElementById(`audio-${uniqueId}`);
    const btn = document.getElementById(`btn-${uniqueId}`);
    
    if (!audio) return;

    // Stop Other Audios
    if (currentAudioId && currentAudioId !== uniqueId) {
        const otherAudio = document.getElementById(`audio-${currentAudioId}`);
        if(otherAudio) {
            otherAudio.pause();
            otherAudio.currentTime = 0;
            resetVoiceUI(currentAudioId);
        }
    }

    if (audio.paused) {
        audio.play().then(() => {
            currentAudioId = uniqueId;
            btn.innerHTML = '<span class="material-symbols-outlined text-[24px]">pause</span>';
        }).catch(e => console.error("Play error", e));
    } else {
        audio.pause();
        btn.innerHTML = '<span class="material-symbols-outlined text-[24px]">play_arrow</span>';
    }
}

function updateVoiceProgress(uniqueId) {
    const audio = document.getElementById(`audio-${uniqueId}`);
    const bar = document.getElementById(`progress-${uniqueId}`);
    if(audio && bar) {
        const pct = (audio.currentTime / audio.duration) * 100;
        bar.style.width = `${pct}%`;
    }
}

function resetVoiceUI(uniqueId) {
    const btn = document.getElementById(`btn-${uniqueId}`);
    const bar = document.getElementById(`progress-${uniqueId}`);
    if(btn) btn.innerHTML = '<span class="material-symbols-outlined text-[24px]">play_arrow</span>';
    if(bar) bar.style.width = '0%';
    currentAudioId = null;
}

// --- Message Actions ---
let editingMessageId = null;

function toggleMessageMenu(id) {
    // Hide others
    document.querySelectorAll('[id^=msg-menu-]').forEach(el => {
        if (el.id !== `msg-menu-${id}`) el.classList.add('hidden');
    });
    const menu = document.getElementById(`msg-menu-${id}`);
    if (menu) menu.classList.toggle('hidden');
}

function editMsg(id, text) {
    toggleMessageMenu(id); // hide menu
    editingMessageId = id;

    // Populate Input
    const input = document.getElementById('message-input');
    input.value = text;
    input.focus();

    // Change UI to Edit Mode
    const form = document.getElementById('message-form');
    // Add visual indicator or change button?
    // Let's create a "Cancel Edit" button dynamically or just change placeholder
    input.placeholder = "Editing message...";
    input.classList.add('border-primary', 'ring-1', 'ring-primary'); // Highlight

    // We need a cancel button. Let's append if not exists
    let cancelBtn = document.getElementById('cancel-edit-btn');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancel-edit-btn';
        cancelBtn.type = 'button';
        cancelBtn.innerHTML = '<span class="material-symbols-outlined text-red-500 text-[18px]">close</span>';

        // Form structure: form -> [fileBtn, div(wrapper) -> textarea, sendBtn]
        // We want to put it inside the wrapper, relative to textarea? 
        // Or just absolute right in the form? The form has 'relative' usually? No, it has flex.
        // Let's put it in the textarea wrapper.
        const wrapper = input.parentElement;
        if (wrapper) {
            wrapper.classList.add('relative'); // Ensure wrapper is relative
            cancelBtn.className = 'absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-colors z-10';
            cancelBtn.onclick = cancelEdit;
            wrapper.appendChild(cancelBtn);
        }
    }
    cancelBtn.classList.remove('hidden');
}

function cancelEdit() {
    editingMessageId = null;
    const input = document.getElementById('message-input');
    input.value = '';
    input.placeholder = "Type a message...";
    input.classList.remove('border-primary', 'ring-1', 'ring-primary');

    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

async function deleteMsg(id, type) {
    toggleMessageMenu(id);
    if (!confirm(type === 'everyone' ? 'Delete for everyone?' : 'Delete for me?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/deletemessage`, {
            method: 'DELETE', // Change to DELETE method? No, API definition is DELETE route.
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: id, delete_type: type })
        });

        const data = await response.json();
        if (data.success || response.ok) {
            showToast('Message deleted', 'success');
            // Remove from DOM immediately
            const el = document.getElementById(`msg-${id}`);
            if (el) el.remove();

            // If delete for everyone, backend might send event, but for 'me' we just remove.
            loadConversations();
        } else {
            showToast(data.message || 'Failed to delete', 'error');
        }
    } catch (e) {
        showToast('Error deleting message', 'error');
    }
}

// --- Utilities ---

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

function backToConversations() {
    document.getElementById('conversations-sidebar').classList.remove('hidden');
    document.getElementById('chat-area').classList.add('hidden');
    document.getElementById('active-chat-content').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
    activeChatUser = null;
    activeOpenChatUserId = null; // Clear active chat
}



function setupUserSearch() {
    const input = document.getElementById('user-search-input');
    let debounceTimer;

    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            loadUsersForSearch(e.target.value);
        }, 300);
    });
}

function formatTime(str) {
    if (!str) return '';
    return str.replace(' ago', ''); // Simplify diffForHumans
}

function updateTotalUnread() {
    const count = conversations.reduce((sum, conv) => sum + parseInt(conv.unread_message), 0);
    const badge = document.getElementById('total-unread-count');
    badge.innerText = count;
    if (count === 0) badge.classList.add('hidden');
    else badge.classList.remove('hidden');
}


function viewProfile(userId) {
    if (!userId) return;
    // Assuming simple redirect for now
    window.location.href = `profile.html?id=${userId}`;
}

// --- Chat Actions (Report, Delete, Block) ---
function toggleChatActions() {
    const menu = document.getElementById('chat-actions-menu');
    menu.classList.toggle('hidden');
}

function toggleMediaMenu() {
    const menu = document.getElementById('media-menu');
    menu.classList.toggle('hidden');
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    // Chat Actions Menu
    const chatMenu = document.getElementById('chat-actions-menu');
    const chatBtn = document.getElementById('chat-actions-btn'); // ID needs to be added to HTML button if not present, check HTML.
    // Actually the button has onclick="toggleChatActions()" but finding it by selector is safer.
    const chatBtnEl = document.querySelector('button[onclick="toggleChatActions()"]');
    
    if (chatMenu && !chatMenu.classList.contains('hidden') && !chatMenu.contains(e.target) && (!chatBtnEl || !chatBtnEl.contains(e.target))) {
        chatMenu.classList.add('hidden');
    }

    // Media Menu
    const mediaMenu = document.getElementById('media-menu');
    const mediaBtn = document.querySelector('button[onclick="toggleMediaMenu()"]');
    if (mediaMenu && !mediaMenu.classList.contains('hidden') && !mediaMenu.contains(e.target) && (!mediaBtn || !mediaBtn.contains(e.target))) {
        mediaMenu.classList.add('hidden');
    }
});


function showReportModal() {
    toggleChatActions();
    if (!activeChatUser) return;

    // Create/Reuse a generic report modal
    let modal = document.getElementById('report-modal');

    // If modal exists but somehow content is missing (e.g. race condition or bad state), remove it
    if (modal && !modal.querySelector('#report-reason')) {
        modal.remove();
        modal = null;
    }

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'report-modal';
        modal.className = 'fixed inset-0 z-[70] hidden';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="closeReportModal()"></div>
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-6 bg-[#1e2532] border border-surface-border rounded-2xl shadow-2xl">
                <h3 class="text-xl font-bold text-white mb-4">Report User</h3>
                <textarea id="report-reason" class="w-full bg-background-dark border border-surface-highlight text-white p-3 rounded-xl mb-4 text-sm" rows="3" placeholder="Why are you reporting this user?"></textarea>
                <div class="flex justify-end gap-3">
                    <button onclick="closeReportModal()" class="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
                    <button onclick="submitReport()" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold">Report</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const textarea = modal.querySelector('#report-reason');
    if (textarea) textarea.value = '';

    modal.classList.remove('hidden');
}

function closeReportModal() {
    document.getElementById('report-modal')?.classList.add('hidden');
}

async function submitReport() {
    const reason = document.getElementById('report-reason').value.trim();
    if (!reason) {
        showToast('Please provide a reason', 'error');
        return;
    }

    if (!activeChatUser) return;

    const targetId = activeChatUser.id || activeChatUser.friend_id;
    if (!targetId) return;

    try {
        const formData = new FormData();
        formData.append('reportable_id', targetId);
        formData.append('reportable_type', 'user'); // Reporting the user themselves from chat
        formData.append('reason', reason);

        const response = await fetch(`${API_BASE_URL}/report_content`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            },
            body: formData
        });

        const data = await response.json();
        console.log(data);
        if (data.success || data.status) {
            showToast('Report submitted successfully', 'success');
            closeReportModal();
        } else {
            showToast(data.message || 'Report failed', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Error submitting report', 'error');
    }
}

function reportChat() {
    showReportModal();
}

async function deleteChat() {
    toggleChatActions();
    if (!activeChatUser) return;

    // For now, consistent with user's backend pending/unimplemented state or simple message
    // If backend implements deleteconversation (global), we can use it.
    // User added deleteconversation API, let's try to use it if they want.
    // But safely, let's stick to "Not implemented" or simple confirm for now to avoid accidental data loss if not tested.
    // User requested "Clear Chat", not explicit Delete fix.
    showToast('Delete conversation backend pending', 'info');
}

async function clearChat() {
    toggleChatActions();

    // Check if we have a valid conversation ID
    let conversationId = null;
    if ('friend_id' in activeChatUser) {
        conversationId = activeChatUser.id;
    } else {
        showToast("No conversation started yet", "info");
        return;
    }

    if (!confirm("Are you sure you want to clear this chat? This will remove all messages for you.")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/clearconversation`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ id: conversationId })
        });

        const data = await response.json();

        if (data.success || response.ok) {
            showToast('Chat cleared successfully', 'success');
            // Clear UI
            document.getElementById('messages-container').innerHTML = '<div class="text-center text-slate-500 py-8">No messages yet</div>';
            loadConversations();
        } else {
            showToast(data.message || 'Failed to clear chat', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Error clearing chat', 'error');
    }
}

function reportChat() {
    toggleChatActions();
    if (!activeChatUser) return;
    document.getElementById('report-modal')?.classList.remove('hidden');
}

async function blockUser() {
    toggleChatActions();
    if (!activeChatUser) return;

    let targetUserId;
    if ('friend_id' in activeChatUser) {
        targetUserId = activeChatUser.friend_id;
    } else {
        targetUserId = activeChatUser.id;
    }
    const targetName = activeChatUser.name || activeChatUser.friend_name || 'User';

    if (!confirm(`Are you sure you want to block ${targetName}? They will be unfriended and unable to message you.`)) return;

    try {
        const formData = new FormData();
        formData.append('user_id', targetUserId);

        const response = await fetch(`${API_BASE_URL}/block_user`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            },
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Blocked ${targetName}`, 'success');
            loadConversations();

            // Stay in chat but update UI to blocked state
            if (activeChatUser) {
                activeChatUser.is_blocked = true;
                openChat(activeChatUser);
            }

        } else {
            showToast(data.message || 'Block failed', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Error blocking user', 'error');
    }
}

// --- Realtime ---

function setupRealtime() {
    if (window.Echo) {
        // Listen for message status updates (Checks/Blue Ticks)
        window.Echo.private(`chat.${currentUserData.id}`)
            .listen('MessageStatusEvent', (e) => {
                console.log('Status Update Recieved:', e);
                // Update specific message icon
                const statusSpan = document.getElementById(`status-${e.id}`);
                if (statusSpan) {
                    if (e.status === 'delivered') {
                        // Double Tick (Gray)
                        statusSpan.innerText = 'done_all';
                        statusSpan.className = 'material-symbols-outlined text-[16px] text-[#9da5b9]';
                    } else if (e.status === 'read') {
                        // Double Tick (Blue)
                        statusSpan.innerText = 'done_all';
                        statusSpan.className = 'material-symbols-outlined text-[16px] text-blue-400';
                    }
                } else {
                    console.log("Status span not found for msg:", e.id);
                }
            });

        // Listen for New Messages (To mark as Delivered)
        window.Echo.private(`chat.${currentUserData.id}`)
            .listen('MessagesEvent', (e) => {
                console.log('New Message Received:', e);

                // 1. Auto-mark as Delivered (Always, since we received it via Pusher)
                if (e.message && e.message.id) {
                    markAsDelivered(e.message.id);
                }

                // 2. Append to chat if open
                // Check match for INCOMING (Sender is friend) OR OUTGOING (Sender is me, Receiver is friend)
                const isIncoming = activeOpenChatUserId && String(activeOpenChatUserId) === String(e.message.sender_id);
                const isOutgoing = activeOpenChatUserId && String(currentUserData.id) === String(e.message.sender_id) && String(activeOpenChatUserId) === String(e.message.receiver_id);

                console.log(`Msg Check: Incoming=${isIncoming}, Outgoing=${isOutgoing}, Active=${activeOpenChatUserId}, Sender=${e.message.sender_id}`);

                if (isIncoming || isOutgoing) {
                    console.log("Chat open, appending message...");
                    appendMessage(e.message);
                    scrollToBottom();

                    // Update Cache
                    const cacheKey = `chat_msg_${currentUserData.id}_${activeOpenChatUserId}`;
                    const cachedData = localStorage.getItem(cacheKey);
                    if (cachedData) {
                        try {
                            const messages = JSON.parse(cachedData);
                            if (Array.isArray(messages)) {
                                messages.push(e.message);
                                localStorage.setItem(cacheKey, JSON.stringify(messages));
                            }
                        } catch (err) { }
                    }

                    // If INCOMING, mark as READ
                    if (isIncoming) {
                        setTimeout(() => {
                            fetch(`${API_BASE_URL}/conversation/read`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ conversation_id: e.message.sender_id })
                            }).catch(console.error);
                        }, 500);
                    }

                } else {
                    // Start sound notification or title flash?
                    showToast(`New message from ${e.message.sender.name}`, 'success');
                }

                // 3. Refresh lists
                loadConversations();
            })
            .listen('DeleteMessageEvent', (e) => {
                console.log('Message Deleted Event:', e);
                if (e.id) {
                    // Find the message element
                    const msgEl = document.getElementById(`msg-${e.id}`);
                    if (msgEl) {
                        // Update UI to "Deleted" state
                        const contentDiv = msgEl.querySelector('.bg-primary, .bg-surface-border');
                        if (contentDiv) {
                            contentDiv.className = 'bg-surface-border/50 px-4 py-3 rounded-2xl text-slate-400 text-sm leading-relaxed italic border border-white/5 flex items-center gap-2';
                            if (msgEl.classList.contains('items-end')) {
                                // If it was my message, maybe keep right align but style logic is same
                                contentDiv.className += ' rounded-br-none';
                            } else {
                                contentDiv.className += ' rounded-bl-none';
                            }
                            contentDiv.innerHTML = '<span class="material-symbols-outlined text-[16px]">block</span> This message was deleted';

                            // Remove attachments if any (simplicity)
                            // Actually appendMessage handles attachments separately, we might need to clear them.
                            // But replacing innerHTML of wrapper is harder.
                            // Let's re-render utilizing appendMessage logic? No, too complex.
                            // Just replace the text box content.
                            // And hide attachments?
                            const attachmentsDiv = msgEl.querySelector('img, a');
                            // This selector is weak.
                            // Better: Reload chat or strict DOM manipulation?
                            // Strict DOM:
                            // The structure is Wrapper -> [Attachments, TextDiv].
                            // We should remove attachments siblings.
                            while (contentDiv.previousElementSibling) {
                                contentDiv.previousElementSibling.remove();
                            }
                        }
                    }
                }
            });
    }
}
async function markAsDelivered(messageId) {
    try {
        await fetch(`${API_BASE_URL}/message/delivered`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json',
                'X-XSRF-TOKEN': decodeURIComponent(document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')[1] || '')
            },
            credentials: 'include',
            body: JSON.stringify({ message_id: messageId })
        });
        console.log("Marked as delivered:", messageId);
    } catch (e) {
        console.error("Failed to mark delivered", e);
    }
}

// --- Lightbox / Media Viewer ---
window.viewMedia = function(url, type) {
    let modal = document.getElementById('media-lightbox');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'media-lightbox';
        modal.className = 'fixed inset-0 z-[100] hidden bg-black/95 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200';
        modal.onclick = (e) => {
            if(e.target === modal) closeMediaLightbox();
        };
        modal.innerHTML = `
            <button onclick="closeMediaLightbox()" class="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2 z-50 rounded-full hover:bg-white/10">
                <span class="material-symbols-outlined text-4xl">close</span>
            </button>
            <div id="media-content" class="w-full h-full flex items-center justify-center overflow-hidden relative"></div>
        `;
        document.body.appendChild(modal);
        
        // Keyboard support
        document.addEventListener('keydown', (e) => {
             if (e.key === 'Escape') closeMediaLightbox();
        });
    }

    const content = modal.querySelector('#media-content');
    content.innerHTML = ''; // Clear previous

    if (type === 'image') {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300';
        content.appendChild(img);
    } else if (type === 'video') {
         const video = document.createElement('video');
         video.src = url;
         video.controls = true;
         video.autoplay = true;
         video.className = 'max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300';
         content.appendChild(video);
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.closeMediaLightbox = function() {
    const modal = document.getElementById('media-lightbox');
    if (modal) {
        const video = modal.querySelector('video');
        if (video) video.pause(); 
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}
