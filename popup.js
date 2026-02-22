// popup.js – Video Playback Tracker

(function () {
  'use strict';

  // ─── DOM References ────────────────────────────────────────────────
  const resumeBanner    = document.getElementById('resumeBanner');
  const resumeTitle     = document.getElementById('resumeTitle');
  const resumeTime      = document.getElementById('resumeTime');
  const resumeSite      = document.getElementById('resumeSite');
  const resumeBtn       = document.getElementById('resumeBtn');
  const emptyState      = document.getElementById('emptyState');
  const historySection  = document.getElementById('historySection');
  const historyList     = document.getElementById('historyList');
  const entryCount      = document.getElementById('entryCount');
  const clearAllBtn     = document.getElementById('clearAllBtn');
  const toggleManual    = document.getElementById('toggleManual');
  const manualForm      = document.getElementById('manualForm');
  const chevron         = document.getElementById('chevron');
  const manualTitle     = document.getElementById('manualTitle');
  const manualUrl       = document.getElementById('manualUrl');
  const manualTime      = document.getElementById('manualTime');
  const formError       = document.getElementById('formError');
  const saveManualBtn   = document.getElementById('saveManualBtn');

  // ─── Helpers ───────────────────────────────────────────────────────

  function parseTimestamp(str) {
    // Accepts: "1:24:55", "84:55", "5025", "5025s"
    str = str.trim().replace(/s$/i, '');
    const parts = str.split(':').map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return null;
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function relativeTime(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  function hostname(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url; }
  }

  function showError(msg) {
    formError.textContent = msg;
    formError.classList.remove('hidden');
    setTimeout(() => formError.classList.add('hidden'), 3000);
  }

  // ─── Render ────────────────────────────────────────────────────────

  function render(entries) {
    historyList.innerHTML = '';

    if (!entries || entries.length === 0) {
      resumeBanner.classList.add('hidden');
      emptyState.classList.remove('hidden');
      historySection.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    // Resume banner – show the most recent entry
    const latest = entries[0];
    resumeTitle.textContent  = latest.title;
    resumeTime.textContent   = latest.formattedTime || formatTime(latest.timestamp);
    resumeSite.textContent   = latest.url ? hostname(latest.url) : 'Unknown site';
    resumeBanner.classList.remove('hidden');

    resumeBtn.onclick = () => {
      if (latest.url) chrome.tabs.create({ url: latest.url });
    };

    // Clear badge on popup open
    chrome.action.setBadgeText({ text: '' });

    // History list
    historySection.classList.remove('hidden');
    entryCount.textContent = entries.length;

    entries.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'history-item';

      li.innerHTML = `
        <img class="item-favicon"
             src="${entry.favicon || `https://www.google.com/s2/favicons?sz=32&domain=${entry.url ? hostname(entry.url) : 'example.com'}`}"
             alt=""
             onerror="this.src='icons/icon16.png'" />
        <div class="item-info">
          <div class="item-title" title="${entry.title}">${entry.title}</div>
          <div class="item-meta">
            <span class="item-time">${entry.formattedTime || formatTime(entry.timestamp)}</span>
            <span class="item-date">${relativeTime(entry.savedAt)}</span>
          </div>
        </div>
        <button class="item-delete" data-id="${entry.id}" title="Remove entry">✕</button>
      `;

      // Click row → open URL
      li.addEventListener('click', (e) => {
        if (e.target.closest('.item-delete')) return;
        if (entry.url) chrome.tabs.create({ url: entry.url });
      });

      // Delete button
      li.querySelector('.item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteEntry(entry.id);
      });

      historyList.appendChild(li);
    });
  }

  // ─── Storage Operations ────────────────────────────────────────────

  function loadEntries() {
    chrome.storage.local.get({ entries: [] }, (data) => {
      render(data.entries || []);
    });
  }

  function deleteEntry(id) {
    chrome.storage.local.get({ entries: [] }, (data) => {
      const entries = (data.entries || []).filter(e => e.id !== id);
      const lastEntry = entries.length > 0 ? entries[0] : null;
      chrome.storage.local.set({ entries, lastEntry }, loadEntries);
    });
  }

  function clearAll() {
    if (!confirm('Clear all watch history?')) return;
    chrome.storage.local.set({ entries: [], lastEntry: null }, loadEntries);
  }

  function saveManualEntry() {
    const title = manualTitle.value.trim();
    const url   = manualUrl.value.trim();
    const timeStr = manualTime.value.trim();

    if (!title) { showError('Please enter a movie or show name.'); return; }
    if (!timeStr) { showError('Please enter a timestamp (e.g. 1:24:55).'); return; }

    const seconds = parseTimestamp(timeStr);
    if (seconds === null || seconds < 0) {
      showError('Invalid timestamp. Use format like 1:24:55 or 84:55.');
      return;
    }

    let faviconUrl = 'icons/icon48.png';
    if (url) {
      try { faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`; }
      catch {}
    }

    const entry = {
      id: Date.now(),
      title,
      url: url || null,
      timestamp: seconds,
      formattedTime: formatTime(seconds),
      favicon: faviconUrl,
      savedAt: new Date().toISOString(),
      manual: true,
    };

    chrome.storage.local.get({ entries: [] }, (data) => {
      const entries = [entry, ...(data.entries || [])].slice(0, 20);
      chrome.storage.local.set({ entries, lastEntry: entry }, () => {
        manualTitle.value = '';
        manualUrl.value   = '';
        manualTime.value  = '';
        loadEntries();
        // Collapse form
        manualForm.classList.add('hidden');
        chevron.classList.remove('rotated');
      });
    });
  }

  // ─── Event Listeners ───────────────────────────────────────────────

  clearAllBtn.addEventListener('click', clearAll);

  toggleManual.addEventListener('click', () => {
    const isHidden = manualForm.classList.toggle('hidden');
    chevron.classList.toggle('rotated', !isHidden);
  });

  saveManualBtn.addEventListener('click', saveManualEntry);

  // Allow pressing Enter in timestamp field to save
  manualTime.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveManualEntry();
  });

  // ─── Init ──────────────────────────────────────────────────────────
  loadEntries();
})();
