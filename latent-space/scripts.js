// Latent Space - Puzzle System Scripts
// Supabase Configuration

const SUPABASE_URL = 'https://begtzhbfsvntrqaxjmah.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZ3R6aGJmc3ZudHJxYXhqbWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTI1MTAsImV4cCI6MjA4NDY2ODUxMH0.5W2khGK3va9a6cjM5jrsNhfPrzlrAjqAmzcjegy_47U';

// Initialize Supabase client
let supabaseClient = null;
let supabaseConfigured = false;
let currentSession = null;
let authInitialized = false;
let authInitPromise = null;

try {
    if (typeof window.supabase === 'undefined') {
        console.error('[Latent Space] Supabase library not loaded!');
    } else if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
        console.error('[Latent Space] Supabase anon key not configured.');
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
            },
            global: {
                headers: { 'x-my-custom-header': 'latent-space' }
            }
        });
        supabaseConfigured = true;
        
        // Set up auth state listener and wait for initial state
        authInitPromise = new Promise((resolve) => {
            const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
                currentSession = session;
                
                // Resolve the promise first (so getCurrentUser doesn't wait forever)
                const wasInitialized = authInitialized;
                if (!authInitialized) {
                    authInitialized = true;
                    resolve(session);
                }
                
                // Only run side effects AFTER initial page load (not during)
                if (wasInitialized) {
                    try {
                        if (event === 'SIGNED_IN' && session && typeof ensureUserExists === 'function') {
                            await ensureUserExists(session.user);
                        }
                        if (typeof updateAuthUI === 'function') {
                            updateAuthUI();
                        }
                    } catch (e) {
                        console.error('[Latent Space] Error in auth state handler:', e);
                    }
                }
            });
        });
    }
} catch (e) {
    console.error('[Latent Space] Error initializing Supabase:', e);
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
        console.error('[Latent Space] Error in getCurrentUser:', e);
        return null;
    }
}

async function signInWithGoogle() {
    if (!supabaseConfigured || !supabaseClient) {
        showMessage('Authentication not configured. Please contact the site administrator.', 'error');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/latent-space/'
            }
        });
        
        if (error) {
            console.error('[Latent Space] Error signing in:', error);
            showMessage('Error signing in: ' + error.message, 'error');
        }
    } catch (e) {
        console.error('[Latent Space] Error in signInWithGoogle:', e);
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
        const { error } = await supabaseClient
            .from('users')
            .upsert({
                id: user.id,
                email: user.email,
                username: user.user_metadata?.full_name || user.email.split('@')[0],
                avatar_url: user.user_metadata?.avatar_url || null
            }, { onConflict: 'id' });
        
        if (error) {
            console.error('Error upserting user:', error);
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
        const { error } = await supabaseClient
            .from('users')
            .update({ username: trimmedName })
            .eq('id', user.id);
        
        if (error) {
            console.error('Error updating username:', error);
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

async function fetchUserProfile(userId) {
    if (!supabaseConfigured) return null;
    
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('username, avatar_url')
            .eq('id', userId)
            .single();
        
        if (error) return null;
        return data;
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
    
    if (user) {
        // Fetch custom username from database
        const profile = await fetchUserProfile(user.id);
        const displayName = profile?.username || user.user_metadata?.full_name || user.email;
        
        authButtons.forEach(el => el.classList.add('hidden'));
        userInfos.forEach(el => {
            el.classList.remove('hidden');
            const nameEl = el.querySelector('.user-name');
            const avatarEl = el.querySelector('.user-avatar');
            if (nameEl) nameEl.textContent = displayName;
            if (avatarEl && user.user_metadata?.avatar_url) {
                avatarEl.src = user.user_metadata.avatar_url;
            }
        });
        requiresAuth.forEach(el => el.classList.remove('hidden'));
        hideWhenAuth.forEach(el => el.classList.add('hidden'));
    } else {
        authButtons.forEach(el => el.classList.remove('hidden'));
        userInfos.forEach(el => el.classList.add('hidden'));
        requiresAuth.forEach(el => el.classList.add('hidden'));
        hideWhenAuth.forEach(el => el.classList.remove('hidden'));
    }
}

// ============== Puzzles ==============

async function fetchPuzzles() {
    if (!supabaseConfigured) return [];
    
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), 10000)
        );
        
        const queryPromise = supabaseClient
            .from('puzzles')
            .select('*')
            .order('release_time', { ascending: true });
        
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
        
        if (error) {
            console.error('Error fetching puzzles:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error in fetchPuzzles:', e);
        return [];
    }
}

async function fetchPuzzle(puzzleId) {
    const { data, error } = await supabaseClient
        .from('puzzles')
        .select('*')
        .eq('id', puzzleId)
        .single();
    
    if (error) {
        console.error('Error fetching puzzle:', error);
        return null;
    }
    return data;
}

async function fetchHints(puzzleId) {
    const now = new Date().toISOString();
    const { data, error } = await supabaseClient
        .from('hints')
        .select('*')
        .eq('puzzle_id', puzzleId)
        .lte('release_time', now)
        .order('release_time', { ascending: true });
    
    if (error) {
        console.error('Error fetching hints:', error);
        return [];
    }
    return data || [];
}

async function fetchAllHintsCount(puzzleId) {
    const { count, error } = await supabaseClient
        .from('hints')
        .select('*', { count: 'exact', head: true })
        .eq('puzzle_id', puzzleId);
    
    if (error) {
        console.error('Error counting hints:', error);
        return 0;
    }
    return count || 0;
}

async function fetchUpcomingHint(puzzleId) {
    const now = new Date().toISOString();
    const { data, error } = await supabaseClient
        .from('hints')
        .select('release_time')
        .eq('puzzle_id', puzzleId)
        .gt('release_time', now)
        .order('release_time', { ascending: true })
        .limit(1);
    
    if (error) {
        console.error('Error fetching upcoming hint:', error);
        return null;
    }
    return data?.[0] || null;
}

// ============== Submissions ==============

async function checkAnswer(puzzleId, answer) {
    const user = await getCurrentUser();
    if (!user) {
        showMessage('Please log in to submit answers.', 'error');
        return null;
    }
    
    // Normalize and hash the answer for comparison
    const normalizedAnswer = answer.toLowerCase().trim();
    const answerHash = await hashString(normalizedAnswer);
    
    // Call the check_answer function with both the answer text and hash
    const { data, error } = await supabaseClient.rpc('check_answer', {
        p_puzzle_id: puzzleId,
        p_user_id: user.id,
        p_answer_text: normalizedAnswer,
        p_answer_hash: answerHash
    });
    
    if (error) {
        console.error('Error checking answer:', error);
        showMessage('Error submitting answer. Please try again.', 'error');
        return null;
    }
    
    return data;
}

async function getUserSubmission(puzzleId) {
    const user = await getCurrentUser();
    if (!user) return null;
    
    const { data, error } = await supabaseClient
        .from('submissions')
        .select('*')
        .eq('puzzle_id', puzzleId)
        .eq('user_id', user.id)
        .eq('is_correct', true)
        .limit(1);
    
    if (error) {
        console.error('Error fetching submission:', error);
        return null;
    }
    return data?.[0] || null;
}

// ============== Leaderboard ==============

async function fetchLeaderboard() {
    const { data, error } = await supabaseClient
        .from('leaderboard_view')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(100);
    
    if (error) {
        console.error('Error fetching leaderboard:', error);
        // Fallback: calculate from submissions
        return await calculateLeaderboard();
    }
    return data || [];
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
    await updateAuthUI();
    await loadPuzzleList();
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
            const titleCell = canAccess 
                ? `<a href="puzzle-${String(puzzle.id).padStart(3, '0')}.html">${escapeHtml(puzzle.title)}</a>`
                : escapeHtml(puzzle.title);
            
            html += `
                <tr>
                    <td>${puzzle.id}</td>
                    <td>${titleCell}</td>
                    <td>${formatDate(puzzle.release_time)}</td>
                    <td>${puzzle.base_points}</td>
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
    await updateAuthUI();
    await loadPuzzle(puzzleId);
    await loadHints(puzzleId);
    await checkExistingSubmission(puzzleId);
    
    // Set up hint refresh
    setInterval(() => loadHints(puzzleId), 60000); // Check for new hints every minute
}

async function loadPuzzle(puzzleId) {
    const puzzle = await fetchPuzzle(puzzleId);
    if (!puzzle) {
        showMessage('Puzzle not found.', 'error');
        return;
    }
    
    const titleEl = document.getElementById('puzzle-title');
    const descEl = document.getElementById('puzzle-description');
    const pointsEl = document.getElementById('puzzle-points');
    
    if (titleEl) titleEl.textContent = puzzle.title;
    if (descEl) descEl.innerHTML = puzzle.description;
    if (pointsEl) pointsEl.textContent = puzzle.base_points;
    
    // Store puzzle data for scoring
    window.currentPuzzle = puzzle;
}

async function loadHints(puzzleId) {
    const container = document.getElementById('hints-container');
    if (!container) return;
    
    const hints = await fetchHints(puzzleId);
    const totalHints = await fetchAllHintsCount(puzzleId);
    const upcomingHint = await fetchUpcomingHint(puzzleId);
    
    // Update current score display
    const scoreMultiplier = 1 / Math.pow(2, hints.length);
    const scoreEl = document.getElementById('current-multiplier');
    if (scoreEl && window.currentPuzzle) {
        const currentPoints = Math.floor(window.currentPuzzle.base_points * scoreMultiplier);
        scoreEl.textContent = `${currentPoints} pts (${hints.length} hint${hints.length !== 1 ? 's' : ''} used)`;
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
            html += `
                <div class="hint-card">
                    <div class="hint-header" onclick="toggleHint(${index})">
                        <button class="hint-toggle" id="hint-toggle-${index}">▶</button>
                        <strong>Hint ${index + 1}</strong>
                        <span class="hint-time">Released: ${formatDate(hint.release_time)}</span>
                    </div>
                    <div class="hint-content hidden" id="hint-content-${index}">
                        ${escapeHtml(hint.hint_text)}
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
                    <strong>Next hint</strong>
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
}

async function checkExistingSubmission(puzzleId) {
    const submission = await getUserSubmission(puzzleId);
    const form = document.getElementById('submission-form');
    const solvedMessage = document.getElementById('solved-message');
    
    if (submission && form && solvedMessage) {
        form.classList.add('hidden');
        solvedMessage.classList.remove('hidden');
        solvedMessage.innerHTML = `
            <div class="message-box message-success">
                <h3>✓ Puzzle Solved!</h3>
                <p>You solved this puzzle and earned <strong>${submission.score} points</strong>!</p>
                <p>Submitted on: ${formatDate(submission.submitted_at)}</p>
            </div>
        `;
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
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Checking...';
    
    const result = await checkAnswer(puzzleId, input.value);
    
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit';
    
    if (result === null) return;
    
    if (result.correct) {
        showMessage(`🎉 Correct! You earned ${result.score} points!`, 'success');
        await checkExistingSubmission(puzzleId);
    } else {
        showMessage('❌ Incorrect answer. Try again!', 'error');
    }
    
    input.value = '';
}

// Leaderboard Page
async function initLeaderboardPage() {
    await updateAuthUI();
    await loadLeaderboard();
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
            
            html += `
                <tr class="${rankClass}">
                    <td class="rank-cell">${rankIcon}</td>
                    <td>${escapeHtml(entry.username || 'Anonymous')}</td>
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
});
