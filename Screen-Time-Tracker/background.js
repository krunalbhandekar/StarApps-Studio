// Background Service Worker for Screen Time Tracker
// This tracks active tab usage and stores data locally

let currentTabId = null;
let currentDomain = null;
let sessionStartTime = null;
let isWindowFocused = true;

// Initialize on installation
chrome.runtime.onInstalled.addListener(() => {
  // Create alarm to save data periodically (every minute)
  chrome.alarms.create("saveActivity", { periodInMinutes: 1 });

  initializeStorage();
});

// Initialize storage with default structure
async function initializeStorage() {
  const result = await chrome.storage.local.get(["activityData", "dailyData"]);

  if (!result.activityData) {
    await chrome.storage.local.set({
      activityData: {},
      dailyData: {},
      lastCleanup: Date.now(),
    });
  }
}

// Extract domain from URL
function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return null;
  }
}

// Format date for storage keys (YYYY-MM-DD)
function getDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return date.toISOString().split("T")[0];
}

// Save current session when switching tabs or losing focus
async function saveCurrentSession() {
  if (!currentDomain || !sessionStartTime || !isWindowFocused) {
    return;
  }

  const sessionDuration = Date.now() - sessionStartTime;
  const durationInSeconds = Math.floor(sessionDuration / 1000);

  // Ignore very short sessions (less than 1 second)
  if (durationInSeconds < 1) {
    return;
  }

  const dateKey = getDateKey();
  const result = await chrome.storage.local.get(["activityData", "dailyData"]);

  let activityData = result.activityData || {};
  let dailyData = result.dailyData || {};

  // Initialize domain data if doesn't exist
  if (!activityData[currentDomain]) {
    activityData[currentDomain] = {
      totalTime: 0,
      visits: 0,
      lastVisit: Date.now(),
      dailyBreakdown: {},
    };
  }

  // Update total time and visits
  activityData[currentDomain].totalTime += durationInSeconds;
  activityData[currentDomain].visits += 1;
  activityData[currentDomain].lastVisit = Date.now();

  // Update daily breakdown for this domain
  if (!activityData[currentDomain].dailyBreakdown[dateKey]) {
    activityData[currentDomain].dailyBreakdown[dateKey] = 0;
  }
  activityData[currentDomain].dailyBreakdown[dateKey] += durationInSeconds;

  // Update daily summary
  if (!dailyData[dateKey]) {
    dailyData[dateKey] = {
      totalTime: 0,
      domains: {},
    };
  }
  dailyData[dateKey].totalTime += durationInSeconds;

  if (!dailyData[dateKey].domains[currentDomain]) {
    dailyData[dateKey].domains[currentDomain] = 0;
  }
  dailyData[dateKey].domains[currentDomain] += durationInSeconds;

  // Save to storage
  await chrome.storage.local.set({ activityData, dailyData });
}

// Start tracking a new tab
function startTracking(tabId, domain) {
  currentTabId = tabId;
  currentDomain = domain;
  sessionStartTime = Date.now();
}

// Handle tab activation (user switches to a different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Save previous session
  await saveCurrentSession();

  // Start new session
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const domain = getDomainFromUrl(tab.url);

    if (domain && isWindowFocused) {
      startTracking(activeInfo.tabId, domain);
    } else {
      currentTabId = null;
      currentDomain = null;
      sessionStartTime = null;
    }
  } catch (error) {
    console.error("Error in onActivated:", error);
  }
});

// Handle tab updates (URL changes in current tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tabId === currentTabId) {
    // Save previous session
    await saveCurrentSession();

    // Start new session with new URL
    const domain = getDomainFromUrl(changeInfo.url);
    if (domain && isWindowFocused) {
      startTracking(tabId, domain);
    } else {
      currentTabId = null;
      currentDomain = null;
      sessionStartTime = null;
    }
  }
});

// Handle window focus changes (user switches to another app)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost focus - user switched to another app
    await saveCurrentSession();
    isWindowFocused = false;
    sessionStartTime = null;
  } else {
    // Window gained focus - user came back to Chrome
    isWindowFocused = true;

    try {
      // Get current active tab in the focused window
      const tabs = await chrome.tabs.query({
        active: true,
        windowId: windowId,
      });
      if (tabs.length > 0) {
        const tab = tabs[0];
        const domain = getDomainFromUrl(tab.url);
        if (domain) {
          startTracking(tab.id, domain);
        }
      }
    } catch (error) {
      console.error("Error in onFocusChanged:", error);
    }
  }
});

// Periodic save via alarm (every minute)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "saveActivity") {
    saveCurrentSession();
    // Restart tracking for current tab (reset start time)
    if (currentDomain && isWindowFocused) {
      sessionStartTime = Date.now();
    }
  }
});

// Cleanup old data (keep last 90 days)
async function cleanupOldData() {
  const result = await chrome.storage.local.get(["dailyData", "lastCleanup"]);
  const lastCleanup = result.lastCleanup || 0;

  // Only cleanup once per day
  if (Date.now() - lastCleanup < 24 * 60 * 60 * 1000) {
    return;
  }

  const dailyData = result.dailyData || {};
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const cutoffKey = getDateKey(cutoffDate.getTime());

  let removedCount = 0;
  // Remove old entries
  for (const dateKey in dailyData) {
    if (dateKey < cutoffKey) {
      delete dailyData[dateKey];
      removedCount++;
    }
  }

  if (removedCount > 0) {
    await chrome.storage.local.set({
      dailyData,
      lastCleanup: Date.now(),
    });
  }
}

// Run cleanup on startup
cleanupOldData();

// Initialize tracking on startup
chrome.tabs
  .query({ active: true, currentWindow: true })
  .then((tabs) => {
    if (tabs.length > 0) {
      const domain = getDomainFromUrl(tabs[0].url);
      if (domain) {
        startTracking(tabs[0].id, domain);
      }
    }
  })
  .catch((error) => {
    console.error("Error initializing tracking:", error);
  });
