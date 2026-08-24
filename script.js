/**
 * ==============================================================================
 * Sales Analytics Dashboard - Main JavaScript Application
 * ==============================================================================
 * Features:
 * 1. Supabase RPC API Fetching & Caching
 * 2. Section Navigation & Tab Switching (Dashboard, Sales Report, Daily Metrics, Settings)
 * 3. CSV Data Export
 * 4. Interactive Chart.js Rendering (Line Trend & Bar Chart)
 * 5. Educational inline comments throughout
 * ==============================================================================
 */

// Global configuration & API endpoints
const SUPABASE_URL = "https://xkttoeewkaqqukrqnsik.supabase.co/rest/v1/rpc/get_sale_dashboard";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrdHRvZWV3a2FxcXVrcnFuc2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTg2NDAsImV4cCI6MjEwMTQzNDY0MH0.sf_689gVJYs7V5oKAhOkyExgnlrZ96oobJ85i-eAhCk";

// Cached dashboard dataset object stored globally to allow instant section switching without refetching
let currentDashboardData = null;

// Chart.js instances to allow destruction and re-creation when refetching
let dashboardChartInstance = null;
let repBarChartInstance = null;
let dailyMetricsChartInstance = null;

// Track active view section ("dashboard", "sales-report", "daily-metrics", "settings")
let currentActiveSection = "dashboard";

// ==============================================================================
// 1. INITIALIZATION & EVENT LISTENERS
// ==============================================================================

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadDashboardData();
});

/**
 * Sets up event listeners for date pickers, refresh, theme toggle, and sidebar navigation.
 */
function setupEventListeners() {
  const dateInput = document.getElementById("report-date");
  const refreshBtn = document.getElementById("refresh-btn");
  const themeToggle = document.getElementById("theme-toggle");
  const retryBtn = document.getElementById("retry-btn");

  // Top Bar Date Picker Change
  dateInput.addEventListener("change", () => {
    // Sync settings date picker value
    const settingsDateInput = document.getElementById("settings-date-input");
    if (settingsDateInput) settingsDateInput.value = dateInput.value;
    loadDashboardData();
  });

  // Top Bar Refresh Button
  refreshBtn.addEventListener("click", () => {
    const refreshIcon = document.getElementById("refresh-icon");
    refreshIcon.classList.add("fa-spin");
    loadDashboardData().finally(() => {
      setTimeout(() => refreshIcon.classList.remove("fa-spin"), 500);
    });
  });

  // Theme Toggle Button
  themeToggle.addEventListener("click", toggleTheme);
  retryBtn.addEventListener("click", () => loadDashboardData());

  // Setup Sidebar Navigation Links
  const navItems = document.querySelectorAll(".nav-item[data-section]");
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetSection = item.getAttribute("data-section");
      switchSection(targetSection);
    });
  });

  // Setup Export Data Nav Item
  const exportBtn = document.getElementById("nav-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", (e) => {
      e.preventDefault();
      exportDataToCSV();
    });
  }

  // Setup Settings Section Controls
  const settingsThemeBtn = document.getElementById("settings-theme-btn");
  if (settingsThemeBtn) {
    settingsThemeBtn.addEventListener("click", toggleTheme);
  }

  const settingsApplyBtn = document.getElementById("settings-apply-btn");
  if (settingsApplyBtn) {
    settingsApplyBtn.addEventListener("click", () => {
      const settingsDateInput = document.getElementById("settings-date-input");
      if (settingsDateInput) {
        document.getElementById("report-date").value = settingsDateInput.value;
      }
      loadDashboardData();
    });
  }
}

// ==============================================================================
// 2. NAVIGATION & SECTION SWITCHING
// ==============================================================================

/**
 * Switches the visible content section instantly without reloading the page.
 * Demonstrates: DOM class toggling (active state) and section visibility.
 */
function switchSection(sectionName) {
  currentActiveSection = sectionName;

  // 1. Update active class on sidebar navigation links
  const navItems = document.querySelectorAll(".nav-item[data-section]");
  navItems.forEach(item => {
    if (item.getAttribute("data-section") === sectionName) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // 2. Hide all section containers
  const sections = document.querySelectorAll(".dashboard-section");
  sections.forEach(sec => sec.classList.add("hidden"));

  // 3. Show targeted section container
  const targetSection = document.getElementById(`section-${sectionName}`);
  if (targetSection) {
    targetSection.classList.remove("hidden");
  }

  // 4. Update top bar titles to reflect active view
  updateHeaderTitles(sectionName);

  // 5. Render section-specific views using cached data if available
  if (currentDashboardData) {
    if (sectionName === "sales-report") {
      renderSalesReportSection(currentDashboardData);
    } else if (sectionName === "daily-metrics") {
      renderDailyMetricsSection(currentDashboardData);
    }
  }
}

/**
 * Updates page title and subtitle according to selected nav item.
 */
function updateHeaderTitles(sectionName) {
  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");

  switch (sectionName) {
    case "dashboard":
      title.textContent = "Sales Dashboard";
      subtitle.textContent = "Real-time revenue breakdown & key performance indicators";
      break;
    case "sales-report":
      title.textContent = "Sales Representative Report";
      subtitle.textContent = "Month-to-date performance and representative metrics breakdown";
      break;
    case "daily-metrics":
      title.textContent = "Daily Metrics Log";
      subtitle.textContent = "Day-by-day sales volume and revenue history";
      break;
    case "settings":
      title.textContent = "Settings & Preferences";
      subtitle.textContent = "Manage report date selection and visual theme settings";
      break;
  }
}

// ==============================================================================
// 3. DATA FETCHING (SUPABASE RPC API)
// ==============================================================================

async function loadDashboardData() {
  const dateInput = document.getElementById("report-date");
  const selectedDate = dateInput.value || "2026-05-26";

  showStatusBanner("loading", "Fetching sales data from Supabase...");

  try {
    const response = await fetch(SUPABASE_URL, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ report_date: selectedDate })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      throw new Error("No data returned from RPC endpoint.");
    }

    // Cache the dataset globally
    currentDashboardData = data[0];

    hideStatusBanner();

    // Render components for the active view
    updateSummaryCards(currentDashboardData);
    updateKeyInsights(currentDashboardData);
    renderDashboardChart(currentDashboardData.daily_metrics || []);
    renderLeaderboard(currentDashboardData.leaderboard_metrics || []);

    // Also update Sales Report and Daily Metrics if currently active
    if (currentActiveSection === "sales-report") {
      renderSalesReportSection(currentDashboardData);
    } else if (currentActiveSection === "daily-metrics") {
      renderDailyMetricsSection(currentDashboardData);
    }

  } catch (error) {
    console.error("[Fetch Error]:", error);
    showStatusBanner("error", `Failed to load sales data: ${error.message}`);
  }
}

// ==============================================================================
// 4. RENDERING FUNCTIONS FOR DASHBOARD VIEW
// ==============================================================================

function updateSummaryCards(data) {
  const kpiCards = data.kpi_cards || {};
  const dailyMetrics = data.daily_metrics || [];

  const totalRevenue = kpiCards.MTD_REVENUE || 0;
  document.getElementById("val-revenue").textContent = formatCurrency(totalRevenue);

  const totalOrders = kpiCards.mtd_sales || 0;
  document.getElementById("val-orders").textContent = formatNumber(totalOrders);

  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  document.getElementById("val-aov").textContent = formatCurrency(avgOrderValue);

  if (dailyMetrics.length > 0) {
    const bestDay = dailyMetrics.reduce((max, current) => (current.total_revenue > max.total_revenue ? current : max), dailyMetrics[0]);
    document.getElementById("val-best-day").textContent = formatDateShort(bestDay.order_date);
    document.getElementById("val-best-day-sub").textContent = `${formatCurrency(bestDay.total_revenue)} revenue`;
  } else {
    document.getElementById("val-best-day").textContent = "N/A";
    document.getElementById("val-best-day-sub").textContent = "$0.00 revenue";
  }
}

function updateKeyInsights(data) {
  const insightsList = document.getElementById("insights-list");
  const dailyMetrics = data.daily_metrics || [];
  const leaderboard = data.leaderboard_metrics || [];

  const insights = [];

  if (dailyMetrics.length > 0) {
    const bestDay = dailyMetrics.reduce((max, curr) => (curr.total_revenue > max.total_revenue ? curr : max), dailyMetrics[0]);
    insights.push(
      `Peak monthly revenue of <strong>${formatCurrency(bestDay.total_revenue)}</strong> was achieved on <strong>${formatDateFull(bestDay.order_date)}</strong> with <strong>${bestDay.no_of_sales}</strong> completed sales.`
    );
  }

  if (leaderboard.length > 0) {
    const sortedReps = [...leaderboard].sort((a, b) => (b.mtd_revenue || 0) - (a.mtd_revenue || 0));
    const topRep = sortedReps[0];
    insights.push(
      `Top performing representative <strong>${topRep.sales_representative.trim()}</strong> generated <strong>${formatCurrency(topRep.mtd_revenue)}</strong> across <strong>${topRep.mtd_sales}</strong> total orders.`
    );
  }

  if (dailyMetrics.length > 0) {
    const totalDailyRev = dailyMetrics.reduce((sum, item) => sum + (item.total_revenue || 0), 0);
    const avgDailyRev = totalDailyRev / dailyMetrics.length;
    insights.push(
      `Average daily revenue across <strong>${dailyMetrics.length}</strong> active days stands at <strong>${formatCurrency(avgDailyRev)}</strong> per day.`
    );
  }

  insightsList.innerHTML = insights.map(insight => `<li>${insight}</li>`).join("");
}

function renderDashboardChart(dailyMetrics) {
  const canvas = document.getElementById("revenueChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  if (dashboardChartInstance) dashboardChartInstance.destroy();

  const sortedMetrics = [...dailyMetrics].sort((a, b) => new Date(a.order_date) - new Date(b.order_date));
  const labels = sortedMetrics.map(item => formatDateShort(item.order_date));
  const revenueData = sortedMetrics.map(item => item.total_revenue || 0);

  dashboardChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Daily Revenue ($)",
          data: revenueData,
          borderColor: "#ff6b35",
          borderWidth: 2,
          backgroundColor: "rgba(255, 107, 53, 0.1)",
          fill: true,
          tension: 0.1,
          pointBackgroundColor: "#ff6b35",
          pointRadius: 3
        }
      ]
    },
    options: createCommonChartOptions()
  });
}

function renderLeaderboard(leaderboardMetrics) {
  const tbody = document.getElementById("leaderboard-body");
  if (!tbody) return;

  if (!leaderboardMetrics || leaderboardMetrics.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center">No representative data available</td></tr>`;
    return;
  }

  const sortedReps = [...leaderboardMetrics].sort((a, b) => (b.mtd_revenue || 0) - (a.mtd_revenue || 0));

  tbody.innerHTML = sortedReps
    .map((rep, index) => `
      <tr>
        <td>
          <span class="rep-rank">${index + 1}.</span>
          <strong>${rep.sales_representative ? rep.sales_representative.trim() : "Unknown"}</strong>
        </td>
        <td>${formatNumber(rep.mtd_sales || 0)}</td>
        <td><strong>${formatCurrency(rep.mtd_revenue || 0)}</strong></td>
      </tr>
    `)
    .join("");
}

// ==============================================================================
// 5. RENDERING FUNCTIONS FOR SALES REPORT VIEW
// ==============================================================================

function renderSalesReportSection(data) {
  const leaderboard = data.leaderboard_metrics || [];

  // Render Bar Chart
  renderRepBarChart(leaderboard);

  // Render Detailed Leaderboard Table
  renderSalesReportTable(leaderboard);
}

function renderRepBarChart(leaderboardMetrics) {
  const canvas = document.getElementById("repBarChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  if (repBarChartInstance) repBarChartInstance.destroy();

  const sortedReps = [...leaderboardMetrics].sort((a, b) => (b.mtd_revenue || 0) - (a.mtd_revenue || 0));
  const labels = sortedReps.map(rep => rep.sales_representative ? rep.sales_representative.trim() : "Unknown");
  const revenueData = sortedReps.map(rep => rep.mtd_revenue || 0);

  repBarChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "MTD Revenue ($)",
          data: revenueData,
          backgroundColor: "#ff6b35",
          borderColor: "#ff6b35",
          borderWidth: 1
        }
      ]
    },
    options: createCommonChartOptions()
  });
}

function renderSalesReportTable(leaderboardMetrics) {
  const tbody = document.getElementById("sales-report-table-body");
  if (!tbody) return;

  if (!leaderboardMetrics || leaderboardMetrics.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">No representative data available</td></tr>`;
    return;
  }

  const sortedReps = [...leaderboardMetrics].sort((a, b) => (b.mtd_revenue || 0) - (a.mtd_revenue || 0));

  tbody.innerHTML = sortedReps
    .map((rep, index) => `
      <tr>
        <td><strong>${index + 1}</strong></td>
        <td><strong>${rep.sales_representative ? rep.sales_representative.trim() : "Unknown"}</strong></td>
        <td>${formatNumber(rep.mtd_sales || 0)}</td>
        <td><strong>${formatCurrency(rep.mtd_revenue || 0)}</strong></td>
        <td>${rep.today_sales ? formatNumber(rep.today_sales) : "-"}</td>
        <td>${rep.today_revenue ? formatCurrency(rep.today_revenue) : "-"}</td>
      </tr>
    `)
    .join("");
}

// ==============================================================================
// 6. RENDERING FUNCTIONS FOR DAILY METRICS VIEW
// ==============================================================================

function renderDailyMetricsSection(data) {
  const dailyMetrics = data.daily_metrics || [];

  // Render Full-Width Line Chart
  renderDailyMetricsChart(dailyMetrics);

  // Render Date-Wise Metrics Table
  renderDailyMetricsTable(dailyMetrics);
}

function renderDailyMetricsChart(dailyMetrics) {
  const canvas = document.getElementById("dailyMetricsChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  if (dailyMetricsChartInstance) dailyMetricsChartInstance.destroy();

  const sortedMetrics = [...dailyMetrics].sort((a, b) => new Date(a.order_date) - new Date(b.order_date));
  const labels = sortedMetrics.map(item => formatDateShort(item.order_date));
  const revenueData = sortedMetrics.map(item => item.total_revenue || 0);

  dailyMetricsChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Daily Revenue ($)",
          data: revenueData,
          borderColor: "#ff6b35",
          borderWidth: 2,
          backgroundColor: "rgba(255, 107, 53, 0.1)",
          fill: true,
          tension: 0.1
        }
      ]
    },
    options: createCommonChartOptions()
  });
}

function renderDailyMetricsTable(dailyMetrics) {
  const tbody = document.getElementById("daily-metrics-table-body");
  if (!tbody) return;

  if (!dailyMetrics || dailyMetrics.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center">No daily metrics available</td></tr>`;
    return;
  }

  const sortedMetrics = [...dailyMetrics].sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

  tbody.innerHTML = sortedMetrics
    .map(item => {
      const avgPerSale = item.no_of_sales > 0 ? item.total_revenue / item.no_of_sales : 0;
      return `
        <tr>
          <td><strong>${formatDateFull(item.order_date)}</strong></td>
          <td>${formatNumber(item.no_of_sales)} sales</td>
          <td><strong>${formatCurrency(item.total_revenue)}</strong></td>
          <td>${formatCurrency(avgPerSale)}</td>
        </tr>
      `;
    })
    .join("");
}

// ==============================================================================
// 7. EXPORT DATA FUNCTIONALITY (CSV DOWNLOAD)
// ==============================================================================

/**
 * Generates and triggers download of daily sales metrics as a CSV file.
 * Demonstrates: Blob, URL.createObjectURL, anchor click automation.
 */
function exportDataToCSV() {
  if (!currentDashboardData || !currentDashboardData.daily_metrics) {
    alert("Dashboard data is still loading or unavailable.");
    return;
  }

  const dailyMetrics = currentDashboardData.daily_metrics;

  // Build CSV headers and rows
  let csvContent = "Date,Sales_Count,Total_Revenue,Avg_Revenue_Per_Sale\n";

  dailyMetrics.forEach(item => {
    const avg = item.no_of_sales > 0 ? (item.total_revenue / item.no_of_sales).toFixed(2) : "0.00";
    csvContent += `"${item.order_date}",${item.no_of_sales},${item.total_revenue},${avg}\n`;
  });

  // Create downloadable Blob link in browser
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `sales_metrics_${document.getElementById("report-date").value}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log("[CSV Export]: Sales metrics exported successfully!");
}

// ==============================================================================
// 8. HELPER & UTILITY FUNCTIONS
// ==============================================================================

function createCommonChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1a202c",
        titleColor: "#ffffff",
        bodyColor: "#ff6b35",
        padding: 10,
        borderColor: "#333333",
        borderWidth: 1,
        callbacks: {
          label: function (context) {
            return ` Revenue: ${formatCurrency(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#a0aec0", font: { family: "Arial, sans-serif", size: 11 } }
      },
      y: {
        grid: { color: "#2d3748" },
        ticks: {
          color: "#a0aec0",
          font: { family: "Arial, sans-serif", size: 11 },
          callback: function (value) {
            return `$${(value / 1000).toFixed(0)}k`;
          }
        }
      }
    }
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatDateShort(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateFull(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function showStatusBanner(type, message) {
  const banner = document.getElementById("status-banner");
  const icon = document.getElementById("status-icon");
  const text = document.getElementById("status-text");
  const retryBtn = document.getElementById("retry-btn");

  banner.classList.remove("hidden", "error");
  retryBtn.classList.add("hidden");
  text.textContent = message;

  if (type === "loading") {
    icon.className = "fa-solid fa-spinner fa-spin";
  } else if (type === "error") {
    banner.classList.add("error");
    icon.className = "fa-solid fa-circle-exclamation";
    retryBtn.classList.remove("hidden");
  }
}

function hideStatusBanner() {
  document.getElementById("status-banner").classList.add("hidden");
}

function toggleTheme() {
  const body = document.body;
  const themeIcon = document.getElementById("theme-icon");
  const currentTheme = body.getAttribute("data-theme");

  if (currentTheme === "light") {
    body.removeAttribute("data-theme");
    themeIcon.className = "fa-solid fa-moon";
  } else {
    body.setAttribute("data-theme", "light");
    themeIcon.className = "fa-solid fa-sun";
  }
}
