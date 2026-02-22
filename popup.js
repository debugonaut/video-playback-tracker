// popup.js – Video Playback Tracker v2

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────
  let allEntries   = [];
  let searchQuery  = '';
  let isCompact    = false;

  // ─── DOM ──────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const resumeBanner      = $('resumeBanner');
  const resumeTitle       = $('resumeTitle');
  const resumeTime        = $('resumeTime');
  const resumeSite        = $('resumeSite');
  const resumeBtn         = $('resumeBtn');
  const resumeThumb       = $('resumeThumb');
  const resumeThumbWrap   = $('resumeThumbWrap');
  const resumeProgressFill= $('resumeProgressFill');
  const resumePct         = $('resumePct');
  const resumeProgressWrap= $('resumeProgressWrap');
  const emptyState        = $('emptyState');
  const noResults         = $('noResults');
  const historyToolbar    = $('historyToolbar');
  const historyList       = $('historyList');
  const entryCount        = $('entryCount');
  const clearAllBtn       = $('clearAllBtn');
  const compactToggle     = $('compactToggle');
  const searchInput       = $('searchInput');
  const searchClear       = $('searchClear');

  const statTotal         = $('statTotal');
  const statTime          = $('statTime');
  const statSites         = $('statSites');
  const statPinned        = $('statPinned');
  const topSitesList      = $('topSitesList');
  const statsEmpty        = $('statsEmpty');

  const manualTitle       = $('manualTitle');
  const manualUrl         = $('manualUrl');
  const manualTime        = $('manualTime');
  const formError         = $('formError');
  const saveManualBtn     = $('saveManualBtn');
  const exportBtn         = $('exportBtn');
  const importBtn         = $('importBtn');
  const importFile        = $('importFile');
  const notifyToggle      = $('notifyToggle');
  const notifyDelay       = $('notifyDelay');
  const notifyDelayRow    = $('notifyDelayRow');
  const saveSettingsBtn   = $('saveSettingsBtn');
  const settingsSaved     = $('settingsSaved');

  // ─── Helpers ──────────────────────────────────────────────────────

  function fmt(s) {
    if (isNaN(s) || s < 0) return '0:00';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  function fmtTotal(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function ago(iso) {
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.floor(d / 60000), h = Math.floor(d / 3600000), dy = Math.floor(d / 86400000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${dy}d ago`;
  }

  function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url || 'Unknown'; }
  }

  function parseTs(str) {
    str = str.trim().replace(/s$/i, '');
    const p = str.split(':').map(Number);
    if (p.some(isNaN)) return null;
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    if (p.length === 1) return p[0];
    return null;
  }

  function showErr(msg) {
    formError.textContent = msg;
    formError.classList.remove('hidden');
    setTimeout(() => formError.classList.add('hidden'), 3500);
  }

  function esc(str) { return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ─── Tabs ─────────────────────────────────────────────────────────

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
      if (btn.dataset.tab === 'stats') renderStats();
    });
  });

  // ─── Render History ───────────────────────────────────────────────

  function filteredEntries() {
    if (!searchQuery) return allEntries;
    const q = searchQuery.toLowerCase();
    return allEntries.filter(e => e.title.toLowerCase().includes(q));
  }

  function renderHistory() {
    const entries = filteredEntries();
    historyList.innerHTML = '';

    const hasAll   = allEntries.length > 0;
    const hasFiltered = entries.length > 0;
    const searching = !!searchQuery;

    resumeBanner.classList.toggle('hidden', !hasAll || searching);
    emptyState.classList.toggle('hidden', hasAll);
    noResults.classList.toggle('hidden', !searching || hasFiltered);
    historyToolbar.classList.toggle('hidden', !hasAll);

    // Resume banner
    if (hasAll && !searching) {
      const top = allEntries[0];
      resumeTitle.textContent = top.title;
      resumeTime.textContent  = top.formattedTime || fmt(top.timestamp);
      resumeSite.textContent  = top.url ? host(top.url) : 'manual';

      // Thumbnail in banner
      if (top.thumbnail) {
        resumeThumb.src = top.thumbnail;
        resumeThumb.classList.remove('hidden');
        resumeThumb.onerror = () => {
          resumeThumb.classList.add('hidden');
          resumeThumbWrap.innerHTML = `<span title="${esc(top.title)}">${esc((top.title[0] || '?').toUpperCase())}</span>`;
        };
      } else {
        resumeThumb.classList.add('hidden');
        resumeThumbWrap.innerHTML = `<span style="font-size:24px;color:var(--accent)">${esc((top.title[0] || '?').toUpperCase())}</span>`;
      }

      // Progress bar in banner
      if (top.progress != null) {
        resumeProgressWrap.classList.remove('hidden');
        resumeProgressFill.style.width = `${top.progress}%`;
        resumePct.textContent = `${top.progress}%`;
      } else {
        resumeProgressWrap.classList.add('hidden');
      }

      resumeBtn.onclick = () => {
        if (top.url) chrome.tabs.create({ url: top.url });
        chrome.action.setBadgeText({ text: '' });
      };
    }

    // Count
    entryCount.textContent = allEntries.length;

    // Sort: pinned first, then by savedAt desc
    const sorted = [...entries].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

    sorted.forEach(entry => {
      const li = document.createElement('li');
      li.className = `history-item${entry.pinned ? ' pinned' : ''}`;
      li.dataset.id = entry.id;

      const thumbHtml = entry.thumbnail
        ? `<img class="item-thumb" src="${esc(entry.thumbnail)}" alt=""
             onerror="this.parentElement.innerHTML=\`<div class='thumb-placeholder'>${esc((entry.title[0]||'?').toUpperCase())}</div>\`" />`
        : `<div class="thumb-placeholder">${esc((entry.title[0]||'?').toUpperCase())}</div>`;

      const pinHtml  = entry.pinned ? `<span class="pin-badge">📌</span>` : '';
      const h = entry.url ? host(entry.url) : 'manual';
      const favSrc = entry.favicon || `https://www.google.com/s2/favicons?sz=16&domain=${h}`;

      const progressHtml = entry.progress != null ? `
        <div class="item-progress-wrap">
          <div class="item-progress-track">
            <div class="item-progress-fill" style="width:${entry.progress}%"></div>
          </div>
          <span class="item-pct">${entry.progress}%</span>
        </div>` : '';

      const noteDisplay = entry.note
        ? `<div class="item-note-display">"${esc(entry.note)}"</div>` : '';

      const pinIcon = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M16 9V4l1 0V2H7v2h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>`;
      const noteIcon = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
      const doneIcon = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
      const deleteIcon = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

      li.innerHTML = `
        <div class="item-thumb-wrap">
          ${thumbHtml}
          ${pinHtml}
        </div>
        <div class="item-body">
          <div class="item-title" title="${esc(entry.title)}">${esc(entry.title)}</div>
          ${progressHtml}
          <div class="item-meta">
            <img class="item-favicon" src="${favSrc}" alt="" onerror="this.style.display='none'" />
            <span class="item-time">${entry.formattedTime || fmt(entry.timestamp)}</span>
            <span class="item-dot">·</span>
            <span class="item-site">${esc(h)}</span>
            <span class="item-date">${ago(entry.savedAt)}</span>
          </div>
          ${noteDisplay}
          <div class="item-note-row hidden">
            <input class="note-input" placeholder="Add a quick note... (Enter to save)" value="${esc(entry.note || '')}" />
          </div>
        </div>
        <div class="item-actions">
          <button class="action-btn btn-pin${entry.pinned ? ' active' : ''}" title="${entry.pinned ? 'Unpin' : 'Pin'}">${pinIcon}</button>
          <button class="action-btn btn-note" title="Add note">${noteIcon}</button>
          <button class="action-btn btn-done" title="Mark as done">${doneIcon}</button>
          <button class="action-btn btn-delete" title="Remove">${deleteIcon}</button>
        </div>`;

      // Open URL on row click (not on buttons)
      li.addEventListener('click', e => {
        if (e.target.closest('.item-actions') || e.target.closest('.item-note-row') || e.target.closest('.note-input')) return;
        if (entry.url) chrome.tabs.create({ url: entry.url });
      });

      // Pin
      li.querySelector('.btn-pin').addEventListener('click', e => {
        e.stopPropagation();
        updateEntry(entry.id, { pinned: !entry.pinned });
      });

      // Note toggle
      const noteRow  = li.querySelector('.item-note-row');
      const noteInput = li.querySelector('.note-input');
      li.querySelector('.btn-note').addEventListener('click', e => {
        e.stopPropagation();
        noteRow.classList.toggle('hidden');
        if (!noteRow.classList.contains('hidden')) noteInput.focus();
      });
      noteInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          updateEntry(entry.id, { note: noteInput.value.trim() });
          noteRow.classList.add('hidden');
        }
        if (e.key === 'Escape') noteRow.classList.add('hidden');
      });
      noteInput.addEventListener('click', e => e.stopPropagation());

      // Mark done
      li.querySelector('.btn-done').addEventListener('click', e => {
        e.stopPropagation();
        li.style.transform = 'scale(0.95)';
        li.style.opacity = '0';
        li.style.transition = 'all 0.3s ease';
        setTimeout(() => deleteEntry(entry.id), 280);
      });

      // Delete
      li.querySelector('.btn-delete').addEventListener('click', e => {
        e.stopPropagation();
        deleteEntry(entry.id);
      });

      historyList.appendChild(li);
    });
  }

  // ─── Stats ────────────────────────────────────────────────────────

  function renderStats() {
    if (allEntries.length === 0) {
      statsEmpty.classList.remove('hidden');
      statTotal.textContent  = '0';
      statTime.textContent   = '0m';
      statSites.textContent  = '0';
      statPinned.textContent = '0';
      topSitesList.innerHTML = '';
      return;
    }
    statsEmpty.classList.add('hidden');

    const totalSecs = allEntries.reduce((s, e) => s + (e.timestamp || 0), 0);
    const sites     = {};
    allEntries.forEach(e => {
      const s = e.url ? host(e.url) : 'manual';
      sites[s] = (sites[s] || 0) + 1;
    });
    const topSites  = Object.entries(sites).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxCount  = topSites[0]?.[1] || 1;

    statTotal.textContent  = allEntries.length;
    statTime.textContent   = fmtTotal(totalSecs);
    statSites.textContent  = Object.keys(sites).length;
    statPinned.textContent = allEntries.filter(e => e.pinned).length;

    topSitesList.innerHTML = topSites.map(([name, count]) => `
      <li class="top-site-item">
        <img class="top-site-favicon" src="https://www.google.com/s2/favicons?sz=16&domain=${esc(name)}" onerror="this.style.display='none'" alt="" />
        <span class="top-site-name">${esc(name)}</span>
        <div class="top-site-bar-wrap">
          <div class="top-site-bar" style="width:${Math.round((count/maxCount)*100)}%"></div>
        </div>
        <span class="top-site-count">${count}</span>
      </li>`).join('');
  }

  // ─── Storage helpers ──────────────────────────────────────────────

  function load() {
    chrome.storage.local.get({ entries: [] }, data => {
      allEntries = data.entries || [];
      renderHistory();
      chrome.action.setBadgeText({ text: '' });
    });
  }

  function save(entries, cb) {
    const lastEntry = entries[0] || null;
    chrome.storage.local.set({ entries, lastEntry }, cb);
  }

  function updateEntry(id, patch) {
    allEntries = allEntries.map(e => e.id === id ? { ...e, ...patch } : e);
    save(allEntries, () => renderHistory());
  }

  function deleteEntry(id) {
    allEntries = allEntries.filter(e => e.id !== id);
    save(allEntries, () => renderHistory());
  }

  // ─── Actions ──────────────────────────────────────────────────────

  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Clear all watch history?')) return;
    allEntries = [];
    save([], () => renderHistory());
  });

  compactToggle.addEventListener('click', () => {
    isCompact = !isCompact;
    document.body.classList.toggle('compact', isCompact);
    compactToggle.title = isCompact ? 'Card view' : 'Compact view';
    
    compactToggle.innerHTML = isCompact 
      ? `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z"/></svg>`
      : `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 10h10v4H7v-4z"/></svg>`;
  });

  // Search
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    searchClear.classList.toggle('hidden', !searchQuery);
    renderHistory();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.add('hidden');
    renderHistory();
    searchInput.focus();
  });

  // Manual entry
  saveManualBtn.addEventListener('click', () => {
    const title = manualTitle.value.trim();
    const url   = manualUrl.value.trim();
    const ts    = manualTime.value.trim();
    if (!title)  { showErr('Please enter a movie or show name.'); return; }
    if (!ts)     { showErr('Please enter a timestamp (e.g. 1:24:55).'); return; }
    const secs = parseTs(ts);
    if (secs === null || secs < 0) { showErr('Invalid timestamp. Use format like 1:24:55 or 84:55.'); return; }

    let favicon = 'icons/icon48.png';
    if (url) { try { favicon = `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`; } catch {} }

    const entry = {
      id: Date.now(), title, url: url || null,
      timestamp: secs, formattedTime: fmt(secs), duration: null, progress: null,
      favicon, thumbnail: null, savedAt: new Date().toISOString(),
      pinned: false, note: '', manual: true,
    };

    allEntries = [entry, ...allEntries].slice(0, 20);
    save(allEntries, () => {
      manualTitle.value = manualUrl.value = manualTime.value = '';
      renderHistory();
      // Switch to history tab
      document.querySelector('[data-tab="history"]').click();
    });
  });
  manualTime.addEventListener('keydown', e => { if (e.key === 'Enter') saveManualBtn.click(); });

  // Export
  exportBtn.addEventListener('click', () => {
    const json = JSON.stringify({ version: 2, exported: new Date().toISOString(), entries: allEntries }, null, 2);
    const a = document.createElement('a');
    a.href = 'data:application/json,' + encodeURIComponent(json);
    a.download = `playback-tracker-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });

  // Import
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        const imported = Array.isArray(data) ? data : (data.entries || []);
        if (!imported.length) { alert('No entries found in file.'); return; }
        // Merge: keep unique IDs, imported entries take priority
        const existingIds = new Set(allEntries.map(x => x.id));
        const merged = [...imported, ...allEntries.filter(x => !imported.find(i => i.id === x.id))].slice(0, 20);
        allEntries = merged;
        save(allEntries, () => { renderHistory(); alert(`Imported ${imported.length} entries.`); });
      } catch { alert('Invalid JSON file.'); }
      importFile.value = '';
    };
    reader.readAsText(file);
  });

  // Settings
  notifyToggle.addEventListener('change', () => {
    notifyDelayRow.classList.toggle('hidden', !notifyToggle.checked);
  });

  saveSettingsBtn.addEventListener('click', () => {
    const notifyEnabled     = notifyToggle.checked;
    const notifyAfterHours  = Number(notifyDelay.value);
    chrome.storage.local.set({ notifyEnabled, notifyAfterHours }, () => {
      settingsSaved.classList.remove('hidden');
      setTimeout(() => settingsSaved.classList.add('hidden'), 3000);
    });
  });

  // Load settings
  function loadSettings() {
    chrome.storage.local.get({ notifyEnabled: false, notifyAfterHours: 3 }, data => {
      notifyToggle.checked = data.notifyEnabled;
      notifyDelay.value    = data.notifyAfterHours;
      notifyDelayRow.classList.toggle('hidden', !data.notifyEnabled);
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────
  load();
  loadSettings();
})();
