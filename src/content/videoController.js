/**
 * videoController.js
 * Handles interaction with the YouTube HTML5 video element
 */
export function getVideoElement() {
  return document.querySelector('video');
}

export function attachVideoListeners() {
  const video = getVideoElement();
  if (video) {
    video.addEventListener('pause', () => console.log('Video paused'));
    video.addEventListener('play', () => console.log('Video playing'));
  }
}
