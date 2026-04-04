import re

with open('src/content/frameDetector.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace State
state_old = '''// =====================
// State
// =====================
let _isAutoMode = false;
let _intervalId = null;
let _previousPixels = null;
let _lastSavedPixels = null;
let _cooldownActive = false;'''

state_new = '''// =====================
// State
// =====================
let _isAutoMode = false;
let _intervalId = null;
let _previousPixels = null;
let _lastSavedPixels = null;
let _cooldownActive = false;
let _pendingCapture = false;
let _isProcessing = false;'''
text = text.replace(state_old, state_new)

# Replace startScanning
scan_old = '''function startScanning() {
  if (_intervalId) return; // already running

  _previousPixels = null;
  _lastSavedPixels = null;
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
}'''

scan_new = '''function startScanning() {
  if (_intervalId) return; // already running

  _previousPixels = null;
  _lastSavedPixels = null;
  _cooldownActive = false;
  _pendingCapture = false;
  _isProcessing = false;

  _intervalId = setInterval(async () => {
    if (_cooldownActive || _isProcessing) return;
    _isProcessing = true;

    try {
      const video = getVideoElement();
      if (!video || video.paused || video.ended) return;

      const currentPixels = sampleFrame(video);
      if (!currentPixels) return;

      if (_previousPixels) {
        const changeRatio = compareFrames(_previousPixels, currentPixels);        
        if (changeRatio >= CONFIG.CHANGE_THRESHOLD) {
          _pendingCapture = true;
        }
      }

      if (_pendingCapture) {
        let fd;
        try { fd = await import('../utils/faceDetector.js'); } catch(e) {}
        
        let personDetected = false;
        if (fd) personDetected = await fd.hasPerson(video);

        if (!personDetected) {
          // Ensure we don't capture duplicates
          if (_lastSavedPixels) {
             const changeFromSaved = compareFrames(_lastSavedPixels, currentPixels);
             if (changeFromSaved < 0.05) {
                _pendingCapture = false; // Already grabbed this exact slide
             }
          }
          if (_pendingCapture) {
            _pendingCapture = false;
            _lastSavedPixels = currentPixels;
            await onSlideChangeDetected(video);
          }
        } else {
          console.log('[YT Screenshot Notes] Person blocking frame. Waiting...');
        }
      }
      _previousPixels = currentPixels;
    } catch (err) {
       console.error('[YT Scanner Error]', err);
    } finally {
       _isProcessing = false;
    }
  }, CONFIG.CHECK_INTERVAL_MS);

  // Inject a visual indicator on the YouTube player
  injectAutoModeIndicator(true);
}'''
text = text.replace(scan_old, scan_new)

# Remove the faceDetector block from onSlideChangeDetected 
face_old = '''  // Check if a person is seen in the video to prevent false auto-captures      
  try {
    const fd = await import('../utils/faceDetector.js');
    const personDetected = await fd.hasPerson(video);
    if (personDetected) {
      console.log('[YT Screenshot Notes] Person detected. Skipping auto-screenshot.');
      return;
    }
  } catch (err) {
    console.warn('[FaceDetector] Error:', err);
  }

  const frameData = captureFrame(video, 0.9);
  if (!frameData) return;'''

face_new = '''  const frameData = captureFrame(video, 0.9);
  if (!frameData) return;'''
text = text.replace(face_old, face_new)

with open('src/content/frameDetector.js', 'w', encoding='utf-8') as f:
    f.write(text)
