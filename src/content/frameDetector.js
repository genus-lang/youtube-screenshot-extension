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
import { extractText } from './ocrEngine.js';
import { hasPerson, initFaceDetector } from '../utils/faceDetector.js';

// =====================
// State
// =====================
let _isAutoMode = false;
let _intervalId = null;
let _previousPixels = null;
let _lastSavedPixels = null;
let _cooldownActive = false;
let _pendingCapture = false;
let _isProcessing = false;


// =====================
// Config (tuneable)
// =====================
const CONFIG = {
  CHECK_INTERVAL_MS: 3000,       // Compare frames every 3 seconds
  SAMPLE_WIDTH: 160,             // Downscale to 160px wide for perf
  SAMPLE_HEIGHT: 90,             // 16:9 aspect ratio
  CHANGE_THRESHOLD: 0.03,        // 3% of pixels must differ to trigger (extremely sensitive)
  PIXEL_DIFF_THRESHOLD: 20,      // Individual pixel must differ by 20+ (0-255 grayscale)
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
// Scanning Loop & Events
// =====================

async function handlePauseEvent(e) {
  if (!_isAutoMode) return;
  
  const video = getVideoElement();
  if (!video || e.target !== video) return;

  console.log('[YT Screenshot Notes] Video paused! Running instant face check...');
  
  try {
    const personDetected = await hasPerson(video);

    if (!personDetected) {
      console.log('[YT Screenshot Notes] No person detected! Taking immediate screenshot.');
      captureAndSaveSlide(video);
    } else {
      console.log('[YT Screenshot Notes] Person detected on pause. Screenshot deferred.');
    }
  } catch (err) {
    console.warn('[FaceDetector] Error:', err);
    // Fallback: take screenshot anyway if AI fails
    captureAndSaveSlide(video);
  }
}

function startScanning() {
  if (_intervalId) return; // already running (using as flag)
  _intervalId = true;
  _cooldownActive = false;

  console.log('[YT Screenshot Notes] Starting smart pause-capture mode...');

  // Use capturing phase on window so it survives YouTube SPA navigations!
  window.addEventListener('pause', handlePauseEvent, true);

  // Pre-warm the face detector model so it's instant when paused
  initFaceDetector().catch(() => {});

  // Inject a visual indicator on the YouTube player
  injectAutoModeIndicator(true);
}

function stopScanning() {
  _intervalId = null;
  _cooldownActive = false;

  window.removeEventListener('pause', handlePauseEvent, true);

  console.log('[YT Screenshot Notes] Stopped auto-capture.');
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
  if (prev.length !== curr.length) return 1;

  let changedPixels = 0;
  // Ignore top 15% and bottom 15% where YouTube UI elements (title, progress bar, captions) reside
  const startY = Math.floor(CONFIG.SAMPLE_HEIGHT * 0.15);
  const endY = Math.floor(CONFIG.SAMPLE_HEIGHT * 0.85);
  const totalCheckedPixels = (endY - startY) * CONFIG.SAMPLE_WIDTH;

  for (let y = startY; y < endY; y++) {
    for (let x = 0; x < CONFIG.SAMPLE_WIDTH; x++) {
      const i = y * CONFIG.SAMPLE_WIDTH + x;
      if (Math.abs(prev[i] - curr[i]) > CONFIG.PIXEL_DIFF_THRESHOLD) {
        changedPixels++;
      }
    }
  }

  return changedPixels / totalCheckedPixels;
}

// =====================
// Slide Capture Handler
// =====================

async function captureAndSaveSlide(video) {
  console.log('[YT Screenshot Notes] Taking screenshot immediately (no waiting)...');
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

  let noteText = `[Auto Capture] Captured at ${timestamp}`;

  flashIndicator(); // flash immediately so user knows it captured!

  // Perform OCR quickly via the background or iframe
  try {
    const textValue = await extractText(frameData);
    if (typeof textValue === 'string' && textValue.length > 2) {
      noteText = `[Auto Capture] \n${textValue}`;
      console.log('[YT Screenshot Notes] OCR Success!');
    }
  } catch (err) {
    console.warn('[YT Screenshot Notes] OCR failed:', err.message);
  }

  if (!chrome || !chrome.storage || !chrome.storage.local) {
    console.warn("Extension updated! Please refresh the page to auto-capture.");
    return;
  }

  chrome.storage.local.get(['active_subject'], (res) => {
    const subject = res.active_subject || 'General';
    chrome.runtime.sendMessage({
      action: 'SAVE_SCREENSHOT',
      payload: { videoId, videoTitle, frameData, timestamp, noteText, subject }
    });
    console.log('[YT Screenshot Notes] Auto capture saved to background successfully!');
  });
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
