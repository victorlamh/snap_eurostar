// Eurostar Snap Alert - Web Dashboard Application Logic

let statusPollInterval = null;
let logPollInterval = null;
let historyPollInterval = null;
let nextScanTimer = null;
let targetNextScanTime = null;

// Calendar State
let selectedDates = new Set();
let currentCalDate = new Date();
let calendarInitialized = false;

const monthNamesFr = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Toast helper
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// Base API URL (Defaults to same origin, or window.API_BASE_URL if backend is external)
const API_BASE = window.API_BASE_URL || '';

// Safe JSON fetch helper with detailed error reporting
async function safeFetchJson(url, options = {}) {
  try {
    const targetUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    const res = await fetch(targetUrl, options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        message: `Erreur HTTP ${res.status} ${res.statusText} - Le serveur backend est peut-être indisponible ou non démarré.`
      };
    }
    const data = await res.json();
    return { ...data, httpOk: res.ok, status: res.status };
  } catch (err) {
    return {
      success: false,
      message: `Erreur réseau : Impossible de contacter le serveur (${err.message}).`
    };
  }
}

// Calendar UI Functions
function initCalendar() {
  const calPrevBtn = document.getElementById('calPrevMonth');
  const calNextBtn = document.getElementById('calNextMonth');

  if (calPrevBtn) {
    calPrevBtn.addEventListener('click', () => {
      currentCalDate.setMonth(currentCalDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (calNextBtn) {
    calNextBtn.addEventListener('click', () => {
      currentCalDate.setMonth(currentCalDate.getMonth() + 1);
      renderCalendar();
    });
  }

  const btnWeekend = document.getElementById('btnQuickNextWeekend');
  if (btnWeekend) {
    btnWeekend.addEventListener('click', () => {
      selectNextWeekend();
    });
  }

  const btn7Days = document.getElementById('btnQuickNext7Days');
  if (btn7Days) {
    btn7Days.addEventListener('click', () => {
      selectNext7Days();
    });
  }

  const btnClear = document.getElementById('btnQuickClear');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      selectedDates.clear();
      updateCalendarDisplay();
    });
  }

  renderCalendar();
  calendarInitialized = true;
}

function formatDateISO(year, monthIndex, day) {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const title = document.getElementById('calMonthYearTitle');
  if (!grid || !title) return;

  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();

  title.textContent = `${monthNamesFr[month]} ${year}`;
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  let startingDayOfWeek = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayElem = document.createElement('div');
    dayElem.className = 'cal-day disabled';
    dayElem.textContent = prevMonthLastDay - i;
    grid.appendChild(dayElem);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dayElem = document.createElement('div');
    const isoString = formatDateISO(year, month, d);
    const cellDate = new Date(year, month, d);

    dayElem.className = 'cal-day';
    dayElem.textContent = d;

    if (cellDate < today) {
      dayElem.classList.add('disabled');
    } else {
      if (cellDate.getTime() === today.getTime()) {
        dayElem.classList.add('today');
      }

      if (selectedDates.has(isoString)) {
        dayElem.classList.add('selected');
      }

      dayElem.addEventListener('click', () => {
        if (selectedDates.has(isoString)) {
          selectedDates.delete(isoString);
        } else {
          selectedDates.add(isoString);
        }
        updateCalendarDisplay();
      });
    }

    grid.appendChild(dayElem);
  }

  const totalCellsSoFar = startingDayOfWeek + daysInMonth;
  const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    const dayElem = document.createElement('div');
    dayElem.className = 'cal-day disabled';
    dayElem.textContent = i;
    grid.appendChild(dayElem);
  }
}

function updateCalendarDisplay() {
  renderCalendar();

  const datesInput = document.getElementById('datesInput');
  const countSpan = document.getElementById('selectedCount');
  const badgesContainer = document.getElementById('selectedDateBadges');

  const sortedDates = Array.from(selectedDates).sort();

  if (datesInput) {
    datesInput.value = sortedDates.join(', ');
    datesInput.dataset.touched = 'true';
  }

  if (countSpan) {
    countSpan.textContent = sortedDates.length;
  }

  if (badgesContainer) {
    if (sortedDates.length === 0) {
      badgesContainer.innerHTML = '<span class="badge-empty">Cliquez sur les jours du calendrier ci-dessus pour ajouter des dates.</span>';
    } else {
      badgesContainer.innerHTML = sortedDates.map(date => {
        const d = new Date(date + 'T00:00:00');
        const formatted = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        return `
          <span class="date-badge">
            ${formatted} (${date})
            <button type="button" class="badge-remove" onclick="removeSelectedDate('${date}')" title="Supprimer">&times;</button>
          </span>
        `;
      }).join('');
    }
  }
}

window.removeSelectedDate = function(dateStr) {
  selectedDates.delete(dateStr);
  updateCalendarDisplay();
};

function selectNextWeekend() {
  const now = new Date();
  const Saturday = new Date();
  Saturday.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
  const Sunday = new Date(Saturday);
  Sunday.setDate(Saturday.getDate() + 1);

  const isoSat = formatDateISO(Saturday.getFullYear(), Saturday.getMonth(), Saturday.getDate());
  const isoSun = formatDateISO(Sunday.getFullYear(), Sunday.getMonth(), Sunday.getDate());

  selectedDates.add(isoSat);
  selectedDates.add(isoSun);
  updateCalendarDisplay();
}

function selectNext7Days() {
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(now.getDate() + i);
    const iso = formatDateISO(d.getFullYear(), d.getMonth(), d.getDate());
    selectedDates.add(iso);
  }
  updateCalendarDisplay();
}

// Fetch dashboard status
async function fetchStatus() {
  const data = await safeFetchJson('/api/status');
  if (!data.httpOk && !data.isAutoScanning && data.isCheckInProgress === undefined) {
    console.warn('Backend API status check failed:', data.message);
    return;
  }

  // Update Status Badge
  const badge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');

  if (data.isCheckInProgress) {
    badge.className = 'status-badge scanning';
    statusText.textContent = 'Scan en cours...';
  } else if (data.isAutoScanning) {
    badge.className = 'status-badge running';
    statusText.textContent = 'Auto-Scan Actif';
    btnStart.disabled = true;
    btnStop.disabled = false;
  } else {
    badge.className = 'status-badge stopped';
    statusText.textContent = 'Scanner Arrêté';
    btnStart.disabled = false;
    btnStop.disabled = true;
  }

  // Update Metrics
  document.getElementById('totalChecks').textContent = data.totalChecksCount || 0;
  document.getElementById('foundOffers').textContent = data.newOffersFoundCount || 0;
  
  if (data.lastCheckTime) {
    const lastDate = new Date(data.lastCheckTime);
    document.getElementById('lastScanTime').textContent = lastDate.toLocaleTimeString('fr-FR');
  }

  // Update next scan countdown
  if (data.nextCheckTime && data.isAutoScanning) {
    targetNextScanTime = new Date(data.nextCheckTime).getTime();
    startCountdownTimer();
  } else {
    targetNextScanTime = null;
    document.getElementById('nextScanCount').textContent = '--:--';
  }

  // Populate inputs if not focused
  if (data.config) {
    const datesInput = document.getElementById('datesInput');
    const emailInput = document.getElementById('emailInput');
    const intervalInput = document.getElementById('intervalInput');
    const routeSelect = document.getElementById('routeSelect');
    const brandTagline = document.querySelector('.brand-tagline');
    const resendApiKeyInput = document.getElementById('resendApiKeyInput');
    const telegramTokenInput = document.getElementById('telegramTokenInput');
    const telegramChatIdInput = document.getElementById('telegramChatIdInput');
    const telegramEnabledInput = document.getElementById('telegramEnabledInput');

    const routeKey = `${data.config.origin}-${data.config.destination}`;
    if (document.activeElement !== routeSelect && routeSelect) {
      routeSelect.value = routeKey;
    }

    if (brandTagline) {
      if (data.config.origin === '8727100') {
        brandTagline.innerHTML = 'Paris (Gare du Nord) &rarr; Londres (St Pancras)';
      } else {
        brandTagline.innerHTML = 'Londres (St Pancras) &rarr; Paris (Gare du Nord)';
      }
    }

    if (data.config.dates && (!datesInput || !datesInput.dataset.touched)) {
      if (selectedDates.size === 0) {
        data.config.dates.forEach(d => selectedDates.add(d));
        updateCalendarDisplay();
      }
    }

    if (document.activeElement !== emailInput && data.config.alertTo !== undefined) {
      emailInput.value = data.config.alertTo;
    }
    if (document.activeElement !== resendApiKeyInput && data.config.resendApiKeySet && !resendApiKeyInput.value) {
      resendApiKeyInput.placeholder = '•••••••••••••••• (Clé Resend active)';
    }
    if (document.activeElement !== intervalInput && data.config.checkIntervalSeconds) {
      intervalInput.value = data.config.checkIntervalSeconds;
    }


    if (document.activeElement !== telegramTokenInput && data.config.telegramBotToken !== undefined) {
      telegramTokenInput.value = data.config.telegramBotToken;
    }
    if (document.activeElement !== telegramChatIdInput && data.config.telegramChatId !== undefined) {
      telegramChatIdInput.value = data.config.telegramChatId;
    }
    if (document.activeElement !== telegramEnabledInput && data.config.telegramEnabled !== undefined) {
      telegramEnabledInput.checked = !!data.config.telegramEnabled;
    }
  }
}

// Countdown timer display
function startCountdownTimer() {
  if (nextScanTimer) clearInterval(nextScanTimer);

  function update() {
    if (!targetNextScanTime) {
      document.getElementById('nextScanCount').textContent = '--:--';
      return;
    }
    const diff = Math.max(0, Math.floor((targetNextScanTime - Date.now()) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    document.getElementById('nextScanCount').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  update();
  nextScanTimer = setInterval(update, 1000);
}

// Fetch logs
async function fetchLogs() {
  const data = await safeFetchJson('/api/logs');
  if (!data.logs) return;

  const terminal = document.getElementById('logTerminal');
  const isAtBottom = terminal.scrollHeight - terminal.clientHeight <= terminal.scrollTop + 30;

  terminal.innerHTML = data.logs.map(entry => {
    const levelClass = entry.level.toLowerCase();
    const timeStr = new Date(entry.timestamp).toLocaleTimeString('fr-FR');
    return `<div class="log-line ${levelClass}">[${timeStr}] [${entry.level}] ${escapeHtml(entry.message)}</div>`;
  }).join('');

  if (isAtBottom) {
    terminal.scrollTop = terminal.scrollHeight;
  }
}

// Fetch History
async function fetchHistory() {
  const data = await safeFetchJson('/api/history');
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  if (!data.history || data.history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          Aucune offre Snap détectée pour le moment. Lancez un scan pour vérifier la disponibilité !
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = data.history.map(row => {
    const bookingUrl = `https://snap.eurostar.com/fr-fr/search?adult=1&outbound=${row.date}`;
    const dateFormatted = new Date(row.sent_at).toLocaleString('fr-FR');
    const statusBadge = row.status === 'EMAIL_SENT'
      ? '<span style="color: var(--success); font-weight: 600;">✅ Email envoyé</span>'
      : '<span style="color: var(--warning); font-weight: 600;">⚠️ Détecté</span>';
    return `
      <tr>
        <td><strong>${escapeHtml(row.date)}</strong></td>
        <td>${escapeHtml(row.time_slot)}</td>
        <td><span class="price-tag">${escapeHtml(row.price)}</span></td>
        <td>${statusBadge}</td>
        <td style="color: var(--text-subtle);">${dateFormatted}</td>
        <td>
          <a href="${bookingUrl}" target="_blank" class="btn-book">Réserver sur Snap &rarr;</a>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {

  // Initialize Calendar widget
  initCalendar();

  // Fetch initial data
  fetchStatus();
  fetchLogs();
  fetchHistory();

  // Set intervals
  statusPollInterval = setInterval(fetchStatus, 3000);
  logPollInterval = setInterval(fetchLogs, 2000);
  historyPollInterval = setInterval(fetchHistory, 10000);

  // Scan Instant-Now Button
  document.getElementById('btnScanNow').addEventListener('click', async () => {
    showToast('Scan immédiat lancé en arrière-plan...', 'info');
    const data = await safeFetchJson('/api/scan', { method: 'POST' });
    if (!data.success) {
      showToast(data.message || 'Impossible de lancer le scan.', 'error');
    } else {
      showToast('Scan immédiatement lancé avec succès !', 'success');
      fetchStatus();
      fetchLogs();
    }
  });

  // Start Auto-Scan Button
  document.getElementById('btnStart').addEventListener('click', async () => {
    const data = await safeFetchJson('/api/start', { method: 'POST' });
    if (data.success) {
      showToast('Auto-scanner activé !', 'success');
      fetchStatus();
    } else {
      showToast(data.message || 'Erreur lors de l\'activation.', 'error');
    }
  });

  // Stop Auto-Scan Button
  document.getElementById('btnStop').addEventListener('click', async () => {
    const data = await safeFetchJson('/api/stop', { method: 'POST' });
    if (data.success) {
      showToast('Auto-scanner arrêté.', 'info');
      fetchStatus();
    } else {
      showToast(data.message || 'Erreur lors de l\'arrêt.', 'error');
    }
  });

  // Test Email Button
  document.getElementById('btnTestEmail').addEventListener('click', async () => {
    const btn = document.getElementById('btnTestEmail');
    btn.disabled = true;
    showToast('Envoi d\'un email de test en cours...', 'info');
    const data = await safeFetchJson('/api/test-email', { method: 'POST' });
    if (data.success) {
      showToast('✅ Email de test envoyé avec succès !', 'success');
    } else {
      showToast(`❌ ${data.message}`, 'error');
    }
    btn.disabled = false;
  });

  // Test Telegram Button
  const btnTestTelegram = document.getElementById('btnTestTelegram');
  if (btnTestTelegram) {
    btnTestTelegram.addEventListener('click', async () => {
      btnTestTelegram.disabled = true;
      showToast('Envoi d\'un message Telegram de test en cours...', 'info');
      const data = await safeFetchJson('/api/test-telegram', { method: 'POST' });
      if (data.success) {
        showToast('✅ Message Telegram de test envoyé avec succès !', 'success');
      } else {
        showToast(`❌ ${data.message}`, 'error');
      }
      btnTestTelegram.disabled = false;
    });
  }

  // Refresh History
  document.getElementById('btnRefreshHistory').addEventListener('click', () => {
    fetchHistory();
    showToast('Historique rafraîchi.', 'info');
  });

  // Clear Logs
  document.getElementById('btnClearLogs').addEventListener('click', () => {
    document.getElementById('logTerminal').innerHTML = '<div class="log-line info">[System] Console effacée.</div>';
  });

  // Config Form Submit
  document.getElementById('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dates = Array.from(selectedDates).sort().join(',');
    const alertTo = document.getElementById('emailInput').value;
    const resendApiKey = document.getElementById('resendApiKeyInput').value;
    const checkIntervalSeconds = parseInt(document.getElementById('intervalInput').value, 10);
    const routeValue = document.getElementById('routeSelect').value;
    
    const telegramBotToken = document.getElementById('telegramTokenInput').value;
    const telegramChatId = document.getElementById('telegramChatIdInput').value;
    const telegramEnabled = document.getElementById('telegramEnabledInput').checked;

    const [origin, destination] = routeValue.split('-');

    const data = await safeFetchJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dates,
        alertTo,
        resendApiKey,
        checkIntervalSeconds,
        origin,
        destination,
        telegramBotToken,
        telegramChatId,
        telegramEnabled
      })
    });

    if (data.success) {
      showToast('Configuration et sens du trajet enregistrés avec succès !', 'success');
      fetchStatus();
    } else {
      showToast(data.message || 'Erreur lors de la sauvegarde de la configuration.', 'error');
    }
  });


});

