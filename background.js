// background.js – Video Playback Tracker Service Worker
// Shows a reminder notification/badge when the browser starts.

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({ lastEntry: null }, (data) => {
    if (data.lastEntry) {
      const entry = data.lastEntry;
      // Set badge to remind user
      chrome.action.setBadgeText({ text: '▶' });
      chrome.action.setBadgeBackgroundColor({ color: '#a855f7' });
      chrome.action.setTitle({
        title: `Resume: ${entry.title} at ${entry.formattedTime}`
      });
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#a855f7' });
});

// Clear badge when popup is opened
chrome.action.onClicked.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});
