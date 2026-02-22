// background.js – Video Playback Tracker v2 Service Worker

// ── Startup badge ──────────────────────────────────────────────────────────
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({ lastEntry: null }, ({ lastEntry }) => {
    if (lastEntry) {
      chrome.action.setBadgeText({ text: '▶' });
      chrome.action.setBadgeBackgroundColor({ color: '#e11d48' });
      chrome.action.setTitle({ title: `Resume: ${lastEntry.title} at ${lastEntry.formattedTime}` });
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#e11d48' });
});

// Clear badge when popup opens
chrome.action.onClicked.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});

// ── Resume Reminder (Alarms + Notifications) ───────────────────────────────

// When a new entry is saved, set/reset the reminder alarm
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes.lastEntry?.newValue) return;

  chrome.storage.local.get({ notifyEnabled: false, notifyAfterHours: 3 }, (settings) => {
    if (!settings.notifyEnabled) return;
    chrome.alarms.clear('resumeReminder', () => {
      chrome.alarms.create('resumeReminder', {
        delayInMinutes: Number(settings.notifyAfterHours) * 60,
      });
    });
  });
});

// Fire notification when alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'resumeReminder') return;
  chrome.storage.local.get({ lastEntry: null }, ({ lastEntry }) => {
    if (!lastEntry) return;
    chrome.notifications.create('resumeReminder', {
      type:    'basic',
      iconUrl: 'icons/icon128.png',
      title:   'Continue Watching?',
      message: `${lastEntry.title} — you left off at ${lastEntry.formattedTime}`,
      buttons: [{ title: 'Open & Resume' }],
      requireInteraction: true,
    });
  });
});

// Click notification → open the page
chrome.notifications.onClicked.addListener(() => {
  chrome.storage.local.get({ lastEntry: null }, ({ lastEntry }) => {
    if (lastEntry?.url) chrome.tabs.create({ url: lastEntry.url });
  });
  chrome.notifications.clear('resumeReminder');
});

chrome.notifications.onButtonClicked.addListener((_, btnIdx) => {
  if (btnIdx === 0) {
    chrome.storage.local.get({ lastEntry: null }, ({ lastEntry }) => {
      if (lastEntry?.url) chrome.tabs.create({ url: lastEntry.url });
    });
    chrome.notifications.clear('resumeReminder');
  }
});
