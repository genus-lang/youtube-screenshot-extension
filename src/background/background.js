/**
 * background.js
 * Service worker for messaging, notifications, and long-running tasks
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension Installed!');
});

import { saveScreenshot } from '../storage/storage.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'PONG' });
  } else if (request.action === 'SAVE_SCREENSHOT') {
    // Handle saving transparently in the background script origin!
    const { videoId, videoTitle, frameData, timestamp, noteText } = request.payload;
    saveScreenshot(videoId, videoTitle, frameData, timestamp, noteText)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
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

