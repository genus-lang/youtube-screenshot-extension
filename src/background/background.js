/**
 * background.js
 * Service worker - handles saving screenshots, OCR extraction, and alarms.
 */
import { saveScreenshot } from '../storage/storage.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension Installed!');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'PONG' });

  } else if (request.action === 'SAVE_SCREENSHOT') {
    const { videoId, videoTitle, frameData, timestamp, noteText, subject } = request.payload;
    saveScreenshot(videoId, videoTitle, frameData, timestamp, noteText, subject)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;

  } else if (request.action === 'EXTRACT_OCR') {
    // Run Tesseract in the background worker — no CSP restrictions here
    const { imageDataUrl } = request.payload;
    (async () => {
      try {
        // Dynamically import tesseract so it only loads when needed
        const Tesseract = (await import('tesseract.js')).default;
        const { data: { text } } = await Tesseract.recognize(imageDataUrl, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              // Broadcast progress back to the content script
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                  chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'OCR_PROGRESS',
                    progress: m.progress
                  }).catch(() => {});
                }
              });
            }
          }
        });
        sendResponse({ success: true, text: text.trim() });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // keep async channel open
  }

  return true;
});

// Auto Generate PDF Alarm (1 day interval)
chrome.alarms.create('autoPDF', {
  delayInMinutes: 1440,
  periodInMinutes: 1440
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoPDF') {
    chrome.storage.local.get(null, (data) => {
      chrome.runtime.sendMessage({ action: 'GENERATE_PDF', payload: data });
    });
  }
});
