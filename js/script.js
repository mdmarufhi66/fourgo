console.log('[DEBUG] Aqua Spark Script execution started.');

// --- Global Variables ---
let app, db, auth, storage, analytics;
let firebaseInitialized = false;
let telegramUser;
let tonConnectUI = null;
let currentChestIndex = 0;
let currentUserData = null; // Global cache for user data
let activeCooldownInterval = null;
const cooldownTrackedItems = {};
let dailyBonusClaimedToday = false; // New flag for daily bonus
let dailyBonusCooldownEnd = 0; // New timestamp for bonus cooldown

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// !!!!! SECURITY WARNING !!!!!
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// EXPOSING FIREBASE CONFIG LIKE THIS IN CLIENT-SIDE CODE IS UNSAFE
// FOR PRODUCTION. Use Firebase Cloud Functions and Security Rules.
// Replace with your actual Firebase config, but BEWARE of the risks.
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY", // <--- REPLACE (UNSAFE)
    authDomain: "YOUR_FIREBASE_AUTH_DOMAIN", // <--- REPLACE
    projectId: "YOUR_FIREBASE_PROJECT_ID", // <--- REPLACE
    storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET", // <--- REPLACE
    messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID", // <--- REPLACE
    appId: "YOUR_FIREBASE_APP_ID", // <--- REPLACE
    measurementId: "YOUR_FIREBASE_MEASUREMENT_ID" // <--- REPLACE (Optional)
};

// Cooldown Constants
const REWARDED_AD_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
const QUEST_REPEAT_COOLDOWN_MS = 1 * 60 * 60 * 1000; // 1 hour
const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Chest Data (Consider fetching from Firestore)
const chests = [
    { name: "Wood Chest", next: "Bronze", image: "assets/graphics/wood-chest-aqua.png", gemCost: 200, vip: 0 },
    { name: "Bronze Chest", next: "Silver", image: "assets/graphics/bronze-chest-aqua.png", gemCost: 500, vip: 1 },
    { name: "Silver Chest", next: "Gold", image: "assets/graphics/silver-chest-aqua.png", gemCost: 1000, vip: 2 },
    { name: "Gold Chest", next: "Master", image: "assets/graphics/gold-chest-aqua.png", gemCost: 2000, vip: 3 },
    { name: "Master Chest", next: "Legendary", image: "assets/graphics/master-chest-aqua.png", gemCost: 5000, vip: 4 },
    { name: "Legendary Chest", next: "Mythic", image: "assets/graphics/legendary-chest-aqua.png", gemCost: 10000, vip: 5 },
    { name: "Mythic Chest", next: "", image: "assets/graphics/mythic-chest-aqua.png", gemCost: 20000, vip: 6 }
];

// Daily Bonus Config
const DAILY_BONUS_GEMS = 50; // Example amount

// --- Utility Functions ---

function debugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    // Add indicators for level (INFO, WARN, ERROR) - simple prefix for now
    let level = '[INFO]';
    if (message.toLowerCase().includes('error')) level = '[ERROR]';
    else if (message.toLowerCase().includes('warn')) level = '[WARN]';

    console.log(`${level} ${timestamp}: ${message}`, data !== null ? data : '');
    const debugConsole = document.getElementById('debugConsole');
    if (debugConsole) {
        const entry = document.createElement('div');
        // Simple coloring based on level
        if (level === '[ERROR]') entry.style.color = '#FF9A9A';
        else if (level === '[WARN]') entry.style.color = '#FFDB9A';
        entry.textContent = `${timestamp}: ${message}${data ? ` - ${JSON.stringify(data)}` : ''}`;
        debugConsole.appendChild(entry);
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }
}

function loadScript(src, retries = 3, delay = 1000) {
    debugLog(`Attempting to load script: ${src}`);
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const tryLoad = () => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => { debugLog(`Script loaded successfully: ${src}`); resolve(); };
            script.onerror = () => {
                attempts++;
                debugLog(`[WARN] Failed to load script: ${src}. Attempt ${attempts}/${retries}`);
                if (attempts < retries) { setTimeout(tryLoad, delay); }
                else { const errorMsg = `Failed to load script after ${retries} attempts: ${src}`; console.error(errorMsg); debugLog(`[ERROR] ${errorMsg}`); reject(new Error(errorMsg)); }
            };
            document.head.appendChild(script);
        };
        tryLoad();
    });
}

function validateFirebaseConfig(config) {
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    let missing = [];
    for (const field of requiredFields) {
        if (!config[field] || config[field].startsWith('YOUR_')) { // Check for placeholder
             missing.push(field);
        }
    }
    if (missing.length > 0) {
         const errorMsg = `Firebase config incomplete/placeholder detected. Missing/incorrect: ${missing.join(', ')}. Please update aqua-script.js.`;
         console.error(errorMsg);
         debugLog(`[ERROR] ${errorMsg}`);
         alert("Firebase configuration error. Please check the setup."); // Alert user
         throw new Error(errorMsg); // Stop initialization
    }
    debugLog("Firebase config seems present."); // Don't log success if it's just placeholders
}


function safeConvertToDate(timestamp) {
    if (!timestamp) return null;
    try {
        if (typeof timestamp.toDate === 'function') return timestamp.toDate();
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) { debugLog(`[WARN] Invalid date format encountered:`, timestamp); return null; }
        return date;
    } catch (dateError) { debugLog(`[WARN] Error converting value to Date:`, timestamp, dateError); return null; }
}

function formatMillisecondsToMMSS(ms) {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatMillisecondsToHHMMSS(ms) {
    if (ms <= 0) return '0:00:00';
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// --- Cooldown Timer Management --- (Includes Daily Bonus Timer)
function startCooldownUpdater() {
    if (activeCooldownInterval) return;
    debugLog('[TIMER] Starting cooldown update interval.');
    activeCooldownInterval = setInterval(() => {
        checkAndUpdateCooldowns();
        updateDailyBonusTimerUI(); // Update bonus timer as well
    }, 1000);
}

function stopCooldownUpdater() {
    if (activeCooldownInterval) {
        debugLog('[TIMER] Stopping cooldown update interval.');
        clearInterval(activeCooldownInterval);
        activeCooldownInterval = null;
    }
     // Clear tracked items on stop? Or keep them? Let's clear for now.
     for (const key in cooldownTrackedItems) { delete cooldownTrackedItems[key]; }
     debugLog('[TIMER] Cleared tracked quest cooldown items.');
}

function trackCooldownItem(questId, listItemElement, endTime, cooldownType) {
    cooldownTrackedItems[questId] = { element: listItemElement, endTime: endTime, type: cooldownType };
    startCooldownUpdater();
}

function untrackCooldownItem(questId) {
    if (cooldownTrackedItems[questId]) delete cooldownTrackedItems[questId];
}

function checkAndUpdateCooldowns() {
    const now = Date.now();
    let hasActiveTimers = false;

    Object.entries(cooldownTrackedItems).forEach(([questId, itemData]) => {
        if (!itemData || !itemData.element) { debugLog(`[TIMER WARN] Invalid item data for quest ${questId}, removing.`); untrackCooldownItem(questId); return; }
        const button = itemData.element.querySelector('.quest-action-container button');
        if (!button) { debugLog(`[TIMER WARN] Button not found for tracked quest ${questId}, removing.`); untrackCooldownItem(questId); return; }

        const remainingMs = itemData.endTime - now;
        if (remainingMs <= 0) {
            debugLog(`[TIMER] Quest cooldown finished for ${questId}. Triggering UI update.`);
            updateQuestItemUI(questId, itemData.element, null); // Call full update
        } else {
            const formatter = remainingMs > 3600000 ? formatMillisecondsToHHMMSS : formatMillisecondsToMMSS; // Use HH:MM:SS for longer waits
            const formattedTime = formatter(remainingMs);
            const waitText = `Wait ${formattedTime}`;
            if (button.textContent !== waitText) button.textContent = waitText;
            button.disabled = true;
            hasActiveTimers = true;
        }
    });

    if (!hasActiveTimers && Object.keys(cooldownTrackedItems).length === 0) {
        setTimeout(() => { if (Object.keys(cooldownTrackedItems).length === 0) { stopCooldownUpdater(); } }, 100);
    }
}

// --- Firebase Initialization ---
async function initializeFirebase(maxRetries = 3) {
    debugLog("Initializing Firebase...");
    if (firebaseInitialized) { debugLog("Firebase already initialized."); return true; }

    // Basic check if Firebase is already loaded globally (less robust than dynamic import but simple)
    if (typeof window.firebase !== 'undefined' && window.firebase.apps && window.firebase.apps.length > 0) {
        debugLog("Firebase detected in global scope, reusing.");
        // Assume services are also available if app exists
        app = window.firebase.app(); // Get default app
        db = window.firebase.firestore();
        auth = window.firebase.auth();
        storage = window.firebase.storage();
        try { analytics = window.firebase.analytics(); } catch (e) { debugLog("[WARN] Analytics setup failed:", e.message); }
        firebaseInitialized = true;
        return true;
    }

    let attempts = 0;
    while (attempts < maxRetries && !firebaseInitialized) {
        try {
            debugLog(`Attempt ${attempts + 1}/${maxRetries} to initialize Firebase...`);
            validateFirebaseConfig(firebaseConfig); // Check for placeholder keys

            // Ensure Firebase SDKs are loaded (simple check, assumes they are linked in HTML)
             if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined' ||
                 typeof firebase.firestore === 'undefined' || typeof firebase.auth === 'undefined' ||
                 typeof firebase.storage === 'undefined') {
                 throw new Error("One or more Firebase SDKs (app, firestore, auth, storage) not loaded. Check HTML script tags.");
             }

            if (firebase.apps.length === 0) {
                app = firebase.initializeApp(firebaseConfig);
                debugLog("Firebase app initialized.");
            } else {
                app = firebase.app(); // Get default app if already initialized elsewhere
                debugLog("Reusing existing Firebase app instance.");
            }

            // Initialize services using compat library
            db = firebase.firestore();
            auth = firebase.auth();
            storage = firebase.storage();
            try {
                analytics = firebase.analytics();
            } catch (e) {
                 debugLog("[WARN] Analytics setup failed (optional):", e.message);
            }

            // Test Firestore connectivity
             await db.collection('internal_status').doc('init_test_aqua').set({
                 timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                 status: 'ok',
                 initTime: new Date().toISOString()
             }, { merge: true });
             debugLog("Firestore connectivity test passed.");


            firebaseInitialized = true;
            debugLog("Firebase fully initialized and connected.");
            return true;
        } catch (error) {
            attempts++;
            console.error(`Firebase initialization attempt ${attempts} failed:`, error);
            debugLog(`[ERROR] Firebase init attempt ${attempts} failed: ${error.message}`);
            if (attempts >= maxRetries) {
                console.error("Max retries reached. Firebase initialization failed definitively.");
                debugLog("[ERROR] Max retries reached. Firebase initialization failed definitively.");
                // Keep loading overlay with error message
                const loadingOverlay = document.getElementById('loadingOverlay');
                if(loadingOverlay) loadingOverlay.textContent = 'Database Connection Failed. Please Restart.';
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retry
        }
    }
    return false; // Should only be reached if maxRetries fail
}

async function ensureFirebaseReady(callback, callbackName = 'Unnamed Callback') {
    // debugLog(`Ensuring Firebase is ready for: ${callbackName}`); // Reduce noise
    if (!firebaseInitialized || !db) {
        debugLog("[WARN] Firebase not ready, attempting initialization...");
        const success = await initializeFirebase();
        if (!success) {
            console.error(`[ERROR] Firebase initialization failed. Cannot execute ${callbackName}.`);
            debugLog(`[ERROR] Firebase init failed, cannot execute ${callbackName}`);
            // Maybe show an alert, but initializeFirebase should handle critical failure message
            return; // Stop execution
        }
    }
    // debugLog(`Firebase ready, executing: ${callbackName}`); // Reduce noise
    try {
        await callback();
        // debugLog(`Successfully executed: ${callbackName}`); // Reduce noise
    } catch (error) {
        console.error(`[ERROR] during ${callbackName}:`, error);
        debugLog(`[ERROR] during ${callbackName}: ${error.message}\n${error.stack}`);
    }
}


// --- Telegram Web App Setup ---
function initializeTelegram() {
    debugLog("Initializing Telegram Web App...");
    try {
        if (!window.Telegram || !window.Telegram.WebApp) throw new Error("Telegram WebApp script not loaded or available.");

        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand(); // Expand the app window
        // Optional: Set header color
        // window.Telegram.WebApp.setHeaderColor('#00ACC1'); // Match header gradient start

        telegramUser = window.Telegram.WebApp.initDataUnsafe?.user;

        if (telegramUser) {
            debugLog("Telegram user data found:", { id: telegramUser.id, username: telegramUser.username });
            updateProfilePicture(telegramUser.photo_url); // Update multiple profile pics
        } else {
            debugLog("[WARN] No Telegram user data available. Using test user.");
            telegramUser = { id: "test_user_" + Date.now(), username: "TestUserAqua", first_name: "Test", photo_url: null };
             updateProfilePicture(null); // Use default
        }

        // Handle theme parameters from Telegram if needed
        // const themeParams = window.Telegram.WebApp.themeParams;
        // debugLog("Telegram Theme Params:", themeParams);
        // Apply theme adjustments based on themeParams.bg_color etc. if desired

        debugLog("Telegram Web App initialized successfully.");
        return true;
    } catch (error) {
        console.error("Telegram Web App initialization failed:", error);
        debugLog(`[ERROR] Telegram Web App initialization failed: ${error.message}`);
        telegramUser = { id: "fallback_user_" + Date.now(), username: "FallbackUser", first_name: "Fallback", photo_url: null };
         updateProfilePicture(null); // Use default
        alert("Could not initialize Telegram features. Using fallback mode.");
        return false;
    }
}

// Helper to update profile pictures in multiple locations
function updateProfilePicture(photoUrl) {
    const defaultAvatar = 'assets/icons/user-avatar-aqua.png'; // New default
    const urlToUse = photoUrl || defaultAvatar;

    const profilePics = document.querySelectorAll('.profile-pic img, #profile-avatar');
    profilePics.forEach(img => {
        if (img) {
            img.src = urlToUse;
            img.onerror = () => { img.src = defaultAvatar; }; // Fallback on error
        }
    });
}

// --- Storage Abstraction (Firestore) ---
const Storage = {
    // Simplified getItem - assumes userData structure
    getItem: async (key) => {
        if (!firebaseInitialized || !db || !telegramUser?.id) { debugLog(`[Storage WARN] Cannot getItem '${key}': System not ready.`); return null; }
        try {
            const docRef = db.collection('userData').doc(telegramUser.id.toString());
            const doc = await docRef.get({ source: 'server' }); // Prefer server for potentially critical reads? Or cache? Let's use server for now.
            return doc.exists ? doc.data()?.[key] : null;
        } catch (error) { debugLog(`[Storage ERROR] Failed fetching '${key}': ${error.message}`); return null; }
    },
    // Simplified setItem - merges data
    setItem: async (key, value) => {
         if (!firebaseInitialized || !db || !telegramUser?.id) { debugLog(`[Storage WARN] Cannot setItem '${key}': System not ready.`); return false; }
        try {
            const docRef = db.collection('userData').doc(telegramUser.id.toString());
            await docRef.set({ [key]: value }, { merge: true });
            return true;
        } catch (error) { debugLog(`[Storage ERROR] Failed setting '${key}': ${error.message}`); return false; }
    },
     // Function to update multiple fields atomically (using update)
     updateItems: async (updates) => {
         if (!firebaseInitialized || !db || !telegramUser?.id) { debugLog(`[Storage WARN] Cannot updateItems: System not ready.`); return false; }
         if (typeof updates !== 'object' || Object.keys(updates).length === 0) { debugLog(`[Storage WARN] Invalid updates object provided.`); return false; }
         try {
             const docRef = db.collection('userData').doc(telegramUser.id.toString());
             await docRef.update(updates); // Use update for existing docs
             return true;
         } catch (error) { debugLog(`[Storage ERROR] Failed updating items: ${error.message}`); return false; }
     }
};


// --- Navigation Logic ---
function setupNavigation() {
    debugLog('[NAV] Setting up navigation...');
    const sections = document.querySelectorAll('.section');
    const navButtons = document.querySelectorAll('nav.bottom-nav .nav-button');
    const profileNavButton = document.getElementById('profileNavButton'); // New profile button in header

    if (sections.length === 0 || navButtons.length === 0 || !profileNavButton) {
        debugLog('[NAV ERROR] Required navigation elements not found!');
        alert("UI Error: Navigation could not be set up.");
        return;
    }

    const switchFunc = (event) => {
        const sectionId = event.currentTarget.getAttribute('data-section');
        debugLog(`[NAV] Click detected on button: ${sectionId}`);
        if (sectionId) switchSection(sectionId);
    };

    navButtons.forEach(button => {
        // Clean previous listeners by cloning
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', switchFunc);
    });

    // Profile button listener
    const newProfileNavButton = profileNavButton.cloneNode(true);
    profileNavButton.parentNode.replaceChild(newProfileNavButton, profileNavButton);
    newProfileNavButton.setAttribute('data-section', 'profile'); // Add attribute for consistency
    newProfileNavButton.addEventListener('click', switchFunc);

    const defaultSection = 'earn';
    switchSection(defaultSection, true); // Load default section
    debugLog('[NAV] Navigation setup complete.');
}

async function switchSection(sectionId, isInitialLoad = false) {
    debugLog(`[NAV] Attempting to switch to section: ${sectionId}`);
    const sections = document.querySelectorAll('.section');
    const navButtons = document.querySelectorAll('nav.bottom-nav .nav-button');
    const profileNavButton = document.getElementById('profileNavButton'); // Re-select potentially cloned node

    const currentActiveSection = document.querySelector('.section.active');
    if (currentActiveSection && currentActiveSection.id === 'earn' && sectionId !== 'earn') {
        stopCooldownUpdater(); // Stop quest timers if leaving Earn
    }

    let foundSection = false;
    sections.forEach(section => {
        if (section.id === sectionId) {
            section.classList.add('active');
            foundSection = true;
        } else {
            section.classList.remove('active');
        }
    });

    if (!foundSection) { debugLog(`[NAV ERROR] Target section element "${sectionId}" not found.`); return; }

    // Update nav button active states
    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-section') === sectionId);
    });

    // Update profile button visual state (though it doesn't have an 'active' class in nav style)
    // Maybe add a border or background change if needed via a specific class.
    profileNavButton.classList.toggle('profile-active', sectionId === 'profile'); // Example


    // --- Load Data for the Section ---
    debugLog(`[NAV] Loading data for section: ${sectionId}`);
    updateNotificationIndicators(); // Update indicators on every navigation

    switch (sectionId) {
        case 'earn':
            await ensureFirebaseReady(updateEarnSectionUI, 'updateEarnSectionUI');
            startCooldownUpdater(); // Start timers AFTER UI is rendered
            break;
        case 'wallet':
            await ensureFirebaseReady(updateWalletSectionUI, 'updateWalletSectionUI');
            break;
        case 'game':
            // No specific load function needed currently
            break;
        case 'invite':
            await ensureFirebaseReady(updateInviteSectionUI, 'updateInviteSectionUI');
            break;
        case 'chest':
            await ensureFirebaseReady(updateUserStatsUI, 'updateChestUserStats'); // Need stats for chest
            updateChestUI(); // Update slider UI
            break;
        case 'top':
            await ensureFirebaseReady(updateTopSectionUI, 'updateTopSectionUI');
            break;
        case 'profile': // New Profile Section
             await ensureFirebaseReady(updateProfileSectionUI, 'updateProfileSectionUI');
             break;
        default:
            debugLog(`[NAV WARN] No specific data load logic for section: ${sectionId}`);
    }
     // Scroll to top of section on switch
     const mainContent = document.querySelector('.main-content');
     if (mainContent) mainContent.scrollTop = 0;
}


// --- User Data Management ---
async function initializeUserData() {
    debugLog("Initializing user data...");
    if (!telegramUser?.id) { debugLog("[USER INIT WARN] No Telegram user ID."); return; }
    if (!firebaseInitialized || !db) { debugLog("[USER INIT ERROR] Firestore not ready."); return; }

    const userIdStr = telegramUser.id.toString();
    const userDocRef = db.collection('userData').doc(userIdStr);
    const rankingDocRef = db.collection('users').doc(userIdStr); // Assumes 'users' collection for rankings

    try {
        const doc = await userDocRef.get({ source: 'server' }); // Force server read on init
        const rankDoc = await rankingDocRef.get({ source: 'server'});

        const defaultUserData = {
            gems: 0, usdt: 0, ton: 0,
            referrals: 0, referralCredits: 0,
            inviteRecords: [], claimHistory: [],
            landPieces: 0, foxMedals: 0, vipLevel: 0,
            isReferred: false, referredBy: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            claimedQuests: [], // IDs of claimed non-repeatable quests
            adProgress: {},    // { questId: { watched: N, claimed: bool, lastClaimed: timestamp } }
            adCooldowns: {},   // { adType: timestamp }
            walletAddress: null,
            transactions: [], // Consider subcollection if history becomes large
            lastDailyBonusClaim: null // New field for daily bonus
        };

         const defaultRankingData = {
            username: telegramUser.username || telegramUser.first_name || `User_${userIdStr.slice(-4)}`,
            foxMedals: 0,
            photoUrl: telegramUser.photo_url || null, // Store null if no photo
            userId: userIdStr, // Link back to userData ID
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
         };

        if (!doc.exists) {
            debugLog(`User ${userIdStr} not found, creating new records.`);
            await userDocRef.set(defaultUserData);
            // Only create ranking doc if it also doesn't exist
            if (!rankDoc.exists) {
                await rankingDocRef.set(defaultRankingData);
                 debugLog("New ranking entry created.");
            } else {
                 debugLog("User data missing but ranking entry exists? Syncing medals.");
                 // Sync medals if rank doc exists but user doc didn't
                 await rankingDocRef.update({ foxMedals: defaultUserData.foxMedals, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() });
            }
            debugLog("New user data initialized.");
            if (analytics) analytics.logEvent('sign_up', { method: 'telegram', userId: userIdStr });

        } else {
            debugLog(`User ${userIdStr} found. Updating last login and ensuring fields.`);
            const existingData = doc.data();
            const updates = { lastLogin: firebase.firestore.FieldValue.serverTimestamp() };
            let rankingUpdates = { lastUpdate: firebase.firestore.FieldValue.serverTimestamp() };
            let needsUserDataUpdate = false;
            let needsRankingUpdate = false;

            // Ensure essential fields exist from defaultUserData
            for (const key in defaultUserData) {
                if (!(key in existingData)) {
                     updates[key] = defaultUserData[key]; // Add missing field
                     needsUserDataUpdate = true;
                     debugLog(`Adding missing field to user data: ${key}`);
                     // If missing field is medal related, sync to ranking doc
                     if (key === 'foxMedals' && !rankDoc.exists) {
                        rankingUpdates.foxMedals = defaultUserData.foxMedals;
                        needsRankingUpdate = true;
                     }
                }
            }

            // --- Sync/Update Ranking Document ---
             const currentUsername = telegramUser.username || telegramUser.first_name || `User_${userIdStr.slice(-4)}`;
             const currentPhoto = telegramUser.photo_url || null;

            if (!rankDoc.exists) {
                 debugLog(`Ranking doc missing for existing user ${userIdStr}, creating.`);
                 rankingUpdates.username = currentUsername;
                 rankingUpdates.photoUrl = currentPhoto;
                 rankingUpdates.foxMedals = existingData.foxMedals || 0; // Sync from existing data
                 rankingUpdates.userId = userIdStr;
                 await rankingDocRef.set(rankingUpdates); // Create the doc
                 needsRankingUpdate = false; // Reset flag as it's done
            } else {
                 // Check if username, photo, or medals need updating in ranking doc
                 const rankData = rankDoc.data();
                 if (rankData.username !== currentUsername) { rankingUpdates.username = currentUsername; needsRankingUpdate = true; }
                 if (rankData.photoUrl !== currentPhoto) { rankingUpdates.photoUrl = currentPhoto; needsRankingUpdate = true; }
                 // Ensure medals are synced if different
                 if (rankData.foxMedals !== (existingData.foxMedals || 0)) {
                     rankingUpdates.foxMedals = existingData.foxMedals || 0;
                     needsRankingUpdate = true;
                     debugLog(`Syncing medals in ranking doc (${rankData.foxMedals} -> ${existingData.foxMedals || 0})`);
                 }
            }

             // Perform updates if needed
             if (needsUserDataUpdate || Object.keys(updates).length > 1) { // If more than just lastLogin
                 await userDocRef.update(updates);
                 debugLog("User data updated with missing fields/last login.");
             } else {
                 await userDocRef.update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() }); // Just update login
             }
             if (needsRankingUpdate) {
                 await rankingDocRef.update(rankingUpdates);
                 debugLog("Ranking data updated (username/photo/medals/lastUpdate).");
             }
        }

        // Fetch fresh data after init/update and store globally
        await fetchAndUpdateUserData();

    } catch (error) {
        console.error("Error initializing/checking user data:", error);
        debugLog(`[USER INIT ERROR] ${userIdStr}: ${error.message}\n${error.stack}`);
        alert("There was a problem loading your profile.");
    }
}

async function fetchAndUpdateUserData() {
    if (!telegramUser?.id || !firebaseInitialized || !db) { currentUserData = null; return null; }
    try {
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        const userDoc = await userDocRef.get({ source: 'server' }); // Force server fetch
        if (!userDoc.exists) { currentUserData = null; return null; }
        currentUserData = userDoc.data();

        // Check Daily Bonus status after fetching
        checkDailyBonusStatus();

        return currentUserData;
    } catch (error) {
        debugLog(`[ERROR] Error fetching user data: ${error.message}`);
        currentUserData = null; return null;
    }
}

async function updateUserStatsUI() {
    const data = currentUserData || await fetchAndUpdateUserData(); // Use cache or fetch

    const gemsEl = document.getElementById('gems');
    const usdtEl = document.getElementById('usdt');
    const tonEl = document.getElementById('ton');
    const walletUsdtEl = document.getElementById('wallet-usdt');
    const walletTonEl = document.getElementById('wallet-ton');

    if (!data) {
        debugLog("[STATS UI WARN] Update skipped: No user data.");
        if(gemsEl) gemsEl.textContent = '0';
        if(usdtEl) usdtEl.textContent = '0.0000';
        if(tonEl) tonEl.textContent = '0.0000';
        if(walletUsdtEl) walletUsdtEl.textContent = '0.0000';
        if(walletTonEl) walletTonEl.textContent = '0.0000';
        return;
    }

    try {
        if(gemsEl) gemsEl.textContent = (data.gems || 0).toLocaleString();
        if(usdtEl) usdtEl.textContent = (data.usdt || 0).toFixed(4);
        if(tonEl) tonEl.textContent = (data.ton || 0).toFixed(4);
        if(walletUsdtEl) walletUsdtEl.textContent = (data.usdt || 0).toFixed(4);
        if(walletTonEl) walletTonEl.textContent = (data.ton || 0).toFixed(4);
    } catch (error) {
        debugLog(`[ERROR] Error updating user stats UI: ${error.message}`);
    }
}


// --- Earn Section (Quests + Daily Bonus) ---

async function updateEarnSectionUI() {
    debugLog("[EARN UI] Starting Earn section UI update...");
    const dailyQuestList = document.getElementById('daily-quest-list');
    const basicQuestList = document.getElementById('basic-quest-list');
    const dailyQuestCountEl = document.getElementById('daily-quest-count');
    const basicQuestCountEl = document.getElementById('basic-quest-count');
    const dailyBonusSection = document.getElementById('dailyBonusSection');

    if (!dailyQuestList || !basicQuestList || !dailyQuestCountEl || !basicQuestCountEl || !dailyBonusSection) {
        debugLog("[EARN UI ERROR] Required DOM elements missing."); return;
    }

    // --- Update Daily Bonus UI ---
    updateDailyBonusUI(); // Call dedicated function

    // --- Update Quests ---
    dailyQuestList.innerHTML = `<li class="loading-placeholder"><p>Loading daily quests...</p></li>`;
    basicQuestList.innerHTML = `<li class="loading-placeholder"><p>Loading basic quests...</p></li>`;
    dailyQuestCountEl.textContent = '-';
    basicQuestCountEl.textContent = '-';

    try {
        let userData = currentUserData || await fetchAndUpdateUserData();
        if (!userData) throw new Error("User data not available for quest checks.");

        // Ensure structures exist
        userData.adProgress = userData.adProgress || {};
        userData.adCooldowns = userData.adCooldowns || {};
        userData.claimedQuests = userData.claimedQuests || [];

        // Fetch Quests (Combined daily and basic fetch for efficiency if structured similarly)
        // Assuming separate docs 'daily' and 'basic' in 'quests' collection
        const [dailySnapshot, basicSnapshot] = await Promise.all([
            db.collection('quests').doc('daily').get({ source: 'server' }),
            db.collection('quests').doc('basic').get({ source: 'server' })
        ]);

        const dailyQuests = dailySnapshot.exists ? (dailySnapshot.data().tasks || []) : [];
        const basicQuests = basicSnapshot.exists ? (basicSnapshot.data().tasks || []) : [];
        debugLog(`[EARN UI] Fetched ${dailyQuests.length} daily, ${basicQuests.length} basic quests.`);

        // Check and initialize adProgress if necessary
        let adProgressUpdateNeeded = false;
        const allAdQuests = [...dailyQuests, ...basicQuests].filter(q => q.type === 'ads' && q.id);
        allAdQuests.forEach(quest => {
            if (!userData.adProgress[quest.id]) {
                 userData.adProgress[quest.id] = { watched: 0, claimed: false, lastClaimed: null };
                 adProgressUpdateNeeded = true;
                 debugLog(`[EARN UI] Initializing adProgress for new quest: ${quest.id}`);
            }
        });
         if (adProgressUpdateNeeded) {
             debugLog("[EARN UI] Updating user data with initial adProgress structures...");
             await Storage.setItem('adProgress', userData.adProgress); // Use Storage abstraction
             // Re-fetch data AFTER update
             userData = await fetchAndUpdateUserData();
             if (!userData) throw new Error("User data unavailable after adProgress init.");
             // Re-ensure structures
             userData.adProgress = userData.adProgress || {};
             userData.adCooldowns = userData.adCooldowns || {};
             userData.claimedQuests = userData.claimedQuests || [];
         }


        // Render Daily Quests
        dailyQuestCountEl.textContent = dailyQuests.length;
        dailyQuestList.innerHTML = ''; // Clear loading
        if (dailyQuests.length === 0) {
            dailyQuestList.innerHTML = `<li class="no-quests"><p>No daily quests available today.</p></li>`;
        } else {
            dailyQuests.forEach(quest => {
                if (!quest.id) { debugLog("[EARN UI WARN] Daily quest missing 'id'.", quest); return; }
                try { dailyQuestList.appendChild(createQuestItem(quest, userData)); }
                catch(renderError) { debugLog(`[EARN UI ERROR] Render failed for daily quest ${quest.id}: ${renderError.message}`); }
            });
        }

        // Render Basic Quests
        basicQuestCountEl.textContent = basicQuests.length;
        basicQuestList.innerHTML = ''; // Clear loading
        if (basicQuests.length === 0) {
            basicQuestList.innerHTML = `<li class="no-quests"><p>No basic quests available right now.</p></li>`;
        } else {
            basicQuests.forEach(quest => {
                if (!quest.id) { debugLog("[EARN UI WARN] Basic quest missing 'id'.", quest); return; }
                 try { basicQuestList.appendChild(createQuestItem(quest, userData)); }
                 catch(renderError) { debugLog(`[EARN UI ERROR] Render failed for basic quest ${quest.id}: ${renderError.message}`); }
            });
        }

         debugLog("[EARN UI] Quest sections updated.");

    } catch (error) {
        debugLog(`[EARN UI ERROR] Failed to update Earn section UI: ${error.message}\n${error.stack}`);
        dailyQuestList.innerHTML = `<li class="error"><p>Failed to load daily quests.</p></li>`;
        basicQuestList.innerHTML = `<li class="error"><p>Failed to load basic quests.</p></li>`;
        dailyQuestCountEl.textContent = 'ERR';
        basicQuestCountEl.textContent = 'ERR';
    }
}

function createQuestItem(quest, userData) {
    if (!quest || !quest.id) { /* ... handle invalid quest ... */ return document.createDocumentFragment(); }
    // debugLog(`[QUEST CREATE] Creating item: ${quest.id}`); // Reduce noise

    const li = document.createElement('li');
    li.className = 'quest-item'; // No card-style here, it's a list item
    li.dataset.questId = quest.id;
    li.dataset.questType = quest.type || 'default';

    const icon = quest.icon || 'assets/icons/quest_placeholder_aqua.png'; // Use new placeholder
    const title = quest.title || 'Untitled Quest';
    const reward = Number(quest.reward) || 0;
    const link = quest.link || '';
    const actionText = quest.action || (quest.type === 'ads' ? 'Watch Ad' : 'GO');
    li.dataset.originalAction = actionText;

    // Elements
    const iconImg = document.createElement('img');
    iconImg.src = icon; iconImg.alt = title; iconImg.className = 'quest-icon';
    iconImg.onerror = () => { iconImg.src = 'assets/icons/quest_placeholder_aqua.png'; };

    const infoDiv = document.createElement('div'); infoDiv.className = 'quest-info';
    const titleElement = document.createElement('span'); titleElement.textContent = title; titleElement.className = 'quest-title';
    const rewardDiv = document.createElement('div'); rewardDiv.className = 'quest-reward';
    const gemImg = document.createElement('img'); gemImg.src = 'assets/icons/gem-aqua.png'; gemImg.alt = 'Gem'; gemImg.className = 'reward-icon';
    const rewardSpan = document.createElement('span'); rewardSpan.textContent = `+${reward.toLocaleString()}`; rewardSpan.className = 'reward-amount';
    rewardDiv.appendChild(gemImg); rewardDiv.appendChild(rewardSpan);
    infoDiv.appendChild(titleElement); infoDiv.appendChild(rewardDiv);

    const buttonContainer = document.createElement('div'); buttonContainer.className = 'quest-action-container';
    let button = document.createElement('button'); // Define button var
    button.dataset.questReward = reward;

    // Ad Quest Specifics
    if (quest.type === 'ads') {
        const adType = quest.adType || 'rewarded_interstitial';
        const adsRequired = Math.max(1, Number(quest.adLimit) || 1);
        const progressSpan = document.createElement('span'); progressSpan.className = 'progress';
        buttonContainer.appendChild(progressSpan); // Add progress first
        li.dataset.adType = adType; li.dataset.adLimit = adsRequired;
    } else { // Non-Ad Quest
        button.dataset.questLink = link;
    }

    buttonContainer.appendChild(button); // Add button

    li.appendChild(iconImg);
    li.appendChild(infoDiv);
    li.appendChild(buttonContainer);

    // Add listener via cloning
    const freshButton = button.cloneNode(true);
    buttonContainer.replaceChild(freshButton, button);
    freshButton.addEventListener('click', handleQuestButtonClick);

    updateQuestItemUI(quest.id, li, userData); // Set initial state

    return li;
}

function updateQuestItemUI(questId, listItemElement, currentLocalUserData = null) {
    const userData = currentLocalUserData || currentUserData;
    untrackCooldownItem(questId); // Always untrack first

    if (!userData || !listItemElement) { /* ... handle missing data ... */ return; }

    const questType = listItemElement.dataset.questType;
    const adLimit = parseInt(listItemElement.dataset.adLimit || '0');
    const adType = listItemElement.dataset.adType || '';
    const originalActionText = listItemElement.dataset.originalAction || (questType === 'ads' ? 'Watch Ad' : 'GO');

    const button = listItemElement.querySelector('.quest-action-container button');
    const progressSpan = listItemElement.querySelector('.progress');
    if (!button) { /* ... handle missing button ... */ return; }

    // Get Quest State
    const isAdBased = questType === 'ads';
    const isNonAdClaimed = !isAdBased && (userData.claimedQuests?.includes(questId) || false);
    const adProgress = (isAdBased && userData.adProgress?.[questId]) ? userData.adProgress[questId] : { watched: 0, claimed: false, lastClaimed: null };

    // Update Progress Text
    if (isAdBased && progressSpan) {
        progressSpan.textContent = `${adProgress.watched}/${adLimit}`;
        progressSpan.style.display = 'inline';
    } else if (progressSpan) {
        progressSpan.style.display = 'none';
    }

    // Determine Status
    const isQuestCompleted = isAdBased ? adProgress.watched >= adLimit : true;
    const isQuestClaimed = isAdBased ? adProgress.claimed : isNonAdClaimed;

    // Check Cooldowns
    let isQuestOnCooldown = false; let questCooldownEndTime = 0; let questCooldownRemainingMs = 0;
    if (isAdBased && isQuestClaimed) {
        const questLastClaimedTime = safeConvertToDate(adProgress.lastClaimed)?.getTime() || 0;
        const timeSinceQuestLastClaim = Date.now() - questLastClaimedTime;
        if (questLastClaimedTime > 0 && timeSinceQuestLastClaim < QUEST_REPEAT_COOLDOWN_MS) {
            isQuestOnCooldown = true;
            questCooldownRemainingMs = QUEST_REPEAT_COOLDOWN_MS - timeSinceQuestLastClaim;
            questCooldownEndTime = Date.now() + questCooldownRemainingMs;
        }
    }

    let isAdTypeOnCooldown = false; let adTypeCooldownEndTime = 0; let adTypeCooldownRemainingMs = 0;
    if (isAdBased && (adType === 'rewarded_popup' || adType === 'rewarded_interstitial')) {
        const adTypeLastWatched = safeConvertToDate(userData.adCooldowns?.[adType])?.getTime() || 0;
        const timeSinceAdTypeLastWatched = Date.now() - adTypeLastWatched;
         if (adTypeLastWatched > 0 && timeSinceAdTypeLastWatched < REWARDED_AD_COOLDOWN_MS) {
             isAdTypeOnCooldown = true;
             adTypeCooldownRemainingMs = REWARDED_AD_COOLDOWN_MS - timeSinceAdTypeLastWatched;
             adTypeCooldownEndTime = Date.now() + adTypeCooldownRemainingMs;
         }
    }

    // Set Button State
    button.disabled = false; // Default enabled

    if (isQuestOnCooldown) {
        const formatter = questCooldownRemainingMs > 3600000 ? formatMillisecondsToHHMMSS : formatMillisecondsToMMSS;
        button.className = 'claimed-button'; // Use specific class for styling
        button.textContent = `Wait ${formatter(questCooldownRemainingMs)}`;
        button.disabled = true;
        trackCooldownItem(questId, listItemElement, questCooldownEndTime, 'quest');
    } else if (isQuestClaimed && !isAdBased) {
        button.className = 'claimed-button';
        button.textContent = 'Claimed';
        button.disabled = true;
    } else if (isQuestCompleted && !isQuestClaimed && isAdBased) {
        button.className = 'claim-button active'; // Ready to claim
        button.textContent = 'Claim';
    } else { // Actionable state (GO or Ad Watch)
        button.className = 'go-button action-button'; // Use base action style
        if (isAdBased && isAdTypeOnCooldown) {
            const formattedTime = formatMillisecondsToMMSS(adTypeCooldownRemainingMs);
            button.textContent = `Wait ${formattedTime}`;
            button.disabled = true;
            trackCooldownItem(questId, listItemElement, adTypeCooldownEndTime, 'ad');
        } else {
            button.textContent = originalActionText; // GO or Watch Ad
            button.disabled = false;
        }
    }
}

// --- Unified Quest Button Click Handler ---
async function handleQuestButtonClick(event) {
    const button = event.target;
    const li = button.closest('.quest-item');
    if (!li || !button || button.disabled || button.textContent.startsWith('Wait ')) { return; }

    const questId = li.dataset.questId;
    const questType = li.dataset.questType;
    const reward = parseInt(button.dataset.questReward || '0');
    const link = button.dataset.questLink || '';
    const adLimit = parseInt(li.dataset.adLimit || '0');
    const adType = li.dataset.adType || '';

    debugLog(`[QUEST ACTION] Click: ${questId}`, { type: questType, btnClass: button.className });
    if (!firebaseInitialized || !db || !telegramUser?.id) { alert("System not ready."); return; }

    let userData = await fetchAndUpdateUserData(); // Fetch fresh data before action
    if (!userData) { alert("User data unavailable."); return; }
     // Ensure structures exist
     userData.adProgress = userData.adProgress || {};
     userData.adCooldowns = userData.adCooldowns || {};
     userData.claimedQuests = userData.claimedQuests || [];


    if (button.classList.contains('claim-button')) {
        await claimQuestReward(questId, reward, questType, button, li, userData);
    } else if (button.classList.contains('go-button')) {
        if (questType === 'ads') {
            await watchAdForQuest(questId, adType, adLimit, button, li, userData);
        } else {
            await completeLinkQuest(questId, reward, link, button, li, userData);
        }
    } else if (button.classList.contains('claimed-button')) {
        // Button shows "Claimed" - no action needed
         debugLog(`[QUEST ACTION] Clicked on permanently claimed button: ${questId}.`);
    } else {
         debugLog(`[QUEST ACTION WARN] Clicked button with unexpected class: ${questId}: ${button.className}`);
    }
}

// --- Specific Action Handlers (claimQuestReward, watchAdForQuest, completeLinkQuest) ---
// Keep the logic generally the same as the original, but use Storage abstraction where appropriate.
// Example modification for claimQuestReward:
async function claimQuestReward(questId, reward, questType, button, li, userData) {
    debugLog(`[QUEST CLAIM] Attempting: ${questId}`);
    button.disabled = true; button.textContent = 'Claiming...';

    // Use Storage.updateItems for atomic update
    const updates = {
        gems: firebase.firestore.FieldValue.increment(reward)
    };

    try {
        if (questType !== 'ads') {
            debugLog(`[QUEST CLAIM WARN] Claim called for non-ad quest: ${questId}`);
            updates.claimedQuests = firebase.firestore.FieldValue.arrayUnion(questId);
        } else {
            // Ad Quest Claim Logic (Check progress, cooldown)
            const adProgress = userData.adProgress?.[questId];
            if (!adProgress) throw new Error("Ad progress missing.");
            const adLimit = parseInt(li.dataset.adLimit || '0');
            if (adProgress.watched < adLimit) throw new Error("Quest not completed.");
             // Check claimed status and cooldown (allow re-claim if cooldown over)
             const lastClaimedTime = safeConvertToDate(adProgress.lastClaimed)?.getTime() || 0;
             if (adProgress.claimed && (Date.now() - lastClaimedTime < QUEST_REPEAT_COOLDOWN_MS)) {
                 throw new Error("Quest already claimed and on cooldown.");
             }

            updates[`adProgress.${questId}.claimed`] = true;
            updates[`adProgress.${questId}.lastClaimed`] = firebase.firestore.FieldValue.serverTimestamp();
             debugLog(`[QUEST CLAIM] Ad quest ${questId} updates prepared.`);
        }

        const success = await Storage.updateItems(updates);
        if (!success) throw new Error("Firestore update failed via Storage abstraction.");

        debugLog(`[QUEST CLAIM] Success: ${questId}. Awarded ${reward} gems.`);
        if (analytics) analytics.logEvent('quest_claimed', { userId: telegramUser.id, questId, reward, questType });
        alert(`Reward claimed! +${reward} Gems.${questType === 'ads' ? ' Quest available again later.' : ''}`);

        // Update UI
        await fetchAndUpdateUserData(); // Refresh cache
        await updateUserStatsUI();      // Update global stats
        updateQuestItemUI(questId, li); // Update specific item (shows cooldown if applicable)

    } catch (error) {
        debugLog(`[QUEST CLAIM ERROR] ${questId}: ${error.message}`);
        alert(`Failed to claim reward: ${error.message}`);
        await fetchAndUpdateUserData(); // Ensure latest state after error
        updateQuestItemUI(questId, li); // Update UI based on potentially failed attempt
    }
}

// watchAdForQuest and completeLinkQuest would be similarly adapted,
// ensuring they use Storage.updateItems or runTransaction if needed.
// Keep the showAd function logic as it interacts with the external Monetag SDK.

// --- Daily Bonus Logic ---
function checkDailyBonusStatus() {
    if (!currentUserData) return; // No data to check

    const lastClaimTimestamp = safeConvertToDate(currentUserData.lastDailyBonusClaim)?.getTime();
    if (!lastClaimTimestamp) {
        // Never claimed before or invalid data
        dailyBonusClaimedToday = false;
        dailyBonusCooldownEnd = 0;
        // debugLog("[BONUS] Ready: Never claimed before.");
        return;
    }

    const now = Date.now();
    const timeSinceLastClaim = now - lastClaimTimestamp;

    if (timeSinceLastClaim >= DAILY_BONUS_COOLDOWN_MS) {
        // Cooldown period has passed
        dailyBonusClaimedToday = false;
        dailyBonusCooldownEnd = 0;
        // debugLog("[BONUS] Ready: Cooldown finished.");
    } else {
        // Still within cooldown
        dailyBonusClaimedToday = true;
        dailyBonusCooldownEnd = lastClaimTimestamp + DAILY_BONUS_COOLDOWN_MS;
        // debugLog("[BONUS] Cooldown active.");
    }
     updateDailyBonusUI(); // Update UI based on check
}

function updateDailyBonusUI() {
    const bonusSection = document.getElementById('dailyBonusSection');
    const claimButton = document.getElementById('claimDailyBonusButton');
    const timerEl = document.getElementById('dailyBonusTimer');
    if (!bonusSection || !claimButton || !timerEl) return;

    if (!dailyBonusClaimedToday) {
        bonusSection.style.display = 'block';
        claimButton.disabled = false;
        claimButton.textContent = `Claim ${DAILY_BONUS_GEMS} Gems!`;
        timerEl.textContent = '';
        timerEl.style.display = 'none';
    } else {
        bonusSection.style.display = 'block'; // Keep section visible to show timer
        claimButton.disabled = true;
        claimButton.textContent = 'Claimed Today';
        timerEl.style.display = 'block';
        updateDailyBonusTimerUI(); // Start/update timer display
    }
}

function updateDailyBonusTimerUI() {
     if (!dailyBonusClaimedToday) return; // No timer needed if claimable

     const timerEl = document.getElementById('dailyBonusTimer');
     if (!timerEl) return;

     const now = Date.now();
     const remainingMs = dailyBonusCooldownEnd - now;

     if (remainingMs <= 0) {
         // Cooldown finished while timer was running - should trigger full check soon
         timerEl.textContent = 'Bonus Available!';
         // Optionally directly set dailyBonusClaimedToday = false and update UI fully?
         checkDailyBonusStatus(); // Re-check and update main UI
     } else {
         timerEl.textContent = `Next bonus in: ${formatMillisecondsToHHMMSS(remainingMs)}`;
     }
}

async function handleDailyBonusClaim() {
    debugLog("[BONUS] Attempting to claim daily bonus...");
    const claimButton = document.getElementById('claimDailyBonusButton');
    if (!claimButton || claimButton.disabled) return;

    if (!firebaseInitialized || !db || !telegramUser?.id) { alert("System not ready."); return; }
    if (dailyBonusClaimedToday) { alert("Bonus already claimed today."); return; } // Extra check

    claimButton.disabled = true; claimButton.textContent = 'Claiming...';

    const updates = {
        gems: firebase.firestore.FieldValue.increment(DAILY_BONUS_GEMS),
        lastDailyBonusClaim: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const success = await Storage.updateItems(updates);
        if (!success) throw new Error("Failed to update data.");

        debugLog(`[BONUS] Claim successful! +${DAILY_BONUS_GEMS} Gems.`);
        alert(`Daily bonus claimed! You received ${DAILY_BONUS_GEMS} Gems.`);
        if (analytics) analytics.logEvent('claim_daily_bonus', { userId: telegramUser.id, gems: DAILY_BONUS_GEMS });

        // Update state and UI
        await fetchAndUpdateUserData(); // Fetches new data and calls checkDailyBonusStatus -> updateDailyBonusUI
        await updateUserStatsUI(); // Update gem count in header

    } catch (error) {
        debugLog(`[BONUS ERROR] Claim failed: ${error.message}`);
        alert(`Failed to claim bonus: ${error.message}`);
        // Re-enable button if claim failed but it *should* be claimable
        const latestUserData = await fetchAndUpdateUserData(); // Get latest state
        checkDailyBonusStatus(); // Update claim status based on latest data
        updateDailyBonusUI(); // Refresh UI (button might re-enable if check says it's ready)
    }
}

// --- Wallet Section Logic ---
// Keep initializeTONConnect, updateWalletConnectionStatusUI, handleConnectClick,
// updateWalletSectionUI, updateTransactionHistory, setupWithdrawModal largely the same,
// just ensure they reference the new CSS classes if needed and update debug logs.
// **Make sure withdrawal simulation messages are clear.**

// --- Invite Section Logic ---
// Keep generateReferralLink (!!! REMEMBER TO SET BOT USERNAME !!!), handleReferral,
// setupInviteButtons, handleInviteFriendClick, handleCopyLinkClick, handleClaimCreditsClick
// largely the same. Update element selectors if IDs/classes changed significantly.
// Ensure Storage abstraction is used for Firestore updates.

// --- Chest Section Logic ---
// Keep renderChests, updateChestUI, prevChest, nextChest, openChest largely the same.
// Make sure image paths point to new assets (`*-aqua.png`).
// Ensure `openChest` updates both `userData` and `users` (ranking) collections atomically using a transaction.

// --- Top Section Logic ---
// Keep `updateTopSectionUI` logic. Ensure it uses the correct collection ('users')
// and fields ('foxMedals', 'username', 'photoUrl'). Style `.current-user` in CSS.

// --- Profile Section Logic ---
async function updateProfileSectionUI() {
     debugLog("[PROFILE UI] Updating Profile section...");
     const usernameEl = document.getElementById('profile-username');
     const useridEl = document.getElementById('profile-userid');
     const joindateEl = document.getElementById('profile-joindate');
     const vipEl = document.getElementById('profile-vip');
     const questsEl = document.getElementById('profile-quests');
     const invitesEl = document.getElementById('profile-invites');
     const avatarEl = document.getElementById('profile-avatar'); // Already updated by updateProfilePicture

     if (!usernameEl || !useridEl || !joindateEl || !vipEl || !questsEl || !invitesEl) {
         debugLog("[PROFILE UI ERROR] Missing profile elements."); return;
     }

     const userData = currentUserData || await fetchAndUpdateUserData();
     if (!userData) {
         debugLog("[PROFILE UI WARN] No user data available.");
         usernameEl.textContent = 'Error';
         useridEl.textContent = 'N/A';
         // Clear other fields or show 'N/A'
         return;
     }

     try {
        usernameEl.textContent = userData.username || telegramUser?.username || telegramUser?.first_name || 'User';
        useridEl.textContent = telegramUser?.id || 'Unknown';
        const joinDate = safeConvertToDate(userData.createdAt);
        joindateEl.textContent = joinDate ? joinDate.toLocaleDateString() : 'Unknown';
        vipEl.textContent = userData.vipLevel || 0;
        // Calculate stats (example - needs accurate tracking if implemented fully)
        questsEl.textContent = (userData.claimedQuests?.length || 0) + Object.values(userData.adProgress || {}).filter(p => p.claimed).length; // Simplistic count
        invitesEl.textContent = userData.referrals || 0;

         debugLog("[PROFILE UI] Profile section updated.");
     } catch (error) {
         debugLog(`[PROFILE UI ERROR] Failed to populate profile: ${error.message}`);
          usernameEl.textContent = 'Error Loading';
     }
}


// --- Header Menu Modal Logic ---
function setupHeaderMenu() {
    const menuButton = document.getElementById('headerMenuButton');
    const menuModal = document.getElementById('headerMenuModal');
    const closeButton = document.getElementById('menuCloseButton');
    const walletButton = document.getElementById('menuWalletButton'); // Example

    if (!menuButton || !menuModal || !closeButton || !walletButton) {
         debugLog("[MENU WARN] Header menu elements missing.");
         return;
    }

    menuButton.addEventListener('click', () => {
        menuModal.style.display = 'flex';
    });

    closeButton.addEventListener('click', () => {
         menuModal.style.display = 'none';
    });

    // Example action: Open wallet connect/disconnect
    walletButton.addEventListener('click', () => {
        menuModal.style.display = 'none'; // Close menu
        handleConnectClick(); // Trigger wallet action from Wallet section logic
    });

     // Close modal if clicking outside the content
     menuModal.addEventListener('click', (event) => {
         if (event.target === menuModal) {
             menuModal.style.display = 'none';
         }
     });
    debugLog("[MENU] Header menu setup complete.");
}

// --- Notification Indicator Logic ---
function updateNotificationIndicators() {
    // debugLog("[NOTIFY] Updating indicators..."); // Can be noisy
    const headerIndicator = document.getElementById('notification-indicator');
    const profileIndicator = document.getElementById('profile-notification-indicator'); // Example if needed
    if (!headerIndicator || !profileIndicator) return;

    let showHeaderDot = false;
    let showProfileDot = false; // Example

    // Check daily bonus
    if (!dailyBonusClaimedToday) showHeaderDot = true;

    // Check claimable quests (simplified check)
    if (currentUserData?.adProgress) {
        const quests = Object.entries(currentUserData.adProgress);
        for (const [questId, progress] of quests) {
            // Needs corresponding adLimit data - this check is difficult without full quest context here
            // Placeholder: Assume if claimed=false and watched>0, it might be claimable soon
            // A better approach would involve fetching quest config or storing adLimit with progress
            // if (!progress.claimed && progress.watched > 0) {
            //     showHeaderDot = true;
            //     break;
            // }
        }
    }

    // Check claimable credits
     const minimumClaimCredits = 10000;
     if ((currentUserData?.referralCredits || 0) >= minimumClaimCredits) {
         showHeaderDot = true;
     }

    // Update indicator visibility
    headerIndicator.style.display = showHeaderDot ? 'block' : 'none';
    // profileIndicator.style.display = showProfileDot ? 'block' : 'none'; // If used
}


// --- App Initialization Sequence ---
async function initializeApp() {
    debugLog("--- Aqua Spark App Initialization Start ---");
    const loadingOverlay = document.getElementById('loadingOverlay');
    if(loadingOverlay) loadingOverlay.style.display = 'flex';

    try {
        initializeTelegram(); // Setup Telegram interface first

        // Crucial: Initialize Firebase (halts on failure)
        const firebaseSuccess = await initializeFirebase();
        if (!firebaseSuccess) {
            debugLog("[INIT ERROR] Firebase failed. Halting initialization.");
            // Loading overlay shows error from initializeFirebase
            return;
        }

        // Setup basic UI elements independent of user data
        setupHeaderMenu();
        renderChests(); // Render chest structure

        // Initialize User Data (fetch/create) & Handle Referral (needs user ID)
        await ensureFirebaseReady(async () => {
            await initializeUserData();
            await handleReferral(); // Process after user init
        }, 'UserInitAndReferral');

        // Generate referral link (needs user ID set by initializeTelegram/initializeUserData)
        generateReferralLink(); // Call after user ID is available

        // Initialize TON Connect (can run while other things happen)
        // No need to await fully here, UI updates handle its state changes
        initializeTONConnect();

        // Setup Navigation (loads default section 'earn' and its data)
        setupNavigation(); // Calls switchSection -> updateEarnSectionUI -> startCooldownUpdater

        // Setup Listeners for static elements (debug toggle, daily bonus)
        const toggleDebug = document.getElementById('toggleDebugButton');
        if (toggleDebug) {
            toggleDebug.onclick = () => {
                const console = document.getElementById('debugConsole');
                console.style.display = console.style.display === 'none' ? 'block' : 'none';
            };
        }
        const dailyBonusButton = document.getElementById('claimDailyBonusButton');
        if (dailyBonusButton) {
            // Use cloning for safety
            const newBonusBtn = dailyBonusButton.cloneNode(true);
            dailyBonusButton.parentNode.replaceChild(newBonusBtn, dailyBonusButton);
            newBonusBtn.addEventListener('click', handleDailyBonusClaim);
        }

        // --- Initialize Automatic Ads (Monetag In-App) ---
        // Run this later in the sequence
        try {
            if (typeof window.show_9180370 === 'function') {
                // Example Settings - Adjust frequency/capping as needed
                const autoInAppSettings = { frequency: 2, capping: 0.08, interval: 45, timeout: 7, everyPage: false };
                debugLog('[AD INIT] Initializing automatic In-App ads with settings:', JSON.stringify(autoInAppSettings));
                window.show_9180370({ type: 'inApp', inAppSettings: autoInAppSettings });
            } else {
                debugLog('[AD INIT WARN] Monetag SDK function not found, cannot initialize automatic ads.');
            }
        } catch (initAdError) {
            debugLog(`[AD INIT ERROR] ${initAdError.message}`);
        }

        // Final UI updates (stats, notifications) after everything is likely ready
        await ensureFirebaseReady(updateUserStatsUI, 'finalUserStatsUpdate');
        updateNotificationIndicators(); // Update dots based on initial state

        debugLog("--- Aqua Spark App Initialization Finished ---");
        if (analytics) analytics.logEvent('app_load', { userId: telegramUser?.id?.toString() || 'unknown', theme: 'aqua' });

    } catch (error) {
         console.error("CRITICAL ERROR during app initialization:", error);
         debugLog(`[CRITICAL INIT ERROR] ${error.message}\n${error.stack}`);
         alert("An error occurred during app startup. Please restart.");
         if(loadingOverlay) loadingOverlay.textContent = 'Initialization Error. Please Restart.';
         // Keep overlay on critical failure
         return; // Stop execution
    } finally {
        // Hide loading overlay only on successful completion or non-critical failure path if added
        if(loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// --- DOMContentLoaded Listener ---
function runOnLoaded() {
     debugLog("DOM loaded state reached.");
     initializeApp(); // Start the main initialization
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(runOnLoaded, 0); // Already loaded
} else {
    document.addEventListener('DOMContentLoaded', runOnLoaded);
}

// --- Add Fallback Handlers for Quest/Chest/Ranking Images ---
// This is a simple way, better handled within the rendering functions' onerror
document.addEventListener('error', (event) => {
    const target = event.target;
    // Check if the target is an image within specific sections
    if (target.tagName === 'IMG') {
        const parentClasses = target.parentElement?.classList;
        const grandParentClasses = target.parentElement?.parentElement?.classList;

        if (parentClasses?.contains('quest-item') || grandParentClasses?.contains('quest-item')) {
             if (target.src !== 'assets/icons/quest_placeholder_aqua.png') { // Avoid infinite loop
                 target.src = 'assets/icons/quest_placeholder_aqua.png';
                 debugLog(`[Image Fallback] Quest icon failed, using placeholder.`);
             }
        } else if (parentClasses?.contains('chest-image') || grandParentClasses?.contains('chest-image')) {
             if (target.src !== 'assets/icons/chest_placeholder_aqua.png') {
                 target.src = 'assets/icons/chest_placeholder_aqua.png';
                 debugLog(`[Image Fallback] Chest image failed, using placeholder.`);
             }
        } else if (target.classList.contains('rank-avatar')) {
             if (target.src !== 'assets/icons/user-avatar-aqua.png') {
                 target.src = 'assets/icons/user-avatar-aqua.png';
                 debugLog(`[Image Fallback] Rank avatar failed, using placeholder.`);
             }
        }
         // Add more fallback rules if needed
    }
}, true); // Use capture phase to catch errors early

// --- END OF SCRIPT ---
