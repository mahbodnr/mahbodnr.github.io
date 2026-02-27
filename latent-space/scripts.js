// Latent Space - Puzzle System Scripts

const SUPABASE_URL = 'https://begtzhbfsvntrqaxjmah.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZ3R6aGJmc3ZudHJxYXhqbWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTI1MTAsImV4cCI6MjA4NDY2ODUxMH0.5W2khGK3va9a6cjM5jrsNhfPrzlrAjqAmzcjegy_47U';

let supabaseClient = null;
let supabaseConfigured = false;
let currentSession = null;
let authInitialized = false;
let authInitPromise = null;

try {
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded');
    } else if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
        console.error('Supabase anon key not configured');
    } else {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            },
            realtime: {
                params: {
                    eventsPerSecond: 2
                }
            }
        });
        supabaseConfigured = true;
        
        // Set up auth state listener for subsequent changes
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            currentSession = session;
            
            // Ensure user exists in database for SIGNED_IN events
            if (event === 'SIGNED_IN' && session && typeof ensureUserExists === 'function') {
                try {
                    await ensureUserExists(session.user);
                } catch (e) {
                    console.error('Error ensuring user exists:', e);
                }
            }
            
            if (authInitialized && typeof updateAuthUI === 'function') {
                try {
                    updateAuthUI();
                } catch (e) {
                    console.error('Error in auth state handler:', e);
                }
            }
        });
        
        // Initialize auth state immediately via getSession (doesn't wait for listener)
        authInitPromise = (async () => {
            try {
                const { data: { session }, error } = await supabaseClient.auth.getSession();
                if (error) console.error('Error getting session:', error);
                currentSession = session;
                authInitialized = true;
                return session;
            } catch (e) {
                console.error('Error in auth init:', e);
                authInitialized = true;
                return null;
            }
        })();
    }
} catch (e) {
    console.error('Error initializing Supabase:', e);
    supabaseConfigured = false;
}

// Helper to wait for auth to be ready
async function waitForAuth() {
    if (authInitialized) return currentSession;
    if (authInitPromise) {
        return await authInitPromise;
    }
    return null;
}

// ============== Authentication ==============

async function getCurrentUser() {
    if (!supabaseConfigured || !supabaseClient) return null;
    
    try {
        const session = await waitForAuth();
        if (!session) return null;
        return session.user;
    } catch (e) {
        console.error('Error in getCurrentUser:', e);
        return null;
    }
}

async function signInWithGoogle(redirectUrl) {
    if (!supabaseConfigured || !supabaseClient) {
        showMessage('Authentication not configured. Please contact the site administrator.', 'error');
        return;
    }
    
    const redirectTo = redirectUrl || (window.location.origin + '/latent-space/');
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo
            }
        });
        
        if (error) {
            console.error('Error signing in:', error);
            showMessage('Error signing in: ' + error.message, 'error');
        }
    } catch (e) {
        console.error('Error in signInWithGoogle:', e);
        showMessage('Error signing in. Please try again.', 'error');
    }
}

async function signOut() {
    if (!supabaseConfigured || !supabaseClient) return;
    
    try {
        await supabaseClient.auth.signOut();
    } catch (e) {
        console.error('Error in signOut:', e);
    }
    window.location.href = '/latent-space/';
}

// Auth state listener is now set up during initialization (above)

async function ensureUserExists(user) {
    if (!user || !supabaseConfigured) return;
    
    try {
        const token = currentSession?.access_token || SUPABASE_ANON_KEY;
        
        // Use RPC function to bypass RLS timing issues during OAuth
        const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/ensure_user_exists', {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                p_user_id: user.id,
                p_email: user.email,
                p_username: user.user_metadata?.full_name || user.email.split('@')[0],
                p_avatar_url: user.user_metadata?.avatar_url || null
            })
        });
        
        if (!response.ok) {
            console.error('Error ensuring user exists:', response.status);
            return;
        }
        
        const data = await response.json();
        if (data && !data.success) {
            console.error('Error ensuring user exists:', data.error);
        }
    } catch (e) {
        console.error('Error in ensureUserExists:', e);
    }
}

async function updateUsername(newUsername) {
    const user = await getCurrentUser();
    if (!user || !supabaseConfigured) {
        showMessage('Please log in to change your name.', 'error');
        return false;
    }
    
    const trimmedName = newUsername.trim();
    if (!trimmedName || trimmedName.length < 2) {
        showMessage('Name must be at least 2 characters.', 'error');
        return false;
    }
    if (trimmedName.length > 50) {
        showMessage('Name must be less than 50 characters.', 'error');
        return false;
    }
    
    try {
        const token = currentSession?.access_token || SUPABASE_ANON_KEY;
        
        const response = await fetch(
            SUPABASE_URL + '/rest/v1/users?id=eq.' + user.id,
            {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ username: trimmedName })
            }
        );
        
        if (!response.ok) {
            console.error('Error updating username:', response.status);
            showMessage('Error updating name. Please try again.', 'error');
            return false;
        }
        
        showMessage('Name updated successfully!', 'success');
        return true;
    } catch (e) {
        console.error('Error in updateUsername:', e);
        showMessage('Error updating name. Please try again.', 'error');
        return false;
    }
}

function showEditNameDialog() {
    const currentName = document.querySelector('.user-name')?.textContent || '';
    
    const dialog = document.createElement('div');
    dialog.className = 'edit-name-dialog';
    dialog.innerHTML = `
        <div class="edit-name-content windows-box-shadow">
            <div class="edit-name-header">
                <span>✏️ Edit Display Name</span>
                <button class="close-btn" onclick="this.closest('.edit-name-dialog').remove()">×</button>
            </div>
            <div class="edit-name-body">
                <label for="new-username">Display Name:</label>
                <input type="text" id="new-username" class="win-input inverse-windows-box-shadow" value="${escapeHtml(currentName)}" maxlength="50">
                <div class="edit-name-buttons">
                    <button class="win-button windows-box-shadow" onclick="this.closest('.edit-name-dialog').remove()">Cancel</button>
                    <button class="win-button windows-box-shadow primary" onclick="saveNewUsername()">Save</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    const input = dialog.querySelector('#new-username');
    input.focus();
    input.select();
    
    // Handle Enter key
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveNewUsername();
        if (e.key === 'Escape') dialog.remove();
    });
}

async function saveNewUsername() {
    const input = document.querySelector('#new-username');
    if (!input) return;
    
    const newName = input.value;
    const success = await updateUsername(newName);
    
    if (success) {
        // Update all displayed user names
        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = newName;
        });
        document.querySelector('.edit-name-dialog')?.remove();
    }
}

function showEditAvatarDialog() {
    const currentAvatar = document.querySelector('.user-avatar')?.src || '';
    
    const dialog = document.createElement('div');
    dialog.className = 'edit-avatar-dialog';
    dialog.innerHTML = `
        <div class="edit-avatar-content windows-box-shadow">
            <div class="edit-avatar-header">
                <span>🖼️ Change Profile Picture</span>
                <button class="close-btn" onclick="this.closest('.edit-avatar-dialog').remove()">×</button>
            </div>
            <div class="edit-avatar-body">
                <div class="avatar-preview-container">
                    <img src="${escapeHtml(currentAvatar)}" alt="Current avatar" class="avatar-preview" id="avatar-preview">
                </div>
                <label for="avatar-file" class="win-button windows-box-shadow avatar-upload-btn">
                    📁 Choose Image...
                </label>
                <input type="file" id="avatar-file" accept="image/*" style="display: none;">
                <p class="avatar-hint">Max size: 1MB. Square images work best.</p>
                <div id="avatar-upload-status"></div>
                <div class="edit-avatar-buttons">
                    <button class="win-button windows-box-shadow" onclick="this.closest('.edit-avatar-dialog').remove()">Cancel</button>
                    <button class="win-button windows-box-shadow primary" id="save-avatar-btn" disabled onclick="saveNewAvatar()">Save</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    const fileInput = dialog.querySelector('#avatar-file');
    const preview = dialog.querySelector('#avatar-preview');
    const saveBtn = dialog.querySelector('#save-avatar-btn');
    const status = dialog.querySelector('#avatar-upload-status');
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 1024 * 1024) {
            status.innerHTML = '<span style="color: red;">Image too large. Max 1MB.</span>';
            saveBtn.disabled = true;
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            status.innerHTML = '<span style="color: red;">Please select an image file.</span>';
            saveBtn.disabled = true;
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            saveBtn.disabled = false;
            status.innerHTML = '<span style="color: green;">Image ready to upload.</span>';
        };
        reader.readAsDataURL(file);
    });
    
    dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dialog.remove();
    });
}

async function saveNewAvatar() {
    const fileInput = document.querySelector('#avatar-file');
    const saveBtn = document.querySelector('#save-avatar-btn');
    const status = document.querySelector('#avatar-upload-status');
    
    if (!fileInput || !fileInput.files[0]) return;
    
    const user = await getCurrentUser();
    if (!user) {
        showMessage('Please log in to change your avatar.', 'error');
        return;
    }
    
    // Get the current session to ensure we have a valid token
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
        showMessage('Session expired. Please log in again.', 'error');
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Uploading...';
    status.innerHTML = '<span>Uploading image...</span>';
    
    try {
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop().toLowerCase();
        // Use timestamp to ensure unique filename
        const fileName = `${user.id}/avatar_${Date.now()}.${fileExt}`;
        
        // Try to delete old avatar first (ignore errors)
        const { data: existingFiles } = await supabaseClient.storage
            .from('avatars')
            .list(user.id);
        
        if (existingFiles && existingFiles.length > 0) {
            const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
            await supabaseClient.storage.from('avatars').remove(filesToDelete);
        }
        
        // Upload using fetch with explicit auth header
        const formData = new FormData();
        formData.append('', file);
        
        const uploadResponse = await fetch(
            `${SUPABASE_URL}/storage/v1/object/avatars/${fileName}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_ANON_KEY
                },
                body: file
            }
        );
        
        if (!uploadResponse.ok) {
            const errData = await uploadResponse.json().catch(() => ({}));
            throw new Error(errData.message || `Upload failed: ${uploadResponse.status}`);
        }
        
        // Get the public URL
        const avatarUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
        
        // Update user profile using RPC function (bypasses RLS issues)
        const updateResponse = await fetch(SUPABASE_URL + '/rest/v1/rpc/update_user_avatar', {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + session.access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ p_user_id: user.id, p_avatar_url: avatarUrl })
        });
        
        if (!updateResponse.ok) {
            throw new Error('Failed to update profile: ' + updateResponse.status);
        }
        
        const updateData = await updateResponse.json();
        
        if (updateData && !updateData.success) {
            throw new Error(updateData.error || 'Failed to update profile');
        }
        
        // Update displayed avatars
        document.querySelectorAll('.user-avatar').forEach(el => {
            el.src = avatarUrl;
        });
        
        showMessage('Profile picture updated!', 'success');
        document.querySelector('.edit-avatar-dialog')?.remove();
    } catch (e) {
        console.error('Error uploading avatar:', e);
        status.innerHTML = `<span style="color: red;">Error: ${escapeHtml(e.message || 'Upload failed')}</span>`;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

async function fetchUserProfile(userId) {
    if (!supabaseConfigured) return null;
    
    try {
        const token = currentSession?.access_token || SUPABASE_ANON_KEY;
        const response = await fetch(
            SUPABASE_URL + '/rest/v1/users?select=username,avatar_url&id=eq.' + userId,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + token,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            }
        );
        
        if (!response.ok) return null;
        
        const data = await response.json();
        return data?.[0] || null;
    } catch (e) {
        return null;
    }
}

async function updateAuthUI() {
    const user = await getCurrentUser();
    const authButtons = document.querySelectorAll('.auth-buttons');
    const userInfos = document.querySelectorAll('.user-info-display');
    const requiresAuth = document.querySelectorAll('.requires-auth');
    const hideWhenAuth = document.querySelectorAll('.hide-when-auth');
    const submitButtons = document.querySelectorAll('.submit-auth-btn');
    const loginSubmitButtons = document.querySelectorAll('.login-submit-btn');
    
    if (user) {
        // Fetch custom username and avatar from database
        const profile = await fetchUserProfile(user.id);
        const displayName = profile?.username || user.user_metadata?.full_name || user.email;
        const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || '';
        
        authButtons.forEach(el => el.classList.add('hidden'));
        userInfos.forEach(el => {
            el.classList.remove('hidden');
            const nameEl = el.querySelector('.user-name');
            const avatarEl = el.querySelector('.user-avatar');
            if (nameEl) nameEl.textContent = displayName;
            if (avatarEl && avatarUrl) {
                avatarEl.src = avatarUrl;
            }
        });
        requiresAuth.forEach(el => el.classList.remove('hidden'));
        hideWhenAuth.forEach(el => el.classList.add('hidden'));

        submitButtons.forEach(btn => {
            btn.classList.remove('hidden');
            btn.disabled = false;
        });
        loginSubmitButtons.forEach(btn => btn.classList.add('hidden'));
    } else {
        authButtons.forEach(el => el.classList.remove('hidden'));
        userInfos.forEach(el => el.classList.add('hidden'));
        requiresAuth.forEach(el => el.classList.add('hidden'));
        hideWhenAuth.forEach(el => el.classList.remove('hidden'));

        submitButtons.forEach(btn => {
            btn.classList.add('hidden');
            btn.disabled = true;
        });
        loginSubmitButtons.forEach(btn => btn.classList.remove('hidden'));
    }
}

// ============== Puzzles ==============

async function fetchPuzzles() {
    if (!supabaseConfigured) return [];
    
    try {
        const rpcResponse = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_puzzles_list', {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: '{}'
        });
        
        if (rpcResponse.ok) {
            const data = await rpcResponse.json() || [];
            return data.sort((a, b) => a.id - b.id);
        }
        
        // Fallback: direct query (only shows released puzzles due to RLS)
        const response = await fetch(SUPABASE_URL + '/rest/v1/puzzles?select=id,title,release_time,base_points&order=id.asc', {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            }
        });
        
        if (!response.ok) return [];
        const data = await response.json() || [];
        return data.sort((a, b) => a.id - b.id);
    } catch (e) {
        console.error('Error in fetchPuzzles:', e);
        return [];
    }
}

async function fetchPuzzle(puzzleId) {
    try {
        const response = await fetch(SUPABASE_URL + '/rest/v1/puzzles?select=*&id=eq.' + puzzleId, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            }
        });
        
        if (!response.ok) {
            console.error('Error fetching puzzle:', response.status);
            return null;
        }
        
        const data = await response.json();
        return data?.[0] || null;
    } catch (e) {
        console.error('Error fetching puzzle:', e);
        return null;
    }
}

async function fetchHints(puzzleId) {
    try {
        const now = new Date().toISOString();
        const response = await fetch(
            SUPABASE_URL + '/rest/v1/hints?select=*&puzzle_id=eq.' + puzzleId + '&release_time=lte.' + encodeURIComponent(now) + '&order=release_time.asc', 
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
                }
            }
        );
        
        if (!response.ok) {
            console.error('Error fetching hints:', response.status);
            return [];
        }
        
        const data = await response.json();
        return data || [];
    } catch (e) {
        console.error('Error fetching hints:', e);
        return [];
    }
}

async function fetchAllHintsCount(puzzleId) {
    try {
        const response = await fetch(
            SUPABASE_URL + '/rest/v1/hints?select=id&puzzle_id=eq.' + puzzleId, 
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                    'Prefer': 'count=exact'
                }
            }
        );
        
        if (!response.ok) {
            console.error('Error counting hints:', response.status);
            return 0;
        }
        
        const contentRange = response.headers.get('content-range');
        if (contentRange) {
            const match = contentRange.match(/\/(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        }
        
        const data = await response.json();
        return data?.length || 0;
    } catch (e) {
        console.error('Error counting hints:', e);
        return 0;
    }
}

async function fetchUpcomingHint(puzzleId) {
    try {
        const response = await fetch(
            SUPABASE_URL + '/rest/v1/rpc/get_next_hint_release',
            {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ p_puzzle_id: puzzleId })
            }
        );
        
        if (!response.ok) {
            console.error('Error fetching upcoming hint (RPC):', response.status);
            return null;
        }
        
        const data = await response.json();
        if (!data) return null;
        if (Array.isArray(data)) {
            return data[0] || null;
        }
        return data;
    } catch (e) {
        console.error('Error fetching upcoming hint (RPC):', e);
        return null;
    }
}

// --------------- Superhint: fetch/record reads (authenticated only) ---------------
async function fetchSuperhintReads(hintIds) {
    if (!supabaseConfigured || !supabaseClient || !hintIds || hintIds.length === 0) return new Set();
    try {
        const session = await waitForAuth();
        if (!session) return new Set();
        const { data, error } = await supabaseClient
            .from('superhint_reads')
            .select('hint_id')
            .in('hint_id', hintIds);
        if (error) {
            console.error('Error fetching superhint reads:', error);
            return new Set();
        }
        return new Set((data || []).map(r => r.hint_id));
    } catch (e) {
        console.error('Error in fetchSuperhintReads:', e);
        return new Set();
    }
}

async function recordSuperhintRead(hintId) {
    if (!supabaseConfigured || !supabaseClient) return false;
    try {
        const session = await waitForAuth();
        if (!session) return false;
        const { error } = await supabaseClient
            .from('superhint_reads')
            .insert({ user_id: session.user.id, hint_id: hintId });
        if (error) {
            console.error('Error recording superhint read:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error in recordSuperhintRead:', e);
        return false;
    }
}

function showSuperhintDialog(options) {
    const { signedIn, onSeeHint, onSignIn } = options || {};
    const dialog = document.createElement('div');
    dialog.className = 'superhint-dialog edit-name-dialog';
    const message = 'This is a superhint and may reveal significant information about the puzzle. We recommend trying to solve it on your own first.';
    const secondButton = signedIn
        ? '<button class="win-button windows-box-shadow primary" id="superhint-see-btn">See the hint</button>'
        : '<button class="win-button windows-box-shadow primary" id="superhint-signin-btn">Sign in to see the hint</button>';
    dialog.innerHTML = `
        <div class="edit-name-content windows-box-shadow superhint-dialog-content">
            <div class="edit-name-header">
                <span>Superhint</span>
                <button class="close-btn" id="superhint-dialog-close">×</button>
            </div>
            <div class="edit-name-body">
                <div class="superhint-dialog-message-container">
                    <img src="/img/msg_warning-0.png" alt="Warning" class="superhint-warning-icon">
                    <p class="superhint-dialog-message">${escapeHtml(message)}</p>
                </div>
                <div class="edit-name-buttons">
                    <button class="win-button windows-box-shadow" id="superhint-cancel-btn">Cancel</button>
                    ${secondButton}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    const close = () => {
        if (dialog.parentNode) dialog.remove();
    };
    dialog.querySelector('#superhint-cancel-btn').addEventListener('click', close);
    dialog.querySelector('#superhint-dialog-close').addEventListener('click', close);
    if (signedIn && typeof onSeeHint === 'function') {
        dialog.querySelector('#superhint-see-btn').addEventListener('click', () => {
            close();
            setTimeout(() => onSeeHint(), 0);
        });
    } else if (!signedIn && typeof onSignIn === 'function') {
        dialog.querySelector('#superhint-signin-btn').addEventListener('click', () => {
            close();
            onSignIn();
        });
    }
    dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });
}

function revealSuperhintContent(index) {
    const content = document.getElementById('hint-content-' + index);
    const button = document.getElementById('hint-toggle-' + index);
    const header = button?.closest('.hint-header');
    if (!content || !button || !header) return;
    const hint = window.currentHints && window.currentHints[index];
    if (hint && hint.hint_text) {
        content.innerHTML = hint.hint_text;
        content.classList.remove('hidden');
        button.textContent = '▼';
        // From now on, header toggles like a normal hint
        header.setAttribute('onclick', `toggleHint(${index})`);
    }
}

async function handleSuperhintClick(index, hintId) {
    const content = document.getElementById('hint-content-' + index);
    const hasPlaceholder = content && content.querySelector('.hint-superhint-placeholder');
    
    // If already open and has real content, toggle closed
    if (content && !content.classList.contains('hidden') && !hasPlaceholder) {
        if (typeof toggleHint === 'function') toggleHint(index);
        return;
    }
    
    const user = await getCurrentUser();
    const readIds = window.superhintReadIds || new Set();

    if (!user) {
        showSuperhintDialog({ signedIn: false, onSignIn: () => signInWithGoogle(window.location.href) });
        return;
    }
    
    // If already read and content has hint text (not placeholder), just toggle open
    if (readIds.has(hintId) && !hasPlaceholder) {
        if (typeof toggleHint === 'function') {
            toggleHint(index);
            // Set onclick to toggleHint for future clicks
            const header = content?.closest('.hint-header');
            if (header) header.setAttribute('onclick', `toggleHint(${index})`);
        }
        return;
    }
    
    if (!readIds.has(hintId)) {
        showSuperhintDialog({
            signedIn: true,
            onSeeHint: async () => {
                await recordSuperhintRead(hintId);
                if (!window.superhintReadIds) window.superhintReadIds = new Set();
                window.superhintReadIds.add(hintId);
                revealSuperhintContent(index);
            }
        });
        return;
    }
    revealSuperhintContent(index);
}

// ============== Rate Limiting & Anti-Bot (Google reCAPTCHA v3) ==============

// reCAPTCHA v3 site key - runs invisibly in the background
const RECAPTCHA_SITE_KEY = '6LdNOVUsAAAAAH_dUEx28ECJ1soJYvo8rI9BRJJD';

const rateLimitState = {
    attempts: [],           // Array of timestamps
    captchaRequired: false,
    maxAttemptsBeforeCaptcha: 3,
    timeWindowMs: 60000     // 1 minute window
};

function recordAttempt() {
    const now = Date.now();
    rateLimitState.attempts.push(now);
    
    // Clean up old attempts outside the time window
    rateLimitState.attempts = rateLimitState.attempts.filter(
        timestamp => now - timestamp < rateLimitState.timeWindowMs
    );
    
    // Check if captcha is needed
    if (rateLimitState.attempts.length >= rateLimitState.maxAttemptsBeforeCaptcha) {
        rateLimitState.captchaRequired = true;
    }
}

function isCaptchaRequired() {
    const now = Date.now();
    // Clean up old attempts
    rateLimitState.attempts = rateLimitState.attempts.filter(
        timestamp => now - timestamp < rateLimitState.timeWindowMs
    );
    return rateLimitState.captchaRequired && rateLimitState.attempts.length >= rateLimitState.maxAttemptsBeforeCaptcha;
}

async function executeRecaptchaV3() {
    // reCAPTCHA v3 runs invisibly - show a brief loading dialog
    const dialog = document.createElement('div');
    dialog.className = 'captcha-dialog';
    dialog.innerHTML = `
        <div class="captcha-content windows-box-shadow">
            <div class="captcha-header">
                <span>🤖 Verification Required</span>
            </div>
            <div class="captcha-body">
                <p style="margin-bottom: 12px;">Too many attempts! Verifying you're human...</p>
                <div id="recaptcha-status" style="text-align: center; padding: 20px;">
                    <span style="font-size: 24px;">⏳</span>
                    <p style="margin-top: 8px;">Please wait...</p>
                </div>
                <div id="captcha-error" style="color: red; font-size: 11px; margin-top: 8px; display: none;"></div>
                <div class="captcha-buttons" id="captcha-buttons-container" style="display: none;">
                    <button class="win-button windows-box-shadow" id="captcha-cancel-btn">Cancel</button>
                    <button class="win-button windows-box-shadow primary" id="captcha-retry-btn">Retry</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    const errorEl = dialog.querySelector('#captcha-error');
    const statusEl = dialog.querySelector('#recaptcha-status');
    const buttonsContainer = dialog.querySelector('#captcha-buttons-container');
    
    function showError(message) {
        statusEl.innerHTML = '<span style="font-size: 24px;">❌</span>';
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        buttonsContainer.style.display = 'flex';
    }
    
    return new Promise((resolve) => {
        async function attemptVerification() {
            statusEl.innerHTML = '<span style="font-size: 24px;">⏳</span><p style="margin-top: 8px;">Please wait...</p>';
            errorEl.style.display = 'none';
            buttonsContainer.style.display = 'none';
            
            if (!window.grecaptcha || !window.grecaptcha.execute) {
                showError('Verification system not loaded. Please refresh the page.');
                return;
            }
            
            try {
                const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit_answer' });
                
                if (token) {
                    // Success - v3 returns a token which ideally should be verified server-side
                    // For client-side only, getting a token indicates the check passed
                    statusEl.innerHTML = '<span style="font-size: 24px;">✅</span><p style="margin-top: 8px;">Verified!</p>';
                    
                    // Clear the captcha requirement and reset attempts
                    rateLimitState.captchaRequired = false;
                    rateLimitState.attempts = [];
                    
                    setTimeout(() => {
                        dialog.remove();
                        resolve(true);
                    }, 500);
                } else {
                    showError('Verification failed. Please try again.');
                }
            } catch (e) {
                console.error('reCAPTCHA error:', e);
                showError('Verification error. Please try again.');
            }
        }
        
        // Set up button handlers after dialog is in DOM
        setTimeout(() => {
            const cancelBtn = dialog.querySelector('#captcha-cancel-btn');
            const retryBtn = dialog.querySelector('#captcha-retry-btn');
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    dialog.remove();
                    resolve(false);
                });
            }
            
            if (retryBtn) {
                retryBtn.addEventListener('click', attemptVerification);
            }
            
            dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    dialog.remove();
                    resolve(false);
                }
            });
        }, 0);
        
        // Start verification
        attemptVerification();
    });
}

// ============== Submissions ==============

async function checkAnswer(puzzleId, answer) {
    const user = await getCurrentUser();
    if (!user) {
        showMessage('Please log in to submit answers.', 'error');
        return null;
    }
    
    const normalizedAnswer = answer.toLowerCase().trim();
    const answerHash = await hashString(normalizedAnswer);
    
    try {
        const token = currentSession?.access_token || SUPABASE_ANON_KEY;
        
        const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/check_answer', {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                p_puzzle_id: puzzleId,
                p_user_id: user.id,
                p_answer_text: normalizedAnswer,
                p_answer_hash: answerHash
            })
        });
        
        if (!response.ok) {
            console.error('Error checking answer:', response.status);
            showMessage('Error submitting answer. Please try again.', 'error');
            return null;
        }
        
        const data = await response.json();
        return data;
    } catch (e) {
        console.error('Error checking answer:', e);
        showMessage('Error submitting answer. Please try again.', 'error');
        return null;
    }
}

async function getUserSubmission(puzzleId) {
    const user = await getCurrentUser();
    if (!user) return null;
    
    try {
        // Get current session for auth token
        const token = currentSession?.access_token || SUPABASE_ANON_KEY;
        
        const response = await fetch(
            SUPABASE_URL + '/rest/v1/submissions?select=*&puzzle_id=eq.' + puzzleId + '&user_id=eq.' + user.id + '&is_correct=eq.true&limit=1',
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + token
                }
            }
        );
        
        if (!response.ok) {
            console.error('Error fetching submission:', response.status);
            return null;
        }
        
        const data = await response.json();
        return data?.[0] || null;
    } catch (e) {
        console.error('Error fetching submission:', e);
        return null;
    }
}

async function getUserAttemptCount(puzzleId) {
    const user = await getCurrentUser();
    if (!user) return 0;
    
    try {
        // Get current session for auth token
        const token = currentSession?.access_token || SUPABASE_ANON_KEY;
        
        const response = await fetch(
            SUPABASE_URL + '/rest/v1/submissions?select=id&puzzle_id=eq.' + puzzleId + '&user_id=eq.' + user.id,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + token
                }
            }
        );
        
        if (!response.ok) {
            console.error('Error fetching attempt count:', response.status);
            return 0;
        }
        
        const data = await response.json();
        return data?.length || 0;
    } catch (e) {
        console.error('Error fetching attempt count:', e);
        return 0;
    }
}

async function updateAttemptCounter(puzzleId) {
    const counterEl = document.getElementById('attempt-counter');
    if (!counterEl) return;
    
    const user = await getCurrentUser();
    if (!user) {
        counterEl.textContent = '';
        return;
    }
    
    const attemptCount = await getUserAttemptCount(puzzleId);
    if (attemptCount > 0) {
        counterEl.textContent = `Attempts: ${attemptCount}`;
    } else {
        counterEl.textContent = '';
    }
}

// ============== Leaderboard ==============

async function fetchLeaderboard() {
    try {
        // Use direct fetch since Supabase client has issues
        const response = await fetch(SUPABASE_URL + '/rest/v1/leaderboard_view?select=*&order=total_points.desc,last_correct_submission_at.asc&limit=100', {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            }
        });
        
        if (!response.ok) {
            console.error('Error fetching leaderboard:', response.status);
            return [];
        }
        
        const data = await response.json();
        return data || [];
    } catch (e) {
        console.error('Error fetching leaderboard:', e);
        return [];
    }
}

async function calculateLeaderboard() {
    const { data, error } = await supabaseClient
        .from('submissions')
        .select(`
            user_id,
            score,
            users!inner(username, avatar_url)
        `)
        .eq('is_correct', true);
    
    if (error) {
        console.error('Error calculating leaderboard:', error);
        return [];
    }
    
    // Aggregate scores by user
    const userScores = {};
    data?.forEach(sub => {
        if (!userScores[sub.user_id]) {
            userScores[sub.user_id] = {
                user_id: sub.user_id,
                username: sub.users.username,
                avatar_url: sub.users.avatar_url,
                total_points: 0,
                puzzles_solved: 0
            };
        }
        userScores[sub.user_id].total_points += sub.score || 0;
        userScores[sub.user_id].puzzles_solved += 1;
    });
    
    return Object.values(userScores).sort((a, b) => b.total_points - a.total_points);
}

// ============== Utility Functions ==============

async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function showMessage(message, type = 'info') {
    const container = document.getElementById('message-container');
    if (!container) return;
    
    container.innerHTML = `<div class="message-box message-${type}">${escapeHtml(message)}</div>`;
    container.classList.remove('hidden');
    
    setTimeout(() => {
        container.classList.add('hidden');
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getPuzzleStatus(puzzle) {
    const now = new Date();
    const releaseTime = new Date(puzzle.release_time);
    
    if (releaseTime > now) {
        return 'upcoming';
    }
    return 'active';
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'active': return 'status-active';
        case 'upcoming': return 'status-upcoming';
        case 'solved': return 'status-solved';
        default: return '';
    }
}

// ============== Page-Specific Functions ==============

// Index Page
async function initIndexPage() {
    loadPuzzleList();
    updateAuthUI();
}

async function loadPuzzleList() {
    const container = document.getElementById('puzzle-list');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading puzzles...</div>';
    
    if (!supabaseConfigured) {
        container.innerHTML = `
            <div class="message-box message-error">
                <strong>⚠️ Configuration Required</strong><br>
                The puzzle system is not fully configured yet.<br><br>
                <small>Administrator: Please update the Supabase anon key in scripts.js and run the database schema.</small>
            </div>
        `;
        return;
    }
    
    try {
        const puzzles = await fetchPuzzles();
        const user = await getCurrentUser();
        
        if (puzzles.length === 0) {
            container.innerHTML = '<p>No puzzles available yet. Check back soon!</p>';
            return;
        }
        
        let html = `
            <table class="win-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Title</th>
                        <th>Release Date</th>
                        <th>Base Points</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (const puzzle of puzzles) {
            const status = getPuzzleStatus(puzzle);
            let userStatus = status;
            
            if (user && status === 'active') {
                const submission = await getUserSubmission(puzzle.id);
                if (submission) {
                    userStatus = 'solved';
                }
            }
            
            const canAccess = status === 'active';
            const puzzlePath = `puzzles/puzzle-${String(puzzle.id).padStart(3, '0')}/`;
            const titleCell = canAccess 
                ? `<a href="${puzzlePath}">${escapeHtml(puzzle.title)}</a>`
                : escapeHtml(puzzle.title);
            
            html += `
                <tr>
                    <td>${puzzle.id}</td>
                    <td>${titleCell}</td>
                    <td>${formatDate(puzzle.release_time)}</td>
                    <td>${puzzle.base_points === 0 ? 'TBA' : puzzle.base_points}</td>
                    <td><span class="status-badge ${getStatusBadgeClass(userStatus)}">${userStatus.toUpperCase()}</span></td>
                </tr>
            `;
        }
        
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (e) {
        console.error('Error loading puzzle list:', e);
        container.innerHTML = `
            <div class="message-box message-error">
                <strong>Error loading puzzles</strong><br>
                ${escapeHtml(e.message || 'Unknown error')}
            </div>
        `;
    }
}

// Puzzle Page
async function initPuzzlePage(puzzleId) {
    loadPuzzle(puzzleId);
    loadHints(puzzleId);
    loadPuzzleLeaderboard(puzzleId);
    updateAuthUI();
    checkExistingSubmission(puzzleId);
    updateAttemptCounter(puzzleId);
    setInterval(() => loadHints(puzzleId), 60000);
}

async function loadPuzzle(puzzleId) {
    const puzzle = await fetchPuzzle(puzzleId);
    if (!puzzle) {
        showMessage('Puzzle not found.', 'error');
        return;
    }
    
    const titleEl = document.getElementById('puzzle-title');
    const titleDisplayEl = document.getElementById('puzzle-title-display');
    const descEl = document.getElementById('puzzle-description');
    const pointsEl = document.getElementById('puzzle-points');
    const releaseEl = document.getElementById('puzzle-release');
    const footerEl = document.querySelector('.window-footer .footer-section');
    
    if (titleEl) titleEl.textContent = puzzle.title;
    if (titleDisplayEl) titleDisplayEl.textContent = puzzle.title;
    if (descEl) descEl.innerHTML = puzzle.description;
    if (pointsEl) pointsEl.textContent = puzzle.base_points;
    if (releaseEl) releaseEl.textContent = formatDate(puzzle.release_time);
    if (footerEl) footerEl.textContent = puzzle.title;
    
    // Update page title
    document.title = `${puzzle.title} | Latent Space`;
    
    // Store puzzle data for scoring
    window.currentPuzzle = puzzle;
}

async function loadHints(puzzleId) {
    const container = document.getElementById('hints-container');
    if (!container) return;
    
    // Clear any existing countdown timer interval
    if (window.nextHintTimerId) {
        clearInterval(window.nextHintTimerId);
        window.nextHintTimerId = null;
    }
    
    const hints = await fetchHints(puzzleId);
    const totalHints = await fetchAllHintsCount(puzzleId);
    const upcomingHint = await fetchUpcomingHint(puzzleId);
    
    window.currentHints = hints;
    window.currentPuzzleId = puzzleId;
    const superhintIds = (hints || []).filter(h => h.superhint).map(h => h.id);
    if (superhintIds.length > 0) {
        const user = await getCurrentUser();
        if (user) {
            window.superhintReadIds = await fetchSuperhintReads(superhintIds);
        } else {
            window.superhintReadIds = new Set();
        }
    } else {
        window.superhintReadIds = new Set();
    }
    
    // Update current score display
    const scoreMultiplier = 1 / Math.pow(2, hints.length);
    const scoreEl = document.getElementById('current-multiplier');
    if (scoreEl && window.currentPuzzle) {
        const currentPoints = Math.floor(window.currentPuzzle.base_points * scoreMultiplier);
        scoreEl.textContent = `${currentPoints} pts (${hints.length} hint${hints.length !== 1 ? 's' : ''} released)`;
    }
    
    if (hints.length === 0 && !upcomingHint) {
        container.innerHTML = '<p style="color: #666; font-style: italic;">No hints available for this puzzle yet.</p>';
        return;
    }
    
    let html = '';
    
    if (hints.length === 0) {
        html += '<p style="color: #666; font-style: italic;">No hints released yet. Check back later!</p>';
    } else {
        hints.forEach((hint, index) => {
            const isSuperhint = !!hint.superhint;
            const cardClass = isSuperhint ? 'hint-card hint-card-superhint' : 'hint-card';
            const label = isSuperhint ? '<span class="hint-superhint-badge">Superhint</span>' : '';
            const headerClick = isSuperhint
                ? `onclick="handleSuperhintClick(${index}, ${hint.id})"`
                : `onclick="toggleHint(${index})"`;
            // Check if superhint was already read - if so, content can be opened without dialog
            const isAlreadyRead = isSuperhint && window.superhintReadIds && window.superhintReadIds.has(hint.id);
            // Superhints always start closed, but if already read, use actual hint text instead of placeholder
            const contentHtml = isSuperhint
                ? (isAlreadyRead ? hint.hint_text : '<span class="hint-superhint-placeholder">Sign in to view this superhint.</span>')
                : hint.hint_text;
            const contentClass = 'hint-content hidden';
            const finalHeaderClick = headerClick;
            const finalButtonText = '▶';
            
            const titlePart = isSuperhint
                ? `<span class="hint-header-left"><strong>Hint ${index + 1}</strong> ${label}</span>`
                : `<strong>Hint ${index + 1}</strong>`;
            html += `
                <div class="${cardClass}">
                    <div class="hint-header" ${finalHeaderClick}>
                        <button class="hint-toggle" id="hint-toggle-${index}">${finalButtonText}</button>
                        ${titlePart}
                        <span class="hint-time">Released: ${formatDate(hint.release_time)}</span>
                    </div>
                    <div class="${contentClass}" id="hint-content-${index}">
                        ${contentHtml}
                    </div>
                </div>
            `;
        });
    }
    
    if (upcomingHint) {
        html += `
            <div class="hint-card hint-locked">
                <div class="hint-header">
                    <button class="hint-toggle">🔒</button>
                    <span id="next-hint-timer" class="hint-timer-inline" style="margin-left: 0;">Next hint in ...</span>
                    <span class="hint-time">Available: ${formatDate(upcomingHint.release_time)}</span>
                </div>
            </div>
        `;
    }
    
    if (totalHints > hints.length + (upcomingHint ? 1 : 0)) {
        const remaining = totalHints - hints.length - (upcomingHint ? 1 : 0);
        html += `<p style="color: #666; font-size: 11px; margin-top: 8px;">+ ${remaining} more hint${remaining !== 1 ? 's' : ''} scheduled</p>`;
    }
    
    container.innerHTML = html;
    
    if (upcomingHint) {
        const timerEl = document.getElementById('next-hint-timer');
        if (timerEl) {
            const releaseTime = new Date(upcomingHint.release_time).getTime();
            
            function formatRemaining(ms) {
                const totalSeconds = Math.max(0, Math.floor(ms / 1000));
                const days = Math.floor(totalSeconds / 86400);
                const hours = Math.floor((totalSeconds % 86400) / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                
                const parts = [];
                if (days > 0) parts.push(days + 'd');
                if (days > 0 || hours > 0) {
                    parts.push(String(hours).padStart(2, '0') + 'h');
                }
                parts.push(String(minutes).padStart(2, '0') + 'm');
                parts.push(String(seconds).padStart(2, '0') + 's');
                return parts.join(' ');
            }
            
            function updateTimer() {
                const now = Date.now();
                const diff = releaseTime - now;
                
                if (diff <= 0) {
                    timerEl.textContent = 'Next hint is unlocking...';
                    clearInterval(window.nextHintTimerId);
                    window.nextHintTimerId = null;
                    // Refresh hints shortly after unlock to show the new hint
                    setTimeout(() => loadHints(puzzleId), 2000);
                    return;
                }
                
                timerEl.textContent = 'Next hint in ' + formatRemaining(diff);
            }
            
            updateTimer();
            window.nextHintTimerId = setInterval(() => {
                if (!document.body.contains(timerEl)) {
                    clearInterval(window.nextHintTimerId);
                    window.nextHintTimerId = null;
                    return;
                }
                updateTimer();
            }, 1000);
        }
    }
}

// Per-puzzle leaderboard (fastest correct submissions)
async function fetchPuzzleLeaderboard(puzzleId) {
    if (!supabaseConfigured) return [];

    try {
        // Fetch submissions via direct REST API
        const subResponse = await fetch(
            SUPABASE_URL + '/rest/v1/submissions?select=user_id,submitted_at&puzzle_id=eq.' + puzzleId + '&is_correct=eq.true&order=submitted_at.asc&limit=10',
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
                }
            }
        );
        
        if (!subResponse.ok) {
            console.error('Error fetching submissions:', subResponse.status);
            return [];
        }
        
        const submissions = await subResponse.json();
        
        // Fetch user data for each submission
        const data = await Promise.all((submissions || []).map(async (sub) => {
            try {
                const userResponse = await fetch(
                    SUPABASE_URL + '/rest/v1/users?select=username,avatar_url&id=eq.' + sub.user_id,
                    {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
                        }
                    }
                );
                
                if (!userResponse.ok) {
                    return { ...sub, users: { username: 'Anonymous', avatar_url: null } };
                }
                
                const users = await userResponse.json();
                return { ...sub, users: users?.[0] || { username: 'Anonymous', avatar_url: null } };
            } catch (e) {
                console.warn(`Could not fetch user ${sub.user_id}:`, e);
                return { ...sub, users: { username: 'Anonymous', avatar_url: null } };
            }
        }));
        
        return data || [];
    } catch (e) {
        console.error('Error in fetchPuzzleLeaderboard:', e);
        return [];
    }
}

async function loadPuzzleLeaderboard(puzzleId) {
    const container = document.getElementById('puzzle-leaderboard');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading leaderboard...</div>';

    if (!supabaseConfigured) {
        container.innerHTML = `
            <div class="message-box message-error">
                <strong>⚠️ Configuration Required</strong><br>
                Leaderboard data is unavailable.
            </div>
        `;
        return;
    }

    try {
        const entries = await fetchPuzzleLeaderboard(puzzleId);
        if (!entries.length) {
            container.innerHTML = '<p style="color: #666; font-style: italic;">No correct submissions yet.</p>';
            return;
        }

        let html = `
            <table class="win-table leaderboard-table">
                <thead>
                    <tr>
                        <th style="width: 60px;">Rank</th>
                        <th>Player</th>
                        <th style="width: 160px;">Solved On</th>
                    </tr>
                </thead>
                <tbody>
        `;

        entries.forEach((entry, index) => {
            const rank = index + 1;
            const username = entry?.users?.username || 'Anonymous';
            const avatarUrl = entry?.users?.avatar_url || '';
            const solvedDate = entry.submitted_at ? formatDate(entry.submitted_at) : '—';
            
            const avatarHtml = avatarUrl 
                ? `<img src="${escapeHtml(avatarUrl)}" alt="" class="leaderboard-avatar">`
                : `<span class="leaderboard-avatar-placeholder">👤</span>`;
            
            html += `
                <tr>
                    <td class="rank-cell">${rank}</td>
                    <td><div class="player-cell">${avatarHtml}<span>${escapeHtml(username)}</span></div></td>
                    <td>${escapeHtml(solvedDate)}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (e) {
        console.error('Error loading puzzle leaderboard:', e);
        container.innerHTML = `
            <div class="message-box message-error">
                <strong>Error loading leaderboard</strong><br>
                ${escapeHtml(e.message || 'Unknown error')}
            </div>
        `;
    }
}

async function checkExistingSubmission(puzzleId) {
    const submission = await getUserSubmission(puzzleId);
    const form = document.getElementById('submission-form');
    const solvedMessage = document.getElementById('solved-message');
    
    if (submission && form && solvedMessage) {
        const attemptCount = await getUserAttemptCount(puzzleId);
        form.classList.add('hidden');
        solvedMessage.classList.remove('hidden');
        solvedMessage.innerHTML = `
            <div class="message-box message-success">
                <h3>✓ Puzzle Solved!</h3>
                <p>You solved this puzzle and earned <strong>${submission.score} points</strong>!</p>
                <p>Total attempts: <strong>${attemptCount}</strong></p>
                <p>Submitted on: ${formatDate(submission.submitted_at)}</p>
            </div>
        `;
        
        // Hide the "📤 Submit Your Answer" heading
        const submitHeading = form.previousElementSibling;
        if (submitHeading && submitHeading.tagName === 'H2') {
            submitHeading.classList.add('hidden');
        }
    }
}

async function submitAnswer(event, puzzleId) {
    event.preventDefault();
    
    const input = document.getElementById('answer-input');
    const submitBtn = document.getElementById('submit-btn');
    
    if (!input || !input.value.trim()) {
        showMessage('Please enter an answer.', 'error');
        return;
    }
    
    // Check if captcha is required due to rate limiting
    if (isCaptchaRequired()) {
        const passed = await executeRecaptchaV3();
        if (!passed) {
            showMessage('Verification cancelled. Please try again.', 'error');
            return;
        }
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Checking...';
    
    const result = await checkAnswer(puzzleId, input.value);
    
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit';
    
    if (result === null) return;
    
    if (result.correct) {
        // Reset rate limit on success
        rateLimitState.attempts = [];
        rateLimitState.captchaRequired = false;
        const attemptCount = await getUserAttemptCount(puzzleId);
        showMessage(`🎉 Correct! You earned ${result.score} points! (Total attempts: ${attemptCount})`, 'success');
        await checkExistingSubmission(puzzleId);
    } else {
        // Record failed attempt for rate limiting
        recordAttempt();
        // Update attempt counter
        await updateAttemptCounter(puzzleId);
        showMessage('❌ Incorrect answer. Try again!', 'error');
    }
    
    input.value = '';
}

// Leaderboard Page
async function initLeaderboardPage() {
    loadLeaderboard();
    updateAuthUI();
}

async function loadLeaderboard() {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading leaderboard...</div>';
    
    // Check if Supabase is configured
    if (!supabaseConfigured) {
        container.innerHTML = `
            <div class="message-box message-error">
                <strong>⚠️ Configuration Required</strong><br>
                The puzzle system is not fully configured yet.<br><br>
                <small>Administrator: Please update the Supabase anon key in scripts.js and run the database schema.</small>
            </div>
        `;
        return;
    }
    
    try {
        const leaderboard = await fetchLeaderboard();
        
        if (leaderboard.length === 0) {
            container.innerHTML = '<p>No entries yet. Be the first to solve a puzzle!</p>';
            return;
        }
        
        let html = `
            <table class="win-table leaderboard-table">
                <thead>
                    <tr>
                        <th style="width: 60px;">Rank</th>
                        <th>Player</th>
                        <th style="width: 100px;">Points</th>
                        <th style="width: 80px;">Solved</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        leaderboard.forEach((entry, index) => {
            const rank = index + 1;
            let rankClass = '';
            let rankIcon = rank;
            
            if (rank === 1) { rankClass = 'rank-gold'; rankIcon = '🥇'; }
            else if (rank === 2) { rankClass = 'rank-silver'; rankIcon = '🥈'; }
            else if (rank === 3) { rankClass = 'rank-bronze'; rankIcon = '🥉'; }
            
            const avatarHtml = entry.avatar_url 
                ? `<img src="${escapeHtml(entry.avatar_url)}" alt="" class="leaderboard-avatar">`
                : `<span class="leaderboard-avatar-placeholder">👤</span>`;
            
            html += `
                <tr class="${rankClass}">
                    <td class="rank-cell">${rankIcon}</td>
                    <td><div class="player-cell">${avatarHtml}<span>${escapeHtml(entry.username || 'Anonymous')}</span></div></td>
                    <td class="points-cell"><strong>${entry.total_points.toLocaleString()}</strong></td>
                    <td class="solved-cell">${entry.puzzles_solved}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (e) {
        console.error('Error loading leaderboard:', e);
        container.innerHTML = `
            <div class="message-box message-error">
                <strong>Error loading leaderboard</strong><br>
                ${escapeHtml(e.message || 'Unknown error')}
            </div>
        `;
    }
}

// Login Page
async function initLoginPage() {
    const user = await getCurrentUser();
    if (user) {
        // Already logged in, redirect to main page
        window.location.href = '/latent-space/';
    }
}

// ============== Email Preferences ==============

// Fetch email preferences by unsubscribe token (no auth required)
async function fetchEmailPreferences(token) {
    if (!token) return null;
    
    try {
        const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_email_preferences_by_token', {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ p_token: token })
        });
        
        if (!response.ok) {
            console.error('Error fetching email preferences:', response.status);
            return null;
        }
        
        return await response.json();
    } catch (e) {
        console.error('Error in fetchEmailPreferences:', e);
        return null;
    }
}

// Update email preferences by unsubscribe token (no auth required)
async function updateEmailPreferences(token, notifyNewPuzzles, notifyNewHints) {
    if (!token) return { success: false, error: 'No token provided' };
    
    try {
        const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/update_email_preferences_by_token', {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                p_token: token,
                p_notify_new_puzzles: notifyNewPuzzles,
                p_notify_new_hints: notifyNewHints
            })
        });
        
        if (!response.ok) {
            console.error('Error updating email preferences:', response.status);
            return { success: false, error: 'Server error' };
        }
        
        return await response.json();
    } catch (e) {
        console.error('Error in updateEmailPreferences:', e);
        return { success: false, error: e.message };
    }
}

// Fetch current user's email preferences (when logged in)
async function fetchMyEmailPreferences() {
    const user = await getCurrentUser();
    if (!user || !supabaseConfigured) return null;
    
    try {
        const token = currentSession?.access_token || SUPABASE_ANON_KEY;
        const response = await fetch(
            SUPABASE_URL + '/rest/v1/email_preferences?user_id=eq.' + user.id,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + token
                }
            }
        );
        
        if (!response.ok) {
            console.error('Error fetching my email preferences:', response.status);
            return null;
        }
        
        const data = await response.json();
        return data?.[0] || null;
    } catch (e) {
        console.error('Error in fetchMyEmailPreferences:', e);
        return null;
    }
}

// Update current user's email preferences (when logged in)
async function updateMyEmailPreferences(notifyNewPuzzles, notifyNewHints) {
    const user = await getCurrentUser();
    if (!user || !supabaseConfigured) {
        showMessage('Please log in to update your preferences.', 'error');
        return false;
    }
    
    try {
        const token = currentSession?.access_token || SUPABASE_ANON_KEY;
        
        const response = await fetch(
            SUPABASE_URL + '/rest/v1/email_preferences?user_id=eq.' + user.id,
            {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    notify_new_puzzles: notifyNewPuzzles,
                    notify_new_hints: notifyNewHints,
                    updated_at: new Date().toISOString()
                })
            }
        );
        
        if (!response.ok) {
            console.error('Error updating email preferences:', response.status);
            showMessage('Error updating preferences. Please try again.', 'error');
            return false;
        }
        
        showMessage('Email preferences updated!', 'success');
        return true;
    } catch (e) {
        console.error('Error in updateMyEmailPreferences:', e);
        showMessage('Error updating preferences. Please try again.', 'error');
        return false;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
});

// Taskbar clock updater for Latent Space pages
(function () {
    const timeDisplay = document.getElementById('time-options');
    if (!timeDisplay) return;
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeDisplay.setAttribute('data-time', hours + ':' + minutes);
    }
    updateClock();
    setInterval(updateClock, 30000);
})();
