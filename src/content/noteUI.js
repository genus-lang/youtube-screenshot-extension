/**
 * noteUI.js
 * Injects a premium modal overlay onto YouTube when a screenshot is taken.
 * Shows the captured frame preview, a textarea for the user to type a note,
 * and an "Extract Text" button that uses Tesseract OCR to auto-fill notes.
 */
import { saveScreenshot } from '../storage/storage.js';
import { getVideoElement } from './videoController.js';
import { extractText } from './ocrEngine.js';

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
      </div>

      <!-- Actions -->
      <div class="yt-modal-footer">
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
  document.getElementById('yt-modal-close').addEventListener('click', () => closeAndResume());

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
  const img      = document.getElementById('yt-modal-img');
  const timeEl   = document.getElementById('yt-modal-time');
  const noteEl   = document.getElementById('yt-modal-note');
  const saveBtn  = document.getElementById('yt-modal-save');
  const skipBtn  = document.getElementById('yt-modal-skip');
  const ocrBtn   = document.getElementById('yt-modal-ocr');
  const toast    = document.getElementById('yt-modal-toast');
  const progContainer = document.getElementById('yt-ocr-progress-container');

  // Populate
  img.src = frameData;
  timeEl.textContent = `⏱ ${timestamp}`;
  noteEl.value = '';
  toast.classList.add('yt-modal-hidden');
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
  ocrBtn.parentNode.replaceChild(freshOcr, ocrBtn);

  const freshNote = noteEl.cloneNode(true);
  noteEl.parentNode.replaceChild(freshNote, noteEl);
  freshNote.value = '';
  setTimeout(() => freshNote.focus(), 120);

  // --- Save handler ---
  const doSave = (noteText) => {
    const { videoId, videoTitle } = getVideoMeta();
    saveScreenshot(videoId, videoTitle, frameData, timestamp, noteText);
    showSavedToast();
  };

  freshSave.addEventListener('click', () => {
    doSave(document.getElementById('yt-modal-note').value);
  });

  freshSkip.addEventListener('click', () => {
    doSave('');
  });

  // Ctrl+Enter shortcut
  freshNote.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      doSave(document.getElementById('yt-modal-note').value);
    }
  });

  // --- OCR Extract Text button ---
  freshOcr.addEventListener('click', async () => {
    const ocrText = document.getElementById('yt-ocr-text');
    const prog = document.getElementById('yt-ocr-progress-container');
    const bar = document.getElementById('yt-ocr-progress-bar');
    const noteField = document.getElementById('yt-modal-note');

    // Show progress
    prog.classList.remove('yt-modal-hidden');
    bar.style.width = '0%';
    freshOcr.disabled = true;
    ocrText.textContent = 'Extracting...';

    try {
      const text = await extractText(frameData);

      if (text && text.length > 0) {
        // Append to existing note content (don't overwrite user's typing)
        const existing = noteField.value.trim();
        noteField.value = existing
          ? `${existing}\n\n--- OCR Extracted ---\n${text}`
          : text;
        noteField.scrollTop = noteField.scrollHeight;
      } else {
        noteField.placeholder = 'No text detected in this frame.';
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
  const toast = document.getElementById('yt-modal-toast');
  toast.classList.remove('yt-modal-hidden');
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
