/**
 * frameDetector.js
 * Smart auto-detection of significant frame changes in YouTube videos.
 *
 * HOW IT WORKS:
 * 1. Every N seconds, capture the current video frame to a small canvas
 * 2. Convert it to grayscale pixel data (cheaper to compare, immune to color noise)
 * 3. Compare against the previous frame's pixel data
 * 4. If the % of changed pixels exceeds a threshold → "slide change" detected
 * 5. Auto-save the screenshot with an "[Auto]" note
 *
 * This is intentionally designed to detect PRESENTATION SLIDES, not regular
 * video motion. We use a high change threshold (~15-25%) and a cooldown
 * to avoid triggering on camera cuts or minor animations.
 */
import { getVideoElement } from './videoController.js';
import { captureFrame } from './canvasCapture.js';
import { formatTime } from '../utils/helpers.js';

// =====================
// State
// =====================
let _isAutoMode = false;
let _intervalId = null;
let _previousPixels = null;
let _cooldownActive = false;

// =====================
// Config (tuneable)
// =====================
const CONFIG = {
  CHECK_INTERVAL_MS: 2000,      // Compare frames every 2 seconds
  SAMPLE_WIDTH: 160,             // Downscale to 160px wide for perf
  SAMPLE_HEIGHT: 90,             // 16:9 aspect ratio
  CHANGE_THRESHOLD: 0.18,        // 18% of pixels must differ to trigger
  PIXEL_DIFF_THRESHOLD: 40,      // Individual pixel must differ by 40+ (0-255 grayscale)
  COOLDOWN_MS: 5000,             // After a detection, wait 5s before checking again
};

// =====================
// Public API
// =====================

/**
 * Called once on content script load.
 * Sets up the detector (does NOT start scanning — that's toggleAutoMode).
 */
export function initFrameDetector() {
  console.log('[YT Screenshot Notes] Frame detector ready');
}

/**
 * Toggles auto-mode on/off. Returns the new state.
 */
export function toggleAutoMode() {
  _isAutoMode = !_isAutoMode;

  if (_isAutoMode) {
    startScanning();
  } else {
    stopScanning();
  }

  console.log(`[YT Screenshot Notes] Auto mode: ${_isAutoMode ? 'ON' : 'OFF'}`);
  return _isAutoMode;
}

/**
 * Returns whether auto mode is currently active.
 */
export function isAutoModeActive() {
  return _isAutoMode;
}

// =====================
// Scanning Loop
// =====================

function startScanning() {
  if (_intervalId) return; // already running

  _previousPixels = null;
  _cooldownActive = false;

  _intervalId = setInterval(() => {
    if (_cooldownActive) return;

    const video = getVideoElement();
    if (!video || video.paused || video.ended) return;

    const currentPixels = sampleFrame(video);
    if (!currentPixels) return;

    if (_previousPixels) {
      const changeRatio = compareFrames(_previousPixels, currentPixels);

      if (changeRatio >= CONFIG.CHANGE_THRESHOLD) {
        onSlideChangeDetected(video);
      }
    }

    _previousPixels = currentPixels;
  }, CONFIG.CHECK_INTERVAL_MS);

  // Inject a visual indicator on the YouTube player
  injectAutoModeIndicator(true);
}

function stopScanning() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  _previousPixels = null;
  _cooldownActive = false;

  injectAutoModeIndicator(false);
}

// =====================
// Core CV Logic
// =====================

/**
 * Downscales the current video frame and returns grayscale pixel data.
 * @returns {Uint8ClampedArray|null} grayscale pixel array
 */
function sampleFrame(video) {
  if (!video.videoWidth || !video.videoHeight) return null;

  const canvas = document.createElement('canvas');
  canvas.width = CONFIG.SAMPLE_WIDTH;
  canvas.height = CONFIG.SAMPLE_HEIGHT;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, CONFIG.SAMPLE_WIDTH, CONFIG.SAMPLE_HEIGHT);

  const imageData = ctx.getImageData(0, 0, CONFIG.SAMPLE_WIDTH, CONFIG.SAMPLE_HEIGHT);
  const rgba = imageData.data;

  // Convert to grayscale (luminance formula)
  const grayscale = new Uint8ClampedArray(CONFIG.SAMPLE_WIDTH * CONFIG.SAMPLE_HEIGHT);
  for (let i = 0; i < grayscale.length; i++) {
    const offset = i * 4;
    grayscale[i] = Math.round(
      0.299 * rgba[offset]     +  // R
      0.587 * rgba[offset + 1] +  // G
      0.114 * rgba[offset + 2]    // B
    );
  }

  return grayscale;
}

/**
 * Compares two grayscale frames pixel-by-pixel.
 * @returns {number} ratio of changed pixels (0.0 to 1.0)
 */
function compareFrames(prev, curr) {
  if (prev.length !== curr.length) return 1; // size mismatch = definitely changed

  let changedPixels = 0;
  const totalPixels = prev.length;

  for (let i = 0; i < totalPixels; i++) {
    if (Math.abs(prev[i] - curr[i]) > CONFIG.PIXEL_DIFF_THRESHOLD) {
      changedPixels++;
    }
  }

  return changedPixels / totalPixels;
}

// =====================
// Slide Change Handler
// =====================

async function onSlideChangeDetected(video) {
  console.log('[YT Screenshot Notes] 🎯 Slide change detected!');

  _cooldownActive = true;
  setTimeout(() => { _cooldownActive = false; }, CONFIG.COOLDOWN_MS);

  const frameData = captureFrame(video, 0.9);
  if (!frameData) return;

  const timestamp = formatTime(video.currentTime);

  let videoId = 'unknown';
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('v')) videoId = urlParams.get('v');

  let videoTitle = document.title.replace(' - YouTube', '').trim();
  const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')
    || document.querySelector('h1.ytd-video-primary-info-renderer')
    || document.querySelector('#title h1');
  if (titleEl && titleEl.textContent.trim()) {
    videoTitle = titleEl.textContent.trim();
  }

  let noteText = `[Auto] Slide change detected at ${timestamp}`;

  // Try OCR via background worker (no CSP issues)
  try {
    const ocrResult = await new Promise(resolve => {
      chrome.runtime.sendMessage(
        { action: 'EXTRACT_OCR', payload: { imageDataUrl: frameData } },
        resolve
      );
    });
    if (ocrResult && ocrResult.success && ocrResult.text && ocrResult.text.length > 5) {
      noteText = `[Auto @ ${timestamp}]\n${ocrResult.text}`;
    }
  } catch (err) {
    console.warn('[OCR] Auto-extraction failed:', err.message);
  }

  // Get active subject and save via background worker
  chrome.storage.local.get(['active_subject'], (res) => {
    const subject = res.active_subject || 'General';
    chrome.runtime.sendMessage({
      action: 'SAVE_SCREENSHOT',
      payload: { videoId, videoTitle, frameData, timestamp, noteText, subject }
    });
  });

  flashIndicator();
}

// =====================
// Visual Indicator (on the YouTube player)
// =====================

function injectAutoModeIndicator(active) {
  let indicator = document.getElementById('yt-auto-mode-indicator');

  if (!active) {
    if (indicator) indicator.remove();
    return;
  }

  if (indicator) return; // already exists

  indicator = document.createElement('div');
  indicator.id = 'yt-auto-mode-indicator';
  indicator.innerHTML = `
    <span class="yt-auto-dot"></span>
    <span class="yt-auto-label">AUTO</span>
  `;

  // Try to place it inside the YouTube player
  const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  if (player) {
    player.appendChild(indicator);
  }
}

function flashIndicator() {
  const indicator = document.getElementById('yt-auto-mode-indicator');
  if (!indicator) return;

  indicator.classList.add('yt-auto-flash');
  setTimeout(() => indicator.classList.remove('yt-auto-flash'), 600);
}
