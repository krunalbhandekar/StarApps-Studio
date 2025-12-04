// Popup Dashboard Logic

let currentRange = "today";

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
  setupTimeSelector();
  loadDashboard();
});

// Setup time range selector
function setupTimeSelector() {
  const buttons = document.querySelectorAll(".time-selector button");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      currentRange = button.dataset.range;
      loadDashboard();
    });
  });
}

// Load dashboard data
async function loadDashboard() {
  try {
    const data = await chrome.storage.local.get(["activityData", "dailyData"]);
    const activityData = data.activityData || {};
    const dailyData = data.dailyData || {};

    const processedData = processData(activityData, dailyData, currentRange);
    renderDashboard(processedData);
  } catch (error) {
    showError();
  }
}

// Process data based on time range
function processData(activityData, dailyData, range) {
  const now = new Date();
  const today = getDateKey(now);

  let startDate;
  if (range === "today") {
    startDate = today;
  } else if (range === "week") {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startDate = getDateKey(weekAgo);
  } else if (range === "month") {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    startDate = getDateKey(monthAgo);
  }

  // Filter and aggregate data
  const domainStats = {};
  let totalTime = 0;
  let totalVisits = 0;

  // Use dailyData to get accurate visit counts per date range
  for (const dateKey in dailyData) {
    if (dateKey >= startDate && dateKey <= today) {
      const dayData = dailyData[dateKey];

      for (const domain in dayData.domains) {
        const timeForDay = dayData.domains[domain];

        if (!domainStats[domain]) {
          domainStats[domain] = {
            time: 0,
            visits: 0,
            lastVisit: activityData[domain]?.lastVisit || Date.now(),
          };
        }

        domainStats[domain].time += timeForDay;
        totalTime += timeForDay;
      }
    }
  }

  // Count visits from activityData for the date range
  for (const domain in activityData) {
    const domainData = activityData[domain];
    let visitsInRange = 0;

    // Count visits by checking dailyBreakdown dates
    for (const date in domainData.dailyBreakdown) {
      if (
        date >= startDate &&
        date <= today &&
        domainData.dailyBreakdown[date] > 0
      ) {
        // Estimate visits based on proportion of time in this date
        const proportion =
          domainData.dailyBreakdown[date] / domainData.totalTime;
        visitsInRange += Math.ceil(domainData.visits * proportion);
      }
    }

    if (domainStats[domain]) {
      domainStats[domain].visits = visitsInRange;
      totalVisits += visitsInRange;
    }
  }

  // Sort domains by time
  const sortedDomains = Object.entries(domainStats)
    .sort((a, b) => b[1].time - a[1].time)
    .slice(0, 10); // Top 10 sites

  return {
    totalTime,
    totalVisits,
    uniqueSites: sortedDomains.length,
    topSites: sortedDomains,
  };
}

// Format date key
function getDateKey(date) {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

// Format time display
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${secs}s`; // Show seconds if less than 1 minute
}

// Render dashboard
function renderDashboard(data) {
  const content = document.getElementById("content");

  if (data.topSites.length === 0) {
    content.innerHTML = `
     <div class="no-data">
       <div class="no-data-icon">📊</div>
       <p>No activity data yet</p>
       <p style="font-size: 12px; margin-top: 10px; color: #999;">
         Start browsing to see your stats!
       </p>
     </div>
   `;
    return;
  }

  const avgTimePerSite = Math.floor(data.totalTime / data.uniqueSites);

  content.innerHTML = `
   <div class="stats-grid">
     <div class="stat-card">
       <div class="stat-label">Total Time</div>
       <div class="stat-value">${formatTime(data.totalTime)}</div>
     </div>
     <div class="stat-card">
       <div class="stat-label">Sites Visited</div>
       <div class="stat-value">${data.uniqueSites}</div>
     </div>
     <div class="stat-card">
       <div class="stat-label">Avg per Site</div>
       <div class="stat-value">${formatTime(avgTimePerSite)}</div>
     </div>
     <div class="stat-card">
       <div class="stat-label">Total Visits</div>
       <div class="stat-value">${data.totalVisits}</div>
     </div>
   </div>


   <div class="sites-list">
     <div class="sites-header">Top Sites</div>
     ${data.topSites
       .map(
         ([domain, stats], index) => `
       <div class="site-item">
         <div class="site-info">
           <div class="site-icon" style="background: ${getColorForIndex(
             index
           )}"></div>
           <div>
             <div class="site-name">${domain}</div>
             <div class="site-visits">${stats.visits} visits</div>
           </div>
         </div>
         <div class="site-time">${formatTime(stats.time)}</div>
       </div>
     `
       )
       .join("")}
   </div>


   <div class="footer">
     <button class="clear-btn" id="clearData">Clear All Data</button>
   </div>
 `;

  // Add clear data functionality
  document.getElementById("clearData").addEventListener("click", clearAllData);
}

// Get color for domain (consistent hashing)
function getColorForIndex(index) {
  const colors = [
    "#667eea",
    "#f093fb",
    "#4facfe",
    "#43e97b",
    "#fa709a",
    "#fee140",
    "#30cfd0",
    "#a8edea",
    "#ff6b6b",
    "#4ecdc4",
  ];
  return colors[index % colors.length];
}

// Clear all data
async function clearAllData() {
  if (
    confirm(
      "Are you sure you want to clear all tracking data? This cannot be undone."
    )
  ) {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      activityData: {},
      dailyData: {},
      lastCleanup: Date.now(),
    });
    loadDashboard();
  }
}

// Show error state
function showError() {
  const content = document.getElementById("content");
  content.innerHTML = `
   <div class="no-data">
     <div class="no-data-icon">⚠️</div>
     <p>Error loading data</p>
     <p style="font-size: 12px; margin-top: 10px; color: #999;">
       Please try again
     </p>
   </div>
 `;
}
