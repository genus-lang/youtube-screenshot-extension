/**
 * uiInjector.js
 * Injects a screenshot button into the YouTube player controls.
 * On click → captures the current frame → opens the Note UI modal.
 * Respects the user's auto-pause preference.
 */
import { captureFrameWithPreference } from './canvasCapture.js';
import { getVideoElement } from './videoController.js';
import { showNoteUI } from './noteUI.js';
import { formatTime } from '../utils/helpers.js';
import './styles.css';

export function injectButton() {
  const controls = document.querySelector('.ytp-right-controls');
  if (!controls || document.getElementById('yt-screenshot-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'yt-screenshot-btn';
  btn.className = 'ytp-button';
  btn.title = 'Take Screenshot Note';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="12" cy="12" r="3"/>
      <path d="M3 9h2M19 9h2M9 3v2M9 19v2"/>
    </svg>`;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const video = getVideoElement();
    if (!video) return;

    // Check auto-pause preference (default: true)
    const prefs = await new Promise(resolve => {
      chrome.storage.local.get(['pref_autopause'], resolve);
    });
    const shouldPause = prefs.pref_autopause !== false; // default true

    const wasPlaying = !video.paused;
    if (shouldPause && wasPlaying) video.pause();

    const frameData = await captureFrameWithPreference(video);
    const timestamp = formatTime(video.currentTime);

    if (frameData) {
      showNoteUI(frameData, timestamp, shouldPause && wasPlaying);
    }
  });

  controls.prepend(btn);
}
