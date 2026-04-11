/**
 * noteUI.js
 * Injects a premium modal overlay onto YouTube when a screenshot is taken.
 * Shows the captured frame preview, a textarea for the user to type a note,
 * and an "Extract Text" button that uses Tesseract OCR to auto-fill notes.
 */
import { getVideoElement } from './videoController.js';

let _wasPlaying = false;

/**
 * Creates the modal DOM once and appends it to the page.
 */
function injectNoteUI() {
  if (document.getElementById('yt-screenshot-modal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'yt-screenshot-modal';
  overlay.className = 'yt-modal-overlay yt-modal-hidden';

  overlay.innerHTML = `
    <div class="yt-modal-card">
      <!-- Header -->
      <div class="yt-modal-header">
        <div class="yt-modal-header-left">
          <span class="yt-modal-icon">📸</span>
          <span class="yt-modal-title">Screenshot Captured</span>
        </div>
        <button id="yt-modal-close" class="yt-modal-close-btn" title="Close (Esc)">✕</button>
      </div>

      <!-- Image Preview -->
      <div class="yt-modal-preview">
        <img id="yt-modal-img" src="" alt="Screenshot preview" />
        <div class="yt-modal-timestamp">
          <span id="yt-modal-time"></span>
        </div>
      </div>

      <!-- Note Input -->
      <div class="yt-modal-body">
        <div class="yt-modal-label-row">
          <label for="yt-modal-note" class="yt-modal-label">Add your note</label>
          
          <button id="yt-modal-record" class="yt-ocr-btn" title="Record Audio Note" style="margin-right: 8px; border-color: #f43f5e; color: #f43f5e;">
            <span class="yt-ocr-icon" id="yt-record-icon">🎙️</span>
            <span id="yt-record-text">Record Audio</span>
          </button>
          <button id="yt-modal-ocr" class="yt-ocr-btn" title="Extract text from screenshot using OCR">
            <span class="yt-ocr-icon">🔍</span>
            <span id="yt-ocr-text">Extract Text</span>
          </button>
        </div>
        <!-- OCR Progress Bar -->
        <div id="yt-ocr-progress-container" class="yt-ocr-progress-container yt-modal-hidden">
          <div id="yt-ocr-progress-bar" class="yt-ocr-progress-bar"></div>
          <span id="yt-ocr-progress-label" class="yt-ocr-progress-label">Initializing OCR...</span>
        </div>
        <textarea
          id="yt-modal-note"
          class="yt-modal-textarea"
          placeholder="What's important on this slide? Type your note here..."
          rows="4"
        ></textarea>
        <!-- Audio Preview -->
        <div id="yt-modal-audio-container" class="yt-modal-hidden" style="margin-top: 8px; display: flex; align-items: center; gap: 8px; background: rgba(244, 63, 94, 0.1); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(244, 63, 94, 0.2);">
          <span style="font-size: 16px;">🎵</span>
          <audio id="yt-modal-audio-player" controls height="30" style="height: 30px; flex: 1; min-width: 100px;"></audio>
          <button id="yt-modal-audio-delete" title="Discard Audio" style="background: none; border: none; color: #f43f5e; cursor: pointer; font-size: 16px;">✕</button>
        </div>
      </div>

      <!-- Actions -->
      <div class="yt-modal-footer">
        <a href="https://ko-fi.com/" target="_blank" style="color: #a78bfa; font-size: 13px; text-decoration: none; font-weight: 500; margin-right: auto;">♥ Support LazyRAR Tech</a>
        <button id="yt-modal-skip" class="yt-modal-btn yt-modal-btn-ghost">Skip Note</button>
        <button id="yt-modal-save" class="yt-modal-btn yt-modal-btn-primary">
          <span>Save</span>
          <kbd class="yt-modal-kbd">Ctrl+Enter</kbd>
        </button>
      </div>

      <!-- Toast -->
      <div id="yt-modal-toast" class="yt-modal-toast yt-modal-hidden">✅ Saved!</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close button
  overlay.querySelector('#yt-modal-close').addEventListener('click', () => closeAndResume());

  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAndResume();
  });

  // Keyboard: Esc to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAndResume();
  });

  // OCR progress listener
  document.addEventListener('ocr-progress', (e) => {
    const pct = Math.round(e.detail * 100);
    const bar = document.getElementById('yt-ocr-progress-bar');
    const label = document.getElementById('yt-ocr-progress-label');
    if (bar) bar.style.width = `${pct}%`;
    if (label) label.textContent = `Extracting text... ${pct}%`;
  });
}

/**
 * Opens the modal with the captured frame data.
 */
export function showNoteUI(frameData, timestamp, wasPlaying) {
  injectNoteUI();
  _wasPlaying = wasPlaying;

  const overlay  = document.getElementById('yt-screenshot-modal');
  const img      = overlay.querySelector('#yt-modal-img');
  const timeEl   = overlay.querySelector('#yt-modal-time');
  const noteEl   = overlay.querySelector('#yt-modal-note');
  const saveBtn  = overlay.querySelector('#yt-modal-save');
  const skipBtn  = overlay.querySelector('#yt-modal-skip');
  const ocrBtn   = overlay.querySelector('#yt-modal-ocr');
  const recordBtn = overlay.querySelector('#yt-modal-record');
  const audioContainer = overlay.querySelector('#yt-modal-audio-container');
  const audioPlayer = overlay.querySelector('#yt-modal-audio-player');
  const audioDelete = overlay.querySelector('#yt-modal-audio-delete');
  const recordIcon = overlay.querySelector('#yt-record-icon');
  const recordText = overlay.querySelector('#yt-record-text');

  let mediaRecorder = null;
  let audioChunks = [];
  let currentAudioBase64 = null;
  const toast    = overlay.querySelector('#yt-modal-toast');
  const progContainer = overlay.querySelector('#yt-ocr-progress-container');

  // Populate
  img.src = frameData;
  timeEl.textContent = `⏱ ${timestamp}`;
  noteEl.value = '';
  toast.classList.add('yt-modal-hidden');
  audioContainer.classList.add('yt-modal-hidden');
  currentAudioBase64 = null;
  if(mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  recordBtn.style.background = '';
  recordBtn.style.color = '#f43f5e';
  recordText.textContent = 'Record Audio';
  recordIcon.textContent = '🎙️';
  progContainer.classList.add('yt-modal-hidden');

  // Show
  overlay.classList.remove('yt-modal-hidden');
  requestAnimationFrame(() => overlay.classList.add('yt-modal-visible'));

  // --- Clone interactive elements to remove old listeners ---
  const freshSave = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(freshSave, saveBtn);

  const freshSkip = skipBtn.cloneNode(true);
  skipBtn.parentNode.replaceChild(freshSkip, skipBtn);

  const freshOcr = ocrBtn.cloneNode(true);
  const freshRecord = recordBtn.cloneNode(true);
  recordBtn.parentNode.replaceChild(freshRecord, recordBtn);
  const freshAudioDelete = audioDelete.cloneNode(true);
  audioDelete.parentNode.replaceChild(freshAudioDelete, audioDelete);
  ocrBtn.parentNode.replaceChild(freshOcr, ocrBtn);

  const freshNote = noteEl.cloneNode(true);
  noteEl.parentNode.replaceChild(freshNote, noteEl);
  freshNote.value = '';
  setTimeout(() => freshNote.focus(), 120);

  // --- Save handler ---
  const doSave = (noteText) => {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      alert("Extension updated! Please refresh the page to save notes.");
      return;
    }
    const { videoId, videoTitle } = getVideoMeta();
    // Read active subject first, then save with one message
    chrome.storage.local.get(['active_subject'], (res) => {
      const subject = res.active_subject || 'General';
      chrome.runtime.sendMessage({
        action: 'SAVE_SCREENSHOT',
        payload: { videoId, videoTitle, frameData, timestamp, noteText, subject }
      }, () => showSavedToast());
    });
  };

  freshSave.addEventListener('click', () => {
    doSave(freshNote.value);
  });

  freshSkip.addEventListener('click', () => {
    doSave('');
  });

  // Ctrl+Enter shortcut
  freshNote.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      doSave(freshNote.value);
    }
  });

  
  // --- Audio Recording button ---
  freshRecord.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // Stop recording
      mediaRecorder.stop();
      freshRecord.style.background = '';
      freshRecord.style.color = '#f43f5e';
      overlay.querySelector('#yt-record-text').textContent = 'Record Audio';
      overlay.querySelector('#yt-record-icon').textContent = '🎙️';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        overlay.querySelector('#yt-modal-audio-player').src = url;
        overlay.querySelector('#yt-modal-audio-container').classList.remove('yt-modal-hidden');
        
        // Convert to Base64 to save locally (since blob URLs are temporary)
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = function() {
          currentAudioBase64 = reader.result;
        };

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      freshRecord.style.background = 'rgba(244, 63, 94, 0.2)';
      overlay.querySelector('#yt-record-text').textContent = 'Recording... (Click to stop)';
      overlay.querySelector('#yt-record-icon').textContent = '🔴';
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Could not access microphone! Please allow microphone permissions on this page.');
    }
  });

  freshAudioDelete.addEventListener('click', () => {
    overlay.querySelector('#yt-modal-audio-container').classList.add('yt-modal-hidden');
    overlay.querySelector('#yt-modal-audio-player').src = '';
    currentAudioBase64 = null;
  });

  // --- OCR Extract Text button ---
  freshOcr.addEventListener('click', async () => {
    const ocrText = overlay.querySelector('#yt-ocr-text');
    const prog = overlay.querySelector('#yt-ocr-progress-container');
    const bar = overlay.querySelector('#yt-ocr-progress-bar');
    const noteField = overlay.querySelector('#yt-modal-note');

    prog.classList.remove('yt-modal-hidden');
    bar.style.width = '0%';
    freshOcr.disabled = true;
    ocrText.textContent = 'Extracting...';

    try {
      // Route OCR to background worker — bypasses YouTube's strict CSP
      const m = await import('./ocrEngine.js');
        let textValue = '';
        try { textValue = await m.extractText(frameData); } catch(e) { console.error(e); }
        const result = { success: !!textValue, text: textValue };

      if (result && result.success && result.text && result.text.length > 0) {
        const existing = noteField.value.trim();
        noteField.value = existing
          ? `${existing}\n\n--- OCR Extracted ---\n${result.text}`
          : result.text;
        noteField.scrollTop = noteField.scrollHeight;
      } else {
        noteField.placeholder = result?.error || 'No text detected in this frame.';
      }
    } catch (err) {
      console.error('[OCR] Extraction failed:', err);
      noteField.placeholder = 'OCR failed — type your note manually.';
    } finally {
      prog.classList.add('yt-modal-hidden');
      freshOcr.disabled = false;
      ocrText.textContent = 'Extract Text';
    }
  });
}

/**
 * Extracts the video ID and title from the current YouTube page.
 */
function getVideoMeta() {
  let videoId = 'unknown';
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('v')) videoId = urlParams.get('v');

  let videoTitle = document.title.replace(' - YouTube', '').trim();
  const selectors = [
    'h1.ytd-watch-metadata yt-formatted-string',
    'h1.ytd-video-primary-info-renderer',
    '#title h1',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) {
      videoTitle = el.textContent.trim();
      break;
    }
  }

  return { videoId, videoTitle };
}

function showSavedToast() {
  const overlay = document.getElementById('yt-screenshot-modal');
  if (!overlay) return;
  const toast = overlay.querySelector('#yt-modal-toast');
  if (toast) toast.classList.remove('yt-modal-hidden');
  setTimeout(() => closeAndResume(), 800);
}

function closeAndResume() {
  const overlay = document.getElementById('yt-screenshot-modal');
  if (!overlay) return;

  overlay.classList.remove('yt-modal-visible');
  setTimeout(() => {
    overlay.classList.add('yt-modal-hidden');
  }, 250);

  if (_wasPlaying) {
    const video = getVideoElement();
    if (video) video.play();
    _wasPlaying = false;
  }
}
