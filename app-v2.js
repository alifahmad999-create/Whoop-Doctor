/* Whoop Doctor — V1 Jarvis Clinical Dashboard */
/* Brief | Trend | Trip — three tabs, no Profile in nav */
/* UX Improvements + New Features */
/* Cache bust 2026-08-02 */

const CLIENT_ID = '48322298-970e-450e-a8ff-c953ce11178d';
const REDIRECT_URI = 'https://whoop-doctor.pages.dev/auth/callback';
const SCOPES = 'offline read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement';
const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const API_BASE = 'https://whoop-diet.alif-ahmad999.workers.dev';

const RING_CIRCUMFERENCE = 440;
const PI = Math.PI;

let currentBrief = null;
let currentTrend = null;
let lastFetchTime = null;
let isRefreshing = false;

/* ════════════════════════════════════════════
   INITIALIZATION
   ════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  if (handleCallback()) return;
  setupTabs();
  setupConnect();
  setupPullToRefresh();
  loadBrief();
  renderProfile();
});

/* ════════════════════════════════════════════
   TABS — Brief | Trend | Trip
   ════════════════════════════════════════════ */

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const raw = btn.dataset.page;
      const pageId = 'page' + raw.charAt(0).toUpperCase() + raw.slice(1);
      const page = document.getElementById(pageId);
      if (page) page.classList.add('active');
      switch (raw) {
        case 'trend': loadTrend(); break;
        case 'trip': loadTrip(); break;
        case 'brief': loadBrief(); break;
      }
    });
  });
  // Profile header button
  document.getElementById('profileBtn')?.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('pageProfile')?.classList.add('active');
    renderProfile();
  });
}

/* ════════════════════════════════════════════
   OAUTH
   ════════════════════════════════════════════ */

function setupConnect() {
  document.getElementById('connectWhoopBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    const state = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
    localStorage.setItem('whoop_oauth_state', state);
    const url = `${AUTH_URL}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&state=${state}`;
    window.location.href = url;
  });
}

function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const storedState = localStorage.getItem('whoop_oauth_state');
  if (code && returnedState) {
    if (storedState && returnedState === storedState) {
      document.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;background:#0a0618;color:#f0f2f5;font-family:-apple-system,sans-serif;padding:40px;text-align:center;">
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="34" fill="#8b5cf6"/><text x="36" y="42" text-anchor="middle" fill="white" font-size="22" font-weight="700" font-family="system-ui">✓</text></svg>
          <h1 style="font-size:24px;font-weight:700;margin:16px 0 8px;color:#22c55e;">Whoop Connected</h1>
          <p style="font-size:14px;color:#a8a3c0;line-height:1.6;max-width:320px;">Authorization successful. Your Whoop data will sync to the dashboard.</p>
          <a href="/" style="background:#8b5cf6;color:#fff;padding:14px 32px;border-radius:14px;text-decoration:none;font-weight:600;font-size:15px;margin-top:24px;">Back to Dashboard</a>
        </div>`;
      localStorage.removeItem('whoop_oauth_state');
      return true;
    } else {
      console.error('OAuth state mismatch – possible CSRF');
      document.body.innerHTML = `<div style="color:red;padding:20px;">OAuth validation failed. Please try again.</div>`;
      localStorage.removeItem('whoop_oauth_state');
      return false;
    }
  }
  return false;
}

/* ════════════════════════════════════════════
   API
   ════════════════════════════════════════════ */

async function api(path) {
  showLoadingBar(true);
  try {
    console.log(`Fetching from: ${API_BASE}${path}`); // Debug log
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`API Error: Status ${res.status}, Path: ${path}, Response:`, errorText);
      throw new Error(`API Error: Status ${res.status}, ${errorText}`);
    }
    const data = await res.json();
    if (data._cached) {
      console.log('Offline — showing cached data');
    }
    lastFetchTime = Date.now();
    updateFreshnessIndicator();
    return data;
  } catch (e) {
    console.error(`Fetch failed for ${API_BASE}${path}:`, e); // Log full error object
    throw e; // Re-throw to propagate to UI
  } finally {
    showLoadingBar(false);
  }
}

/* ════════════════════════════════════════════
   LOADING BAR
   ════════════════════════════════════════════ */

function showLoadingBar(visible) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.classList.toggle('visible', visible);
}

/* ════════════════════════════════════════════
   PULL TO REFRESH
   ════════════════════════════════════════════ */

function setupPullToRefresh() {
  const ptr = document.getElementById('pullToRefresh');
  if (!ptr) return;

  let startY = 0;
  let pulling = false;
  const threshold = 80;

  document.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling || isRefreshing) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 20 && window.scrollY === 0) {
      ptr.classList.add('visible');
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!pulling || isRefreshing) return;
    pulling = false;
    if (ptr.classList.contains('visible')) {
      triggerRefresh();
    }
  });
}

async function triggerRefresh() {
  if (isRefreshing) return;
  isRefreshing = true;
  const ptr = document.getElementById('pullToRefresh');
  ptr?.classList.add('visible');

  // Reload current tab
  const activeBtn = document.querySelector('.tab-btn.active');
  const page = activeBtn?.dataset.page || 'brief';

  try {
    switch (page) {
      case 'brief': await loadBrief(); break;
      case 'trend': await loadTrend(); break;
      case 'trip': await loadTrip(); break;
    }
  } finally {
    isRefreshing = false;
    setTimeout(() => ptr?.classList.remove('visible'), 300);
  }
}

/* ════════════════════════════════════════════
   DATA FRESHNESS INDICATOR
   ════════════════════════════════════════════ */

function updateFreshnessIndicator() {
  const bar = document.getElementById('freshnessBar');
  const dot = document.getElementById('freshnessDot');
  const text = document.getElementById('freshnessText');
  if (!bar || !dot || !text) return;

  bar.style.display = 'flex';

  if (!lastFetchTime) {
    dot.className = 'freshness-dot very-stale';
    text.textContent = 'No data fetched yet';
    return;
  }

  const ageMinutes = Math.floor((Date.now() - lastFetchTime) / 60000);

  if (ageMinutes < 5) {
    dot.className = 'freshness-dot fresh';
    text.textContent = 'Data fresh — just synced';
  } else if (ageMinutes < 60) {
    dot.className = 'freshness-dot fresh';
    text.textContent = `Data from ${ageMinutes}m ago`;
  } else if (ageMinutes < 1440) {
    const hours = Math.floor(ageMinutes / 60);
    dot.className = hours > 6 ? 'freshness-dot stale' : 'freshness-dot fresh';
    text.textContent = `Data from ${hours}h ago`;
  } else {
    dot.className = 'freshness-dot very-stale';
    text.textContent = `Data is ${Math.floor(ageMinutes / 1440)}d old — pull to refresh`;
  }
}

// Update freshness indicator every minute
setInterval(updateFreshnessIndicator, 60000);

/* ════════════════════════════════════════════
   SKELETON LOADING STATE
   ════════════════════════════════════════════ */

function renderSkeleton() {
  return `
    <div class="skeleton-card">
      <div style="display:flex;gap:16px;align-items:center;">
        <div class="skeleton-ring"></div>
        <div style="flex:1;">
          <div class="skeleton-line w-60"></div>
          <div class="skeleton-line w-40"></div>
        </div>
      </div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line w-80"></div>
      <div class="skeleton-line w-60"></div>
      <div class="skeleton-line w-80"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line w-40"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line w-60"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line w-40"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line w-80"></div>
    </div>
  `;
}

/* ════════════════════════════════════════════
   COLLAPSIBLE SECTIONS
   ════════════════════════════════════════════ */

function collapsibleSection(id, title, content, startExpanded = false) {
  return `
    <div class="section-label collapsible-header ${startExpanded ? 'expanded' : ''}" data-target="${id}" onclick="toggleCollapsible('${id}')">
      <span>${title}</span>
      <svg class="collapsible-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="collapsible-body ${startExpanded ? 'expanded' : ''}" id="${id}">
      ${content}
    </div>
  `;
}

function toggleCollapsible(id) {
  const body = document.getElementById(id);
  const header = document.querySelector(`[data-target="${id}"]`);
  if (body && header) {
    body.classList.toggle('expanded');
    header.classList.toggle('expanded');
  }
}

/* ════════════════════════════════════════════
   LABEL HELPERS
   ════════════════════════════════════════════ */

function friendlyLabel(raw) {
  if (!raw) return 'DRAIN';
  const map = { 'CAUTION': 'EASY', 'LIGHT GO': 'GO LIGHT' };
  return map[raw.toUpperCase()] || raw;
}

function ringClass(raw) {
  const label = (raw || 'DRAIN').toLowerCase().replace(/\s+/g, '-');
  const map = { 'caution': 'easy', 'light-go': 'go-light', 'go light': 'go-light' };
  return map[label] || label;
}

/* ════════════════════════════════════════════
   BRIEF PAGE — V1 Clinical Dashboard Layout
   ════════════════════════════════════════════ */

async function loadBrief() {
  const container = document.getElementById('pageBrief');

  // Show skeleton while loading
  if (!currentBrief) {
    container.innerHTML = renderSkeleton();
  }

  try {
    const data = await api('/api/daily');
    currentBrief = data;
    const m = data.metrics;
    const score = data.readiness_score || 0;
    const rawLabel = data.readiness_label || 'DRAIN';
    const displayLabel = friendlyLabel(rawLabel);
    const cls = ringClass(rawLabel);

    // Date
    const dateEl = document.getElementById('currentDate');
    if (data.date) {
      const d = new Date(data.date + 'T00:00:00');
      dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    container.innerHTML = `
      <!-- ═══ Score Section ═══ -->
      <div class="score-strip">
        <div class="score-ring-wrap">
          <svg viewBox="0 0 144 144">
            <circle class="score-ring-bg" cx="72" cy="72" r="70"/>
            <circle class="score-ring-fg ${cls}" cx="72" cy="72" r="70"
              stroke-dasharray="${RING_CIRCUMFERENCE}"
              stroke-dashoffset="${RING_CIRCUMFERENCE - (score / 100) * RING_CIRCUMFERENCE}"/>
          </svg>
          <div class="score-ring-number ${cls}">${score}</div>
        </div>
        <div class="score-info">
          <div class="score-label-v1 ${cls}">${displayLabel}</div>
          <div class="score-subtitle">— actionable items</div>
        </div>
      </div>

      <!-- ═══ Clinical Impression (improved readability) ═══ -->
      <div class="section-label">CLINICAL IMPRESSION</div>
      <div class="impression-card">
        <div class="text">${buildImpressionFormatted(data)}</div>
      </div>

      <!-- ═══ System Assessment ═══ -->
      ${collapsibleSection('sysAssess', 'SYSTEM ASSESSMENT', `
        <div class="assessment-table">
          ${renderSystemAssessment(data)}
        </div>
      `, true)}

      <!-- ═══ Clinical Findings ═══ -->
      ${collapsibleSection('clinFindings', 'CLINICAL FINDINGS', renderClinicalFindings(data), true)}

      <!-- ═══ Action Plan ═══ -->
      ${collapsibleSection('actionPlan', 'ACTION PLAN', renderActionPlan(data), true)}

      <!-- ═══ Condition Screening ═══ -->
      ${collapsibleSection('condScreen', 'HEALTH PATTERNS', renderConditionScreening(data), false)}

      <!-- ═══ Sleep Architecture (NEW) ═══ -->
      ${renderSleepArchitecture(data)}

      <!-- ═══ Sleep Score Breakdown (NEW) ═══ -->
      ${renderSleepScoreBreakdown(data)}

      <!-- ═══ Weekly Report Card (NEW) ═══ -->
      ${renderWeeklyReport(data)}

      <!-- ═══ Historical Comparison (NEW) ═══ -->
      ${renderHistoricalComparison(data)}

      <!-- ═══ Strain vs Recovery Chart (NEW) ═══ -->
      ${renderStrainVsRecovery(data)}
    `;

    // Init strain vs recovery chart after DOM is ready
    setTimeout(() => initStrainVsRecoveryChart(data), 100);

  } catch (e) {
    console.error(e); // Still log to console for debugging on dev tools if available
    container.innerHTML = `
      <div class="score-strip">
        <div class="score-info">
          <div style="font-size:14px;color:var(--red);font-weight:600;">API Error:</div>
          <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">${e.message || e.toString()}</div>
          <div style="font-size:10px;color:var(--text-tertiary);margin-top:8px;">Pull down to retry.</div>
        </div>
      </div>`;
  }
}

/* ════════════════════════════════════════════
   CLINICAL IMPRESSION — narrative generator (improved)
   ════════════════════════════════════════════ */

function buildImpression(data) {
  const m = data.metrics;
  const deficit = m.sleep_deficit_hours || 0;
  const rhr = m.rhr || 0;
  const hrv = m.hrv || 0;
  const recScore = m.recovery_score || 0;
  const spo2 = m.spo2 || 0;
  const sleepHours = m.sleep_hours || 0;
  const parts = [];

  // Lead with readiness label interpretation
  const label = (data.readiness_label || '').toUpperCase();
  if (label === 'DRAIN') {
    parts.push('Patient presents in a drained state with critically suppressed recovery metrics.');
  } else if (label === 'TIRED') {
    parts.push('Patient presents with fatigue-related biometric deviations requiring clinical attention.');
  } else if (label === 'CAUTION' || label === 'EASY') {
    parts.push('Patient presents with mild biometric deviations within manageable range.');
  } else {
    parts.push('Patient biometrics are within acceptable clinical parameters.');
  }

  if (deficit < -3) {
    parts.push(`Sleep debt of ${Math.abs(deficit).toFixed(1)} hours is the dominant physiological stressor — sustained deficit disrupts cortisol rhythm and impairs tissue repair.`);
  } else if (deficit < -1) {
    parts.push(`Mild sleep restriction (${Math.abs(deficit).toFixed(1)}h deficit) is limiting full recovery capacity.`);
  }

  if (rhr > 75) {
    parts.push(`Resting heart rate at ${rhr} bpm indicates elevated sympathetic activation — above the clinical threshold for optimal cardiovascular recovery.`);
  } else if (rhr > 65) {
    parts.push(`Resting heart rate at ${rhr} bpm is mildly elevated, suggesting residual autonomic load.`);
  }

  if (hrv < 25) {
    parts.push(`HRV critically low at ${hrv.toFixed(1)} ms — consistent with autonomic nervous system imbalance and reduced parasympathetic tone.`);
  } else if (hrv < 35) {
    parts.push(`HRV at ${hrv.toFixed(1)} ms is below the optimal range, indicating moderate autonomic stress.`);
  }

  if (spo2 > 0 && spo2 < 93) {
    parts.push(`Oxygen saturation at ${spo2.toFixed(0)}% is below normal — monitor respiratory function.`);
  } else if (spo2 > 0 && spo2 < 95) {
    parts.push(`Oxygen saturation at ${spo2.toFixed(0)}% is borderline low.`);
  }

  if (sleepHours < 5) {
    parts.push(`Total sleep of ${sleepHours.toFixed(1)} hours is insufficient for physiological restoration.`);
  }

  if (recScore < 35) {
    parts.push(`Recovery score of ${recScore.toFixed(0)} confirms the body is not prepared for significant physical strain. Rest and sleep extension are indicated.`);
  } else if (recScore < 55) {
    parts.push(`Recovery score of ${recScore.toFixed(0)} is below optimal — reversible with prioritised rest.`);
  }

  parts.push('All observed deviations are within the window of reversibility through lifestyle adjustments.');

  return parts.join(' ');
}

/* ════════════════════════════════════════════
   CLINICAL IMPRESSION — formatted with highlights
   ════════════════════════════════════════════ */

function buildImpressionFormatted(data) {
  const raw = buildImpression(data);

  // Split into sentences and highlight key terms
  const sentences = raw.split(/(?<=[.!])\s+/);
  return sentences.map(sentence => {
    let s = sentence;

    // Highlight critical metrics
    s = s.replace(/critically (low|suppressed)/gi, '<span class="highlight-critical">$1</span>');
    s = s.replace(/below normal/gi, '<span class="highlight-critical">below normal</span>');
    s = s.replace(/below the clinical threshold/gi, '<span class="highlight-critical">below threshold</span>');
    s = s.replace(/significant (physical strain|imbalance)/gi, '<span class="highlight-critical">$1</span>');

    // Highlight warning terms
    s = s.replace(/mildly elevated/gi, '<span class="highlight-warning">mildly elevated</span>');
    s = s.replace(/mild (sleep restriction|biometric)/gi, '<span class="highlight-warning">mild $1</span>');
    s = s.replace(/below optimal/gi, '<span class="highlight-warning">below optimal</span>');
    s = s.replace(/borderline low/gi, '<span class="highlight-warning">borderline</span>');
    s = s.replace(/moderate autonomic stress/gi, '<span class="highlight-warning">moderate stress</span>');

    // Highlight good terms
    s = s.replace(/within acceptable/gi, '<span class="highlight-good">within acceptable</span>');
    s = s.replace(/within the window of reversibility/gi, '<span class="highlight-good">reversible</span>');

    // Highlight specific metrics
    s = s.replace(/(\d+\.?\d*)\s*bpm/g, '<span class="highlight-metric">$1 bpm</span>');
    s = s.replace(/(\d+\.?\d*)\s*ms/g, '<span class="highlight-metric">$1 ms</span>');
    s = s.replace(/(\d+\.?\d*)\s*h(ours?)?\s*(deficit)?/gi, '<span class="highlight-metric">$1h$3</span>');
    s = s.replace(/(\d+\.?\d*)%/g, '<span class="highlight-metric">$1%</span>');
    s = s.replace(/score of (\d+)/g, 'score of <span class="highlight-metric">$1</span>');

    return s;
  }).join(' ');
}

/* ════════════════════════════════════════════
   SYSTEM ASSESSMENT — 5 Rows
   ════════════════════════════════════════════ */

function renderSystemAssessment(data) {
  const m = data.metrics;
  const rhr = m.rhr || 0;
  const hrv = m.hrv || 0;
  const spo2 = m.spo2 || 0;
  const sleepHours = m.sleep_hours || 0;
  const deficit = m.sleep_deficit_hours || 0;
  const recScore = m.recovery_score || 0;
  const strain = m.strain_yesterday || 0;

  const systems = [
    assessCardiovascular(rhr, strain),
    assessSleepQuality(sleepHours, deficit),
    assessOxygenation(spo2),
    assessAutonomicNS(hrv),
    assessRecoveryCapacity(recScore, deficit)
  ];

  return systems.map(sys => `
    <div class="assessment-row">
      <span class="sys-name">${sys.name}</span>
      <div class="sys-right-col">
        <div class="sys-status ${sys.statusCls}">${sys.status}</div>
        <div class="sys-concern">${sys.concern}</div>
      </div>
    </div>
  `).join('');
}

function assessCardiovascular(rhr, strain) {
  if (!rhr) return { name: 'Cardiovascular', status: 'No data', statusCls: 'status-yellow', concern: '—' };
  if (rhr < 65) return { name: 'Cardiovascular', status: 'Good reserve', statusCls: 'status-green', concern: 'RHR optimal' };
  if (rhr < 75) return { name: 'Cardiovascular', status: 'Moderate reserve', statusCls: 'status-yellow', concern: `RHR ${rhr.toFixed(0)} bpm` };
  return { name: 'Cardiovascular', status: 'Elevated strain', statusCls: 'status-orange', concern: `RHR elevated (${rhr.toFixed(0)} bpm)` };
}

function assessSleepQuality(hours, deficit) {
  if (!hours) return { name: 'Sleep Quality', status: 'No data', statusCls: 'status-yellow', concern: '—' };
  if (hours >= 7 && deficit > -1) return { name: 'Sleep Quality', status: 'Adequate', statusCls: 'status-green', concern: `${hours.toFixed(1)}h sleep` };
  if (hours >= 6) return { name: 'Sleep Quality', status: 'Mild restriction', statusCls: 'status-yellow', concern: `Deficit ${Math.abs(deficit).toFixed(1)}h` };
  if (hours >= 5) return { name: 'Sleep Quality', status: 'Moderate deficit', statusCls: 'status-orange', concern: `Deficit ${Math.abs(deficit).toFixed(1)}h` };
  return { name: 'Sleep Quality', status: 'Severe deficit', statusCls: 'status-red', concern: `Deficit ${Math.abs(deficit).toFixed(1)}h` };
}

function assessOxygenation(spo2) {
  if (!spo2) return { name: 'Oxygenation', status: 'No data', statusCls: 'status-yellow', concern: '—' };
  if (spo2 >= 96) return { name: 'Oxygenation', status: 'Normal', statusCls: 'status-green', concern: `SpO₂ ${spo2.toFixed(0)}%` };
  if (spo2 >= 94) return { name: 'Oxygenation', status: 'Borderline', statusCls: 'status-yellow', concern: `SpO₂ ${spo2.toFixed(0)}%` };
  if (spo2 >= 92) return { name: 'Oxygenation', status: 'Reduced', statusCls: 'status-orange', concern: `SpO₂ ${spo2.toFixed(0)}%` };
  return { name: 'Oxygenation', status: 'Critical', statusCls: 'status-red', concern: `SpO₂ ${spo2.toFixed(0)}%` };
}

function assessAutonomicNS(hrv) {
  if (!hrv) return { name: 'Autonomic NS', status: 'No data', statusCls: 'status-yellow', concern: '—' };
  if (hrv >= 55) return { name: 'Autonomic NS', status: 'Balanced', statusCls: 'status-green', concern: `HRV ${hrv.toFixed(0)} ms` };
  if (hrv >= 35) return { name: 'Autonomic NS', status: 'Mild imbalance', statusCls: 'status-yellow', concern: `HRV ${hrv.toFixed(0)} ms` };
  if (hrv >= 25) return { name: 'Autonomic NS', status: 'Moderate imbalance', statusCls: 'status-orange', concern: `HRV ${hrv.toFixed(0)} ms` };
  return { name: 'Autonomic NS', status: 'Significant imbalance', statusCls: 'status-red', concern: `HRV ${hrv.toFixed(0)} ms` };
}

function assessRecoveryCapacity(score, deficit) {
  if (!score) return { name: 'Recovery Capacity', status: 'No data', statusCls: 'status-yellow', concern: '—' };
  if (score >= 66 && deficit > -1) return { name: 'Recovery Capacity', status: 'Ready', statusCls: 'status-green', concern: `Score ${score.toFixed(0)}` };
  if (score >= 50) return { name: 'Recovery Capacity', status: 'Adequate', statusCls: 'status-yellow', concern: `Score ${score.toFixed(0)}` };
  if (score >= 35) return { name: 'Recovery Capacity', status: 'Compromised', statusCls: 'status-orange', concern: `Score ${score.toFixed(0)}` };
  return { name: 'Recovery Capacity', status: 'Critically low', statusCls: 'status-red', concern: `Score ${score.toFixed(0)}` };
}

/* ════════════════════════════════════════════
   CLINICAL FINDINGS — with emoji
   ════════════════════════════════════════════ */

function renderClinicalFindings(data) {
  const m = data.metrics;
  const deficit = m.sleep_deficit_hours || 0;
  const rhr = m.rhr || 0;
  const hrv = m.hrv || 0;
  const recScore = m.recovery_score || 0;
  const spo2 = m.spo2 || 0;
  const deepSleep = m.deep_sleep_hours || 0;
  const drivers = data.drivers || [];
  const anomalies = data.anomalies || [];
  const findings = [];

  // Primary: sleep deficit finding (always shown if significant)
  if (deficit < -3) {
    findings.push({
      emoji: '🛑',
      label: 'Critical Sleep Debt',
      detail: `${Math.abs(deficit).toFixed(1)}h accumulated sleep deficit. Sustained sleep restriction is the primary physiological stressor — impairs cognitive function, metabolic regulation, and tissue repair. Requires multi-day recovery.`
    });
  } else if (deficit < -2) {
    findings.push({
      emoji: '⚠️',
      label: 'Sleep Debt Accumulating',
      detail: `${Math.abs(deficit).toFixed(1)}h below target. Prioritize sleep extension to prevent compounding physiological stress.`
    });
  } else if (deficit < -1) {
    findings.push({
      emoji: '🌙',
      label: 'Mild Sleep Restriction',
      detail: `${Math.abs(deficit).toFixed(1)}h deficit — manageable with consistent sleep hygiene and an earlier bedtime.`
    });
  }

  // Anomalies from API
  if (anomalies.length > 0) {
    anomalies.forEach(a => {
      if (a.toLowerCase().includes('rhr')) {
        findings.push({
          emoji: '❤️',
          label: 'Cardiovascular Alert',
          detail: a
        });
      } else if (a.toLowerCase().includes('hrv')) {
        findings.push({
          emoji: '🧠',
          label: 'Autonomic Imbalance',
          detail: a
        });
      } else {
        findings.push({
          emoji: '📊',
          label: 'Anomaly Detected',
          detail: a
        });
      }
    });
  }

  // HRV
  if (hrv > 0 && hrv < 25) {
    findings.push({
      emoji: '🔄',
      label: 'HRV Critically Low',
      detail: `${hrv.toFixed(1)} ms — autonomic nervous system under significant stress. Parasympathetic recovery mechanisms are suppressed. Rest required.`
    });
  } else if (hrv > 0 && hrv < 35) {
    findings.push({
      emoji: '📉',
      label: 'HRV Below Optimal',
      detail: `${hrv.toFixed(1)} ms — below optimal autonomic balance. Monitor recovery trends and prioritize sleep quality.`
    });
  }

  // RHR
  if (rhr > 78) {
    findings.push({
      emoji: '🔥',
      label: 'RHR Significantly Elevated',
      detail: `${rhr.toFixed(0)} bpm — indicates high sympathetic activation. Rest, hydration, and sleep extension recommended.`
    });
  } else if (rhr > 72) {
    findings.push({
      emoji: '📈',
      label: 'RHR Above Baseline',
      detail: `${rhr.toFixed(0)} bpm — suggests residual fatigue from prior exertion or insufficient recovery.`
    });
  }

  // Recovery
  if (recScore > 0 && recScore < 35) {
    findings.push({
      emoji: '🆘',
      label: 'Recovery Critically Low',
      detail: `Score ${recScore.toFixed(0)} — body is not prepared for significant strain. Light activity only.`
    });
  } else if (recScore > 0 && recScore < 50) {
    findings.push({
      emoji: '⚡',
      label: 'Recovery Below Optimal',
      detail: `Score ${recScore.toFixed(0)} — reversible with quality sleep and reduced training load.`
    });
  }

  // Deep sleep
  if (deepSleep > 0 && deepSleep < 0.8) {
    findings.push({
      emoji: '💤',
      label: 'Deep Sleep Insufficient',
      detail: `${deepSleep.toFixed(1)}h of deep sleep — insufficient for optimal tissue repair and hormonal restoration.`
    });
  }

  if (findings.length === 0) {
    findings.push({
      emoji: '✅',
      label: 'All Markers Stable',
      detail: 'No significant anomalies detected across monitored systems. Continue current regimen.'
    });
  }

  return findings.map(f => `
    <div class="finding-card">
      <span class="finding-emoji">${f.emoji}</span>
      <div class="finding-text"><strong>${f.label}</strong> — ${f.detail}</div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════
   ACTION PLAN — ranked recommendations with impact
   ════════════════════════════════════════════ */

function renderActionPlan(data) {
  const plan = data.action_plan || [];
  if (plan.length === 0) return '';

  const impactEmoji = { 'HIGH': '🔴', 'MEDIUM': '🟡', 'LOW': '🔵' };

  // Filter out the projection item (has projected_improvement but no action)
  const items = plan.filter(p => p.action);
  const projection = plan.find(p => p.projected_improvement);

  return `
    <div class="action-plan-card">
      ${items.map(p => `
        <div class="action-item">
          <div class="action-impact ${p.impact.toLowerCase()}">
            <span class="impact-dot">${impactEmoji[p.impact] || '⚪'}</span>
            <span class="impact-label">${p.impact}</span>
          </div>
          <div class="action-body">
            <div class="action-text">${p.action}</div>
            <div class="action-reason">${p.reason}</div>
          </div>
        </div>
      `).join('')}
      ${projection ? `
        <div class="action-projection">
          ${projection.projected_improvement}
        </div>
      ` : ''}
    </div>
  `;
}

/* ════════════════════════════════════════════
   CONDITION SCREENING — pattern-based health flags
   ════════════════════════════════════════════ */

function renderConditionScreening(data) {
  const conditions = data.condition_screening || [];
  if (conditions.length === 0) return '<div class="glass-card"><div class="text" style="font-size:13px;color:var(--text-tertiary);text-align:center;">No health patterns detected.</div></div>';

  const dotColors = {
    'Significant': 'var(--red)',
    'Present': 'var(--yellow)',
    'Notable': 'var(--text-tertiary)'
  };

  return conditions.map(c => `
    <div class="condition-card">
      <div class="condition-header">
        <span class="condition-name">${c.condition}</span>
        <span class="condition-confidence" style="background: ${dotColors[c.confidence] || 'var(--text-tertiary)'}20; color: ${dotColors[c.confidence] || 'var(--text-tertiary)'};">
          <span class="condition-dot" style="background: ${dotColors[c.confidence] || 'var(--text-tertiary)'};"></span>
          ${c.confidence}
        </span>
      </div>
      <div class="condition-detail">${c.detail}</div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════
   SLEEP ARCHITECTURE VISUALIZATION (NEW)
   ════════════════════════════════════════════ */

function renderSleepArchitecture(data) {
  const m = data.metrics || {};
  const totalSleep = m.sleep_hours || 0;
  const deepSleep = m.deep_sleep_hours || 0;

  // Estimate sleep stages from available data
  // Whoop doesn't give exact stage breakdown in daily API, so we estimate
  const remSleep = deepSleep > 0 ? Math.min(totalSleep * 0.22, deepSleep * 1.2) : 0;
  const lightSleep = Math.max(0, totalSleep - deepSleep - remSleep - (totalSleep * 0.05));
  const awake = totalSleep * 0.05;

  if (totalSleep === 0) return '';

  const deepPct = totalSleep > 0 ? (deepSleep / totalSleep * 100).toFixed(0) : 0;
  const remPct = totalSleep > 0 ? (remSleep / totalSleep * 100).toFixed(0) : 0;
  const lightPct = totalSleep > 0 ? (lightSleep / totalSleep * 100).toFixed(0) : 0;
  const awakePct = 100 - deepPct - remPct - lightPct;

  return `
    <div class="section-label">SLEEP ARCHITECTURE</div>
    <div class="sleep-arch-card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div style="font-size:14px;font-weight:600;color:var(--text);">Sleep Stage Distribution</div>
        <div style="font-size:12px;color:var(--text-tertiary);">${totalSleep.toFixed(1)}h total</div>
      </div>

      <!-- Visual bar showing stages -->
      <div class="sleep-stages-bar">
        <div class="sleep-stage-seg deep" style="width:${deepPct}%;" title="Deep: ${deepSleep.toFixed(1)}h"></div>
        <div class="sleep-stage-seg rem" style="width:${remPct}%;" title="REM: ${remSleep.toFixed(1)}h"></div>
        <div class="sleep-stage-seg light" style="width:${lightPct}%;" title="Light: ${lightSleep.toFixed(1)}h"></div>
        <div class="sleep-stage-seg awake" style="width:${awakePct}%;" title="Awake: ${awake.toFixed(1)}h"></div>
      </div>

      <!-- Legend -->
      <div class="sleep-legend">
        <div class="sleep-legend-item">
          <div class="sleep-legend-dot" style="background:rgba(30,27,75,0.9);"></div>
          Deep ${deepSleep.toFixed(1)}h (${deepPct}%)
        </div>
        <div class="sleep-legend-item">
          <div class="sleep-legend-dot" style="background:rgba(20,184,166,0.6);"></div>
          REM ${remSleep.toFixed(1)}h (${remPct}%)
        </div>
        <div class="sleep-legend-item">
          <div class="sleep-legend-dot" style="background:rgba(139,92,246,0.5);"></div>
          Light ${lightSleep.toFixed(1)}h (${lightPct}%)
        </div>
        <div class="sleep-legend-item">
          <div class="sleep-legend-dot" style="background:rgba(239,68,68,0.6);"></div>
          Awake ${awake.toFixed(1)}h (${awakePct}%)
        </div>
      </div>

      <!-- Clinical note -->
      <div style="margin-top:12px;font-size:12px;color:var(--text-tertiary);line-height:1.5;">
        ${deepSleep < 1 ? '⚠️ Deep sleep below recommended 1–1.5h range for tissue repair.' : '✅ Deep sleep within healthy range.'}
        ${remSleep > 0 && remSleep < totalSleep * 0.18 ? ' ⚠️ REM below 18–22% target — may affect memory consolidation.' : ''}
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════
   SLEEP SCORE BREAKDOWN (NEW)
   ════════════════════════════════════════════ */

function renderSleepScoreBreakdown(data) {
  const m = data.metrics || {};
  const totalSleep = m.sleep_hours || 0;
  const deepSleep = m.deep_sleep_hours || 0;
  const deficit = m.sleep_deficit_hours || 0;
  const recScore = m.recovery_score || 0;

  if (totalSleep === 0) return '';

  // Compute sub-scores (0-100 scale)
  const durationScore = Math.min(100, Math.max(0, (totalSleep / 8) * 100));
  const debtScore = Math.min(100, Math.max(0, (1 + deficit / 8) * 100));
  const deepScore = Math.min(100, Math.max(0, (deepSleep / 1.5) * 100));
  const recoveryContrib = Math.min(100, Math.max(0, recScore));

  const overallSleepScore = Math.round((durationScore * 0.3 + debtScore * 0.3 + deepScore * 0.25 + recoveryContrib * 0.15));

  const subScores = [
    { name: 'Duration', value: Math.round(durationScore), detail: `${totalSleep.toFixed(1)}h / 8h target`, color: totalSleep >= 7 ? 'var(--green)' : totalSleep >= 6 ? 'var(--yellow)' : 'var(--red)' },
    { name: 'Sleep Debt', value: Math.round(debtScore), detail: deficit < -1 ? `${Math.abs(deficit).toFixed(1)}h deficit` : 'No deficit', color: deficit > -1 ? 'var(--green)' : deficit > -3 ? 'var(--yellow)' : 'var(--red)' },
    { name: 'Deep Sleep', value: Math.round(deepScore), detail: `${deepSleep.toFixed(1)}h / 1.5h target`, color: deepSleep >= 1.5 ? 'var(--green)' : deepSleep >= 0.8 ? 'var(--yellow)' : 'var(--red)' },
    { name: 'Recovery', value: Math.round(recoveryContrib), detail: `Score ${Math.round(recoveryContrib)}/100`, color: recoveryContrib >= 66 ? 'var(--green)' : recoveryContrib >= 40 ? 'var(--yellow)' : 'var(--red)' },
  ];

  const overallColor = overallSleepScore >= 70 ? 'var(--green)' : overallSleepScore >= 50 ? 'var(--yellow)' : 'var(--red)';

  return `
    <div class="section-label">SLEEP SCORE BREAKDOWN</div>
    <div class="glass-card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div style="font-size:32px;font-weight:900;color:${overallColor};">${overallSleepScore}</div>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text);">Composite Sleep Score</div>
          <div style="font-size:11px;color:var(--text-tertiary);">Weighted average of duration, debt, depth, recovery</div>
        </div>
      </div>

      ${subScores.map(s => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--glass-border);">
          <div style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0;"></div>
          <div style="flex:1;font-size:12px;font-weight:500;color:var(--text);">${s.name}</div>
          <div style="font-size:11px;color:var(--text-tertiary);">${s.detail}</div>
          <div style="font-size:13px;font-weight:700;color:${s.color};min-width:32px;text-align:right;">${s.value}</div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ════════════════════════════════════════════
   WEEKLY REPORT CARD (NEW)
   ════════════════════════════════════════════ */

function renderWeeklyReport(data) {
  // Only render if we have trend data cached
  if (!currentTrend || !currentTrend.trends) return '';

  const trends = currentTrend.trends;
  if (trends.length < 3) return '';

  // Use last 7 days of available data
  const recent = trends.slice(-7);
  const avg = (arr, key) => arr.reduce((sum, t) => sum + (t[key] || 0), 0) / arr.length;

  const avgRecovery = avg(recent, 'recovery_score');
  const avgSleep = avg(recent, 'sleep_hours');
  const avgHRV = avg(recent, 'hrv');
  const avgRHR = avg(recent, 'rhr');
  const avgStrain = avg(recent, 'strain');

  // Calculate week-over-week change
  const prev = trends.slice(-14, -7);
  const prevAvgRecovery = prev.length > 0 ? avg(prev, 'recovery_score') : avgRecovery;
  const recoveryTrend = avgRecovery - prevAvgRecovery;

  // Calculate grade
  let grade = 'F';
  let gradeColor = 'var(--red)';
  let gradeText = 'Critical — medical consultation advised';
  const avgScore = (avgRecovery + (avgSleep / 8 * 100) + (avgHRV / 80 * 100)) / 3;

  if (avgScore >= 80) { grade = 'A'; gradeColor = 'var(--green)'; gradeText = 'Excellent week — maintain current habits'; }
  else if (avgScore >= 65) { grade = 'B'; gradeColor = 'var(--green)'; gradeText = 'Good week — minor adjustments possible'; }
  else if (avgScore >= 50) { grade = 'C'; gradeColor = 'var(--yellow)'; gradeText = 'Average — room for improvement in recovery'; }
  else if (avgScore >= 35) { grade = 'D'; gradeColor = 'var(--orange)'; gradeText = 'Below average — prioritize sleep and rest'; }
  else { grade = 'F'; gradeColor = 'var(--red)'; gradeText = 'Critical — medical consultation advised'; }

  // Date range
  const firstDate = recent[0]?.date || '';
  const lastDate = recent[recent.length - 1]?.date || '';

  return `
    <div class="section-label">WEEKLY REPORT</div>
    <div class="weekly-report">
      <h3>Weekly Health Report</h3>
      <div class="period">${formatDateShort(firstDate)} – ${formatDateShort(lastDate)} · ${recent.length} days analyzed</div>

      <div class="weekly-stats">
        <div class="weekly-stat">
          <div class="stat-value" style="color:var(--accent);">${avgRecovery.toFixed(0)}</div>
          <div class="stat-label">Avg Recovery</div>
        </div>
        <div class="weekly-stat">
          <div class="stat-value" style="color:var(--teal);">${avgSleep.toFixed(1)}h</div>
          <div class="stat-label">Avg Sleep</div>
        </div>
        <div class="weekly-stat">
          <div class="stat-value" style="color:var(--accent);">${avgHRV.toFixed(0)}ms</div>
          <div class="stat-label">Avg HRV</div>
        </div>
        <div class="weekly-stat">
          <div class="stat-value" style="color:var(--orange);">${avgStrain.toFixed(1)}</div>
          <div class="stat-label">Avg Strain</div>
        </div>
      </div>

      <div class="weekly-grade">
        <div class="grade-letter" style="color:${gradeColor};">${grade}</div>
        <div class="grade-text">
          <div style="font-weight:600;color:var(--text);">${gradeText}</div>
          <div style="margin-top:4px;font-size:11px;color:var(--text-tertiary);">
            Recovery ${recoveryTrend >= 0 ? '↑' : '↓'} ${Math.abs(recoveryTrend).toFixed(0)} pts vs prior week
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════
   HISTORICAL COMPARISON (NEW)
   ════════════════════════════════════════════ */

function renderHistoricalComparison(data) {
  if (!currentTrend || !currentTrend.trends) return '';

  const trends = currentTrend.trends;
  if (trends.length < 7) return '';

  const latest = trends[trends.length - 1];
  const weekAgo = trends[Math.max(0, trends.length - 7)];
  const monthAgo = trends[Math.max(0, trends.length - 28)];

  const metrics = [
    { name: 'Recovery Score', key: 'recovery_score', unit: '', icon: '💚', good: 'up' },
    { name: 'HRV', key: 'hrv', unit: 'ms', icon: '🧠', good: 'up' },
    { name: 'RHR', key: 'rhr', unit: 'bpm', icon: '❤️', good: 'down' },
    { name: 'Sleep Duration', key: 'sleep_hours', unit: 'h', icon: '🌙', good: 'up' },
    { name: 'Deep Sleep', key: 'deep_sleep', unit: 'h', icon: '💤', good: 'up' },
    { name: 'Strain', key: 'strain', unit: '', icon: '🔥', good: 'neutral' },
  ];

  function calcDelta(current, previous, goodDirection) {
    const delta = (current || 0) - (previous || 0);
    const isGood = goodDirection === 'up' ? delta > 0 : goodDirection === 'down' ? delta < 0 : false;
    return { delta, isGood, label: delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}` };
  }

  return `
    <div class="section-label">HISTORICAL COMPARISON</div>
    <div class="compare-section">
      <div class="compare-title">Today vs 7 Days Ago</div>
      ${metrics.map(m => {
        const week = calcDelta(latest[m.key], weekAgo[m.key], m.good);
        return `
          <div class="compare-card">
            <div class="metric-icon" style="background:rgba(139,92,246,0.1);font-size:18px;">${m.icon}</div>
            <div class="metric-data">
              <div class="metric-name">${m.name}</div>
              <div class="metric-values">
                <span>${(latest[m.key] || 0).toFixed(m.unit === 'h' ? 1 : 0)}${m.unit}</span>
                <span style="color:var(--text-tertiary);">→</span>
                <span>${(weekAgo[m.key] || 0).toFixed(m.unit === 'h' ? 1 : 0)}${m.unit}</span>
              </div>
            </div>
            <div class="metric-delta ${week.isGood ? 'positive' : week.delta === 0 ? 'neutral' : 'negative'}">
              ${week.label}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ════════════════════════════════════════════
   STRAIN vs RECOVERY CHART (NEW)
   ════════════════════════════════════════════ */

function renderStrainVsRecovery(data) {
  return `
    <div class="section-label">STRAIN vs RECOVERY</div>
    <div class="trend-chart">
      <div class="chart-title">Training Load vs Recovery Capacity</div>
      <div class="chart-canvas-wrap">
        <canvas id="strainRecoveryChart"></canvas>
      </div>
    </div>
  `;
}

let strainRecoveryChartInstance = null;

function initStrainVsRecoveryChart(data) {
  if (!currentTrend || !currentTrend.trends) return;

  const trends = currentTrend.trends;
  if (trends.length < 2) return;

  const sorted = trends.sort((a, b) => {
    const [am, ad] = a.date.split('-').map(Number);
    const [bm, bd] = b.date.split('-').map(Number);
    return am !== bm ? am - bm : ad - bd;
  });

  const labels = sorted.map(t => formatDateShort(t.date));
  const strainData = sorted.map(t => t.strain || 0);
  const recoveryData = sorted.map(t => t.recovery_score || 0);

  const ctx = document.getElementById('strainRecoveryChart');
  if (!ctx) return;

  if (strainRecoveryChartInstance) strainRecoveryChartInstance.destroy();

  strainRecoveryChartInstance = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Strain',
          data: strainData,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.1)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#f97316',
          tension: 0.1,
          yAxisID: 'y',
        },
        {
          label: 'Recovery',
          data: recoveryData,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.1)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#22c55e',
          tension: 0.1,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#a8a3c0', font: { size: 11 }, boxWidth: 12, padding: 16 }
        },
        tooltip: {
          backgroundColor: '#13102a',
          titleColor: '#f0f2f5',
          bodyColor: '#a8a3c0',
          borderColor: 'rgba(139,92,246,0.2)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
          ticks: { color: '#6b6690', font: { size: 10 }, maxRotation: 45 }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Strain', color: '#f97316', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
          ticks: { color: '#f97316', font: { size: 10 } },
          min: 0,
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Recovery %', color: '#22c55e', font: { size: 10 } },
          grid: { drawOnChartArea: false },
          ticks: { color: '#22c55e', font: { size: 10 } },
          min: 0, max: 100,
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });
}

/* ════════════════════════════════════════════
   TREND PAGE
   ════════════════════════════════════════════ */

let trendChartInstance = null;
let trendDataCache = null;

const TREND_METRICS = {
  hrv: { label: 'HRV', unit: 'ms', color: '#8b5cf6', decimals: 1, accessor: d => d.hrv },
  rhr: { label: 'RHR', unit: 'bpm', color: '#ef4444', decimals: 0, accessor: d => d.rhr },
  recovery: { label: 'Recovery', unit: '', color: '#22c55e', decimals: 0, accessor: d => d.recovery_score },
  sleep: { label: 'Sleep', unit: 'h', color: '#14b8a6', decimals: 1, accessor: d => d.sleep_hours },
  strain: { label: 'Strain', unit: '', color: '#f97316', decimals: 1, accessor: d => d.strain },
};

async function loadTrend() {
  const container = document.getElementById('pageTrend');

  // Show skeleton while loading
  if (!trendDataCache) {
    container.innerHTML = renderSkeleton();
  }

  try {
    const trendData = await api('/api/trend');
    trendDataCache = trendData;
    currentTrend = trendData; // Cache for weekly report
    const trends = (trendData.trends || []).sort((a, b) => {
      const [am, ad] = a.date.split('-').map(Number);
      const [bm, bd] = b.date.split('-').map(Number);
      return am !== bm ? am - bm : ad - bd;
    });

    if (trends.length < 2) {
      container.innerHTML = `
        <div class="trend-header">
          <h2>Trend Analysis</h2>
          <div class="trend-period">Insufficient data for trend analysis</div>
        </div>`;
      return;
    }

    const firstDate = trends[0].date;
    const lastDate = trends[trends.length - 1].date;
    const periodLabel = `${formatDateShort(firstDate)} – ${formatDateShort(lastDate)}`;
    const labels = trends.map(t => formatDateShort(t.date));
    const defaultMetric = 'hrv';

    // Pick values for the default metric
    const metric = TREND_METRICS[defaultMetric];
    const values = trends.map(d => metric.accessor(d) ?? 0);

    const current = trends[trends.length - 1];
    const previous = trends[trends.length - 2];

    container.innerHTML = `
      <!-- Trend Header -->
      <div class="trend-header">
        <h2>Trend Analysis</h2>
        <div class="trend-period">${periodLabel} · ${trends.length} days</div>
      </div>

      <!-- Metric Toggle Buttons -->
      <div class="metric-toggles" id="metricToggles">
        ${Object.entries(TREND_METRICS).map(([key, m]) => `
          <button class="metric-toggle ${key === defaultMetric ? 'active' : ''}" data-metric="${key}">${m.label}</button>
        `).join('')}
      </div>

      <!-- Chart.js Line Chart -->
      <div class="trend-chart">
        <div class="chart-title" id="trendChartTitle">${metric.label} Trend${metric.unit ? ' (' + metric.unit + ')' : ''}</div>
        <div class="chart-canvas-wrap">
          <canvas id="trendChart"></canvas>
        </div>
      </div>

      <!-- Day-over-Day Change -->
      <div class="section-label">Day-over-Day Change</div>
      <div class="trend-chart" style="padding:8px 16px;">
        ${renderTrendMetric('Heart Rate Variability', current.hrv, previous.hrv, 'ms', 'up')}
        ${renderTrendMetric('Resting Heart Rate', current.rhr, previous.rhr, 'bpm', 'down')}
        ${renderTrendMetric('Recovery Score', current.recovery_score, previous.recovery_score, '', 'up')}
        ${renderTrendMetric('Sleep Duration', current.sleep_hours, previous.sleep_hours, 'h', 'up')}
        ${renderTrendMetric('Strain', current.strain, previous.strain, '', 'up')}
        ${renderTrendMetric('Deep Sleep', current.deep_sleep, previous.deep_sleep, 'h', 'up')}
        ${renderTrendMetric('SpO₂', current.spo2, previous.spo2, '%', 'up')}
        ${renderTrendMetric('Sleep Deficit', current.deficit, previous.deficit, 'h', 'up')}
      </div>
    `;

    // Create the Chart.js line chart
    const ctx = document.getElementById('trendChart').getContext('2d');
    if (trendChartInstance) trendChartInstance.destroy();

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: metric.label,
          data: values,
          borderColor: metric.color,
          backgroundColor: metric.color + '20',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: metric.color,
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          tension: 0.1,
          fill: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#13102a',
            titleColor: '#f0f2f5',
            bodyColor: '#a8a3c0',
            borderColor: 'rgba(139,92,246,0.2)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: function(ctx) {
                const val = ctx.parsed.y;
                return `${metric.label}: ${val.toFixed(metric.decimals)}${metric.unit}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
            ticks: { color: '#6b6690', font: { size: 10 }, maxRotation: 45 }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.1)', drawBorder: false },
            ticks: { color: '#6b6690', font: { size: 10 } },
            beginAtZero: false
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });

    // Bind metric toggle buttons
    document.querySelectorAll('.metric-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.metric-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchMetric(btn.dataset.metric, trends);
      });
    });

  } catch (e) {
    console.error(e);
    container.innerHTML = `
      <div class="trend-header">
        <h2>Trend Analysis</h2>
        <div class="trend-period" style="color:var(--red);">Failed to load trend data.</div>
      </div>`;
  }
}

function switchMetric(key, trends) {
  const metric = TREND_METRICS[key];
  if (!metric || !trendChartInstance) return;

  const values = trends.map(d => metric.accessor(d) ?? 0);

  // Update title
  document.getElementById('trendChartTitle').textContent = `${metric.label} Trend${metric.unit ? ' (' + metric.unit + ')' : ''}`;

  // Update chart
  trendChartInstance.data.datasets[0].label = metric.label;
  trendChartInstance.data.datasets[0].data = values;
  trendChartInstance.data.datasets[0].borderColor = metric.color;
  trendChartInstance.data.datasets[0].backgroundColor = metric.color + '20';
  trendChartInstance.data.datasets[0].pointBackgroundColor = metric.color;

  // Update tooltip callback
  trendChartInstance.options.plugins.tooltip.callbacks = {
    label: function(ctx) {
      const val = ctx.parsed.y;
      return `${metric.label}: ${val.toFixed(metric.decimals)}${metric.unit}`;
    }
  };

  trendChartInstance.update();
}

function renderTrendMetric(name, current, previous, unit, directionGood) {
  if (current == null || previous == null) return '';
  const delta = current - previous;
  const isGood = directionGood === 'up' ? delta > 0 : directionGood === 'down' ? delta < 0 : true;
  const isNeutral = Math.abs(delta) < 0.01;
  const deltaStr = isNeutral ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}${unit}`;
  const deltaCls = isNeutral ? 'neutral' : isGood ? 'positive' : 'negative';

  return `
    <div class="trend-metric-row">
      <span class="trend-metric-name">${name}</span>
      <div class="trend-metric-values">
        <div class="trend-metric-current">${current.toFixed(1)}${unit}</div>
        <div class="trend-metric-delta ${deltaCls}">${deltaStr}</div>
      </div>
    </div>
  `;
}

function formatDateShort(dateStr) {
  // dateStr is like "07-22" (MM-DD)
  const parts = dateStr.split('-');
  if (parts.length === 2) {
    // Assume current year
    const d = new Date();
    d.setMonth(parseInt(parts[0]) - 1);
    d.setDate(parseInt(parts[1]));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ════════════════════════════════════════════
   TRIP PAGE — Trip Comparison
   ════════════════════════════════════════════ */

async function loadTrip() {
  const container = document.getElementById('pageTrip');

  // Show skeleton while loading
  container.innerHTML = renderSkeleton();

  try {
    const data = await api('/api/daily');
    const risks = data.risk_projection || [];
    const narrative = data.risk_narrative || [];

    let html = `<div class="section-label">6–12 Month Risk Projection</div>`;

    // Narrative paragraphs — clinical assessment context before the risk cards
    if (narrative.length > 0) {
      html += `<div class="risk-narrative">`;
      // First paragraph is the overview, last is the capstone — style accordingly
      narrative.forEach((p, i) => {
        const isFirst = i === 0;
        const isLast = i === narrative.length - 1;
        if (isLast) {
          html += `<div class="capstone">${p}</div>`;
        } else {
          // Bold the system name at the start of body paragraphs
          const bolded = p.replace(/^(Respiratory & Cardiac|Metabolic & Endocrine|Cardiovascular|Neurocognitive)\s*—/,
            '<strong>$1</strong> —');
          html += `<p>${bolded}</p>`;
        }
      });
      html += `</div>`;
    }

    // Risk cards — individual severity entries with dots + badges
    if (risks.length > 0) {
      html += `<div class="section-label" style="margin-top:20px;">Identified Risks</div>`;
      risks.forEach(r => {
        const sevLabel = r.severity === 'danger' ? 'Critical' : r.severity === 'warn' ? 'Elevated' : 'Managed';
        html += `
          <div class="risk-card ${r.severity}">
            <div class="risk-dot"></div>
            <div class="risk-body">
              <div class="risk-header">
                <span class="risk-system">${r.system}</span>
                <span class="risk-badge ${r.severity}">${sevLabel}</span>
              </div>
              <div class="risk-detail">${r.detail}</div>
            </div>
          </div>`;
      });
    } else {
      html += `<div class="glass-card"><div class="text" style="text-align:center;">No significant risks identified.</div></div>`;
    }

    // Computed averages display
    if (data.computed) {
      const c = data.computed;
      html += `<div class="section-label" style="margin-top:20px;">Computed from ${c.days_analyzed} Days</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
          <span style="background:rgba(139,92,246,0.1);color:var(--text-secondary);font-size:11px;font-weight:500;padding:4px 10px;border-radius:8px;">SpO₂ avg ${c.avg_spo2}%</span>
          <span style="background:rgba(239,68,68,0.1);color:var(--red);font-size:11px;font-weight:500;padding:4px 10px;border-radius:8px;">RHR avg ${c.avg_rhr} bpm</span>
          <span style="background:rgba(20,184,166,0.1);color:var(--teal);font-size:11px;font-weight:500;padding:4px 10px;border-radius:8px;">Sleep avg ${c.avg_sleep_hours}h</span>
          <span style="background:rgba(234,179,8,0.1);color:var(--yellow);font-size:11px;font-weight:500;padding:4px 10px;border-radius:8px;">Deep sleep ${c.avg_deep_sleep}h</span>
          <span style="background:rgba(139,92,246,0.1);color:var(--accent);font-size:11px;font-weight:500;padding:4px 10px;border-radius:8px;">HRV avg ${c.avg_hrv} ms</span>
        </div>`;
    }

    // Recommendation
    html += `<div class="section-label" style="margin-top:20px;">Recommendation</div>
      <div class="risk-recommendation">
        <div class="text">All observed deviations are within the window of reversibility through lifestyle adjustments. Prioritise sleep extension to 7–8h, maintain consistent bedtimes, and monitor SpO₂ and RHR trends. Your outlier recovery score of 98 proves capacity exists — <strong>you can.</strong></div>
      </div>`;

    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div class="glass-card"><div class="text" style="text-align:center;">Failed to load risk projection.</div></div>`;
  }
}

function avgMetrics(points) {
  const keys = ['hrv', 'rhr', 'recovery_score', 'sleep_hours', 'spo2', 'deep_sleep', 'deficit', 'respiratory_rate', 'strain'];
  const sums = {};
  keys.forEach(k => sums[k] = 0);
  let count = 0;
  points.forEach(p => {
    keys.forEach(k => {
      if (p[k] != null) sums[k] += p[k];
    });
    count++;
  });
  const avg = {};
  keys.forEach(k => avg[k] = count ? sums[k] / count : 0);
  return avg;
}

function tripSummary(trip, home) {
  const parts = [];
  const hrvDelta = trip.hrv - home.hrv;
  const rhrDelta = trip.rhr - home.rhr;
  const recDelta = trip.recovery_score - home.recovery_score;
  const sleepDelta = trip.sleep_hours - home.sleep_hours;

  if (Math.abs(hrvDelta) < 2 && Math.abs(rhrDelta) < 2 && Math.abs(recDelta) < 5) {
    return 'Trip metrics are consistent with home baseline. No significant physiological impact detected from the change in environment or routine. Continue current regimen and monitor for accumulating effects over extended travel.';
  }

  if (hrvDelta < -5) parts.push(`HRV declined by ${Math.abs(hrvDelta).toFixed(1)}ms during trip (${trip.hrv.toFixed(0)}ms vs ${home.hrv.toFixed(0)}ms home baseline), suggesting increased autonomic stress from travel.`);
  else if (hrvDelta > 5) parts.push(`HRV improved by ${hrvDelta.toFixed(1)}ms during trip, suggesting positive adaptation to the change in environment.`);

  if (rhrDelta > 3) parts.push(`RHR elevated by ${rhrDelta.toFixed(1)}bpm during trip (${trip.rhr.toFixed(0)}bpm vs ${home.rhr.toFixed(0)}bpm), likely reflecting jet lag, altered sleep environment, or increased activity.`);
  else if (rhrDelta < -3) parts.push(`RHR decreased by ${Math.abs(rhrDelta).toFixed(1)}bpm during trip, indicating reduced cardiovascular strain.`);

  if (recDelta < -8) parts.push(`Recovery score dropped ${Math.abs(recDelta).toFixed(0)} points (${trip.recovery_score.toFixed(0)} vs ${home.recovery_score.toFixed(0)} home). Travel-related sleep disruption is the likely driver.`);
  else if (recDelta > 8) parts.push(`Recovery score improved ${recDelta.toFixed(0)} points during trip, suggesting the change of environment supported better recovery.`);

  if (sleepDelta < -0.5) parts.push(`Sleep duration decreased by ${Math.abs(sleepDelta).toFixed(1)}h (${trip.sleep_hours.toFixed(1)}h vs ${home.sleep_hours.toFixed(1)}h home), consistent with travel-related sleep disruption.`);
  else if (sleepDelta > 0.5) parts.push(`Sleep duration increased by ${sleepDelta.toFixed(1)}h during trip, likely due to reduced schedule demands.`);

  if (parts.length === 0) {
    return 'Trip metrics show minimal deviation from home baseline. Physiological systems remain stable across environments.';
  }

  parts.push('Consider a recovery-focused transition day upon return to re-establish sleep routines and assess any accumulated deficit.');

  return parts.join(' ');
}

/* ════════════════════════════════════════════
   EXPORT DATA (NEW)
   ════════════════════════════════════════════ */

function exportData(format) {
  const dataToExport = {
    exportDate: new Date().toISOString(),
    brief: currentBrief,
    trend: currentTrend,
  };

  if (format === 'json') {
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `whoop-doctor-export-${formatDateISO()}.json`);
  } else if (format === 'csv') {
    const csv = convertToCSV(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `whoop-doctor-export-${formatDateISO()}.csv`);
  }
}

function convertToCSV(data) {
  // Flatten brief + trend data into CSV rows
  const rows = [];

  // Header
  rows.push('Date,Readiness Score,Readiness Label,Recovery Score,HRV,RHR,Sleep Hours,Deep Sleep,SpO2,Strain,Sleep Deficit');

  // Daily data from brief
  if (data.brief) {
    const m = data.brief.metrics || {};
    rows.push([
      data.brief.date || formatDateISO(),
      data.brief.readiness_score || '',
      data.brief.readiness_label || '',
      m.recovery_score || '',
      m.hrv || '',
      m.rhr || '',
      m.sleep_hours || '',
      m.deep_sleep_hours || '',
      m.spo2 || '',
      m.strain_yesterday || '',
      m.sleep_deficit_hours || '',
    ].join(','));
  }

  // Trend data rows
  if (data.trend && data.trend.trends) {
    data.trend.trends.forEach(t => {
      const m = t.metrics || t;
      rows.push([
        t.date || '',
        '',
        '',
        m.recovery_score || '',
        m.hrv || '',
        m.rhr || '',
        m.sleep_hours || '',
        m.deep_sleep || '',
        m.spo2 || '',
        m.strain || '',
        m.deficit || '',
      ].join(','));
    });
  }

  return rows.join('\n');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function formatDateISO() {
  return new Date().toISOString().split('T')[0];
}

/* ════════════════════════════════════════════
   CUSTOM ALERTS UI (NEW)
   ════════════════════════════════════════════ */

function renderAlertsSettings() {
  const container = document.getElementById('pageProfile');
  if (!container) return;

  // Load saved alerts from localStorage
  const savedAlerts = JSON.parse(localStorage.getItem('whoop_alerts') || '[]');

  const defaultAlerts = [
    { id: 'low_recovery', name: 'Low Recovery Alert', desc: 'Alert when recovery score drops below 35', threshold: 35 },
    { id: 'high_rhr', name: 'High RHR Alert', desc: 'Alert when resting heart rate exceeds 78 bpm', threshold: 78 },
    { id: 'low_hrv', name: 'Low HRV Alert', desc: 'Alert when HRV drops below 25 ms', threshold: 25 },
    { id: 'sleep_deficit', name: 'Sleep Deficit Alert', desc: 'Alert when sleep deficit exceeds 3 hours', threshold: 3 },
    { id: 'low_spo2', name: 'Low SpO₂ Alert', desc: 'Alert when oxygen saturation drops below 93%', threshold: 93 },
  ];

  const alerts = defaultAlerts.map(def => {
    const saved = savedAlerts.find(a => a.id === def.id);
    return { ...def, enabled: saved?.enabled ?? false };
  });

  return `
    <div class="section-label">CUSTOM ALERTS</div>
    <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">
      Configure alerts for specific health thresholds. Alerts trigger in-app when thresholds are breached.
    </div>
    ${alerts.map(alert => `
      <div class="alert-card">
        <div class="alert-info">
          <div class="alert-name">${alert.name}</div>
          <div class="alert-desc">${alert.desc}</div>
        </div>
        <button class="alert-toggle ${alert.enabled ? 'active' : ''}"
                data-alert-id="${alert.id}"
                onclick="toggleAlert('${alert.id}')">
        </button>
      </div>
    `).join('')}
  `;
}

function toggleAlert(alertId) {
  const savedAlerts = JSON.parse(localStorage.getItem('whoop_alerts') || '[]');
  const existing = savedAlerts.find(a => a.id === alertId);

  if (existing) {
    existing.enabled = !existing.enabled;
  } else {
    savedAlerts.push({ id: alertId, enabled: true });
  }

  localStorage.setItem('whoop_alerts', JSON.stringify(savedAlerts));

  // Toggle visual state
  const btn = document.querySelector(`[data-alert-id="${alertId}"]`);
  if (btn) btn.classList.toggle('active');
}

/* ════════════════════════════════════════════
   PROFILE PAGE
   ════════════════════════════════════════════ */

function renderProfile() {
  const container = document.getElementById('pageProfile');
  if (!container) return;
  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">WD</div>
      <div class="profile-name">Whoop Doctor</div>
      <div class="profile-status connected">● Connected to Whoop</div>
    </div>

    <div class="glass-card" style="text-align:center;">
      <div class="text" style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.6;">
        Your Whoop data is retrieved from the clinical analysis API. Reconnect if you need to refresh authorization.
      </div>
      <a id="connectWhoopBtn" class="profile-btn primary" href="#">Connect to Whoop</a>
      <button id="refreshBtn" class="profile-btn secondary">Refresh Data</button>
    </div>

    <!-- Export Section (NEW) -->
    <div class="section-label">DATA EXPORT</div>
    <div class="export-section">
      <button class="export-btn" onclick="exportData('json')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export as JSON
      </button>
      <button class="export-btn" onclick="exportData('csv')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export as CSV
      </button>
    </div>

    <!-- Custom Alerts Section (NEW) -->
    ${renderAlertsSettings()}

    <div class="section-label">About</div>
    <div class="glass-card">
      <div class="text" style="font-size:13px;color:var(--text-secondary);line-height:1.6;">
        <strong style="color:var(--text);">Whoop Doctor</strong> provides clinical-grade analysis of your Whoop biometric data. The system evaluates readiness, recovery, sleep architecture, and cardiovascular metrics to deliver actionable health insights.
        <br><br>
        Version 1.1 — V1 Jarvis Edition with UX Improvements
      </div>
    </div>
    <div style="height:40px;"></div>
  `;
  // Re-bind connect button
  setupConnect();
  document.getElementById('refreshBtn')?.addEventListener('click', () => loadBrief());
}
