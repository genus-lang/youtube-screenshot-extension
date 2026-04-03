/**
 * canvasCapture.js
 * Logic for capturing an image from a given video element.
 * Reads the user's quality preference from chrome.storage.
 */

/**
 * Captures the current frame of a video element as a base64 JPEG.
 * @param {HTMLVideoElement} video
 * @param {number} quality - JPEG quality 0-1 (default 0.9)
 * @returns {string|null} data URL or null if no video
 */
export function captureFrame(video, quality = 0.9) {
  if (!video) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Captures a frame using the user's preferred quality setting.
 * Falls back to 0.9 if no preference is set.
 */
export function captureFrameWithPreference(video) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pref_quality'], (data) => {
      const quality = parseFloat(data.pref_quality) || 0.9;
      resolve(captureFrame(video, quality));
    });
  });
}
