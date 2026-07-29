/* JARVIS Briefing — narrative-first health dashboard */

let trendChart = null;
let deferredPrompt = null;
let trendData = null;

document.addEventListener("DOMContentLoaded", () => {
  registerSW();
  setupNav();
  setupInstall();
  loadBrief();
  setupChartToggles();
});

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

function setupNav() {
  document.querySelectorAll("nav button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("nav button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const page = btn.dataset.page;
      document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
      document.getElementById("page-" + page).classList.add("active");
      if (page === "trend") loadTrend();
      if (page === "trip") loadTrip();
    });
  });
}

function setupInstall() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById("installBanner").classList.add("show");
  });
  document.getElementById("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const r = await deferredPrompt.userChoice;
    if (r.outcome === "accepted") document.getElementById("installBanner").classList.remove("show");
    deferredPrompt = null;
  });
  document.getElementById("dismissInstall").addEventListener("click", () => {
    document.getElementById("installBanner").classList.remove("show");
  });
}

async function api(path) {
  const apiUrl = `https://whoop-diet.alif-ahmad999.workers.dev${path}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

async function loadBrief() {
  try {
    const data = await api("/api/daily");
    document.getElementById("readinessScore").textContent = data.readiness_score;
    document.getElementById("readinessLabel").textContent = data.readiness_label;
    document.getElementById("narrativeSummary").textContent = data.recommendation;

    const scoreCircle = document.querySelector(".score-ring .fg");
    const scoreDashoffset = 450 - (data.readiness_score / 100) * 450;
    scoreCircle.style.strokeDashoffset = scoreDashoffset;

    // Update dot colors based on score
    const dotColors = {
      green: "--green",
      red: "--red",
      yellow: "--yellow",
      orange: "--orange",
    };

    document.getElementById("metricHrv").textContent = (data.metrics.hrv || '--') + ``;
    document.getElementById("metricRhr").textContent = (data.metrics.rhr || '--') + ``;
    document.getElementById("metricSleepHours").textContent = (data.metrics.sleep_hours || '--') + ``;
    document.getElementById("metricRecoveryScore").textContent = (data.metrics.recovery_score || '--') + ``;
    document.getElementById("metricDeepSleepHours").textContent = (data.metrics.deep_sleep_hours || '--') + ``;
    document.getElementById("metricStrainYesterday").textContent = (data.metrics.strain_yesterday || '--') + ``;
    document.getElementById("metricSpo2").textContent = (data.metrics.spo2 || '--') + ``;
    document.getElementById("metricSleepDeficit").textContent = (data.metrics.sleep_deficit_hours || '--') + ``;

    document.getElementById("currentDate").textContent = new Date(data.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Anomaly section
    const anomalySection = document.getElementById("anomalySection");
    const anomalyList = document.getElementById("anomalyList");
    anomalyList.innerHTML = '';
    if (data.anomalies && data.anomalies.length > 0) {
      anomalySection.style.display = 'block';
      data.anomalies.forEach(anomaly => {
        const li = document.createElement('li');
        li.textContent = anomaly;
        anomalyList.appendChild(li);
      });
    } else {
      anomalySection.style.display = 'none';
    }

    document.getElementById("content").style.display = 'block';
    document.querySelector(".page.active .loading").style.display = 'none';

  } catch (error) {
    console.error("Failed to load brief data:", error);
    document.getElementById("content").innerHTML = `<div class="error">${error.message}. Please reload.</div>`;
    document.querySelector(".page.active .loading").style.display = 'none';
  }
}

async function loadTrend() {
  try {
    document.querySelector("#page-trend .loading").style.display = 'flex';
    const data = await api("/api/trend");
    trendData = data.trends.sort((a,b) => new Date(a.date) - new Date(b.date));
    const dates = trendData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    const chartMetrics = {
        hrv: { label: 'HRV', borderColor: 'rgb(34, 197, 94)', unit: 'ms' },
        rhr: { label: 'RHR', borderColor: 'rgb(239, 68, 68)', unit: 'bpm' },
        recovery_score: { label: 'Recovery', borderColor: 'rgb(234, 179, 8)', unit: '%' },
        sleep_hours: { label: 'Sleep', borderColor: 'rgb(34, 197, 94)', unit: 'h' },
        strain: { label: 'Strain', borderColor: 'rgb(249, 115, 22)', unit: '' },
    };

    const currentMetric = document.querySelector('.chart-toggles button.active').dataset.metric || 'hrv';
    updateTrendChart(currentMetric, dates, trendData.map(d => d[currentMetric]));

    document.querySelector("#page-trend .loading").style.display = 'none';
  } catch (error) {
    console.error("Failed to load trend data:", error);
    document.querySelector("#page-trend .loading").innerHTML = `<div class="error">${error.message}. Please reload.</div>`;
  }
}

function setupChartToggles() {
  document.querySelectorAll('.chart-toggles button').forEach(button => {
    button.addEventListener('click', (e) => {
      document.querySelectorAll('.chart-toggles button').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      const metric = e.target.dataset.metric;
      const dates = trendData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      updateTrendChart(metric, dates, trendData.map(d => d[metric]));
    });
  });
}

function updateTrendChart(metric, labels, data) {
  const ctx = document.getElementById('trendChart').getContext('2d');

  if (trendChart) {
    trendChart.destroy();
  }

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: metric.charAt(0).toUpperCase() + metric.slice(1),
        data: data,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        pointBackgroundColor: '#fff',
        pointBorderColor: 'rgb(75, 192, 192)',
        fill: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: 'var(--text-dim)'
          }
        },
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: 'var(--text-dim)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

async function loadTrip() {
  try {
    document.querySelector("#page-trip .loading").style.display = 'flex';
    const data = await api("/api/trip");

    if (data && data.home && data.trip) {
      document.getElementById("tripHrv").textContent = (data.trip.hrv_avg !== undefined ? data.trip.hrv_avg.toFixed(1) : '--');
      document.getElementById("tripRhr").textContent = (data.trip.rhr_avg !== undefined ? data.trip.rhr_avg.toFixed(0) : '--');
      document.getElementById("tripRecovery").textContent = (data.trip.recovery_avg !== undefined ? data.trip.recovery_avg.toFixed(0) : '--') + `%`;
      document.getElementById("tripSleep").textContent = (data.trip.sleep_avg !== undefined ? data.trip.sleep_avg.toFixed(1) : '--') + `h`;

      document.getElementById("tripContent").style.display = 'block';
      document.querySelector("#page-trip .loading").style.display = 'none';
    } else {
      throw new Error("Trip data not fully available.");
    }
  } catch (error) {
    console.error("Failed to load trip data:", error);
    document.querySelector("#page-trip .loading").innerHTML = `<div class="error">${error.message}. Please reload.</div>`;
  }
}

document.getElementById("profileBtn").addEventListener("click", () => {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-profile").classList.add("active");

  // Load current profile data
  const profile = JSON.parse(localStorage.getItem("whoopProfile") || '{}');
  document.getElementById("profileName").value = profile.name || '';
  document.getElementById("profileHeight").value = profile.height || '';
  document.getElementById("profileWeight").value = profile.weight || '';
  document.getElementById("profileAge").value = profile.age || '';
  document.getElementById("profileHrvBaseline").value = profile.hrvBaseline || '';
});

document.getElementById("saveProfileBtn").addEventListener("click", () => {
  const profile = {
    name: document.getElementById("profileName").value,
    height: parseFloat(document.getElementById("profileHeight").value),
    weight: parseFloat(document.getElementById("profileWeight").value),
    age: parseInt(document.getElementById("profileAge").value),
    hrvBaseline: parseFloat(document.getElementById("profileHrvBaseline").value),
  };
  localStorage.setItem("whoopProfile", JSON.stringify(profile));
  alert("Profile saved! ");
  // Go back to brief page
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-brief").classList.add("active");
  loadBrief(); // Reload brief with new profile data
});

document.getElementById("cancelProfileBtn").addEventListener("click", () => {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-brief").classList.add("active");
});
