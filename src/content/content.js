/**
 * content.js
 * Central entry point for the YouTube content script.
 * Coordinates button injection, video listeners, frame detection,
 * and listens for messages from the popup/background.
 */
import { injectButton } from './uiInjector.js';
import { attachVideoListeners } from './videoController.js';
import { initFrameDetector, toggleAutoMode, isAutoModeActive } from './frameDetector.js';
import { MSG_ACTIONS } from '../utils/constants.js';

console.log('[YT Screenshot Notes] Content script loaded');

function init() {
  injectButton();
  attachVideoListeners();
  initFrameDetector();
}

// YouTube is a SPA — watch for navigation / DOM changes
const observer = new MutationObserver(() => {
  if (!document.querySelector('#yt-screenshot-btn')) {
    init();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial run
init();

// =====================
// Message listener (from popup / background)
// =====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === MSG_ACTIONS.TOGGLE_AUTO) {
    const newState = toggleAutoMode();
    sendResponse({ autoMode: newState });
  }

  if (request.action === 'GET_AUTO_STATUS') {
    sendResponse({ autoMode: isAutoModeActive() });
  }

  return true; // keep sendResponse channel open for async
});
