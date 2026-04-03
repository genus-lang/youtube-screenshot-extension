/**
 * background.js
 * Service worker for messaging, notifications, and long-running tasks
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension Installed!');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'PONG' });
  }
  return true;
});

// Auto Generate PDF Alarm (1 day interval)
chrome.alarms.create("autoPDF", {
  delayInMinutes: 1440,
  periodInMinutes: 1440
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "autoPDF") {
      chrome.storage.local.get(null, (data) => {
          chrome.runtime.sendMessage({
              action: "GENERATE_PDF",
              payload: data
          });
      });
  }
});

