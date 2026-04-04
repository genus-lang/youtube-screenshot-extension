/**
 * popup.js
 * Dashboard logic for the extension popup:
 *   - Loads live stats from chrome.storage
 *   - Shows recent videos with screenshot counts
 *   - Manual "Generate PDF" button
 *   - Clear All Data with confirmation dialog
 *   - Opens settings page
 */
import { getAllData, getTotalScreenshotCount, getAllNotes, clearAllData, getAllSubjects, setActiveSubject } from '../storage/storage.js';
import { generateFullPDF } from '../export/pdfExport.js';
import { exportToOneNote } from '../export/onenoteExport.js';
import './popup.css';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM refs
  const statVideos      = document.getElementById('stat-videos');
  const statScreenshots  = document.getElementById('stat-screenshots');
  const statNotes       = document.getElementById('stat-notes');
  const recentList      = document.getElementById('recent-list');
  const btnGeneratePDF  = document.getElementById('btn-generate-pdf');
  const btnExportOneNote= document.getElementById('btn-export-onenote');
  const btnOpenOneNote  = document.getElementById('btn-open-onenote');
  const btnClearData    = document.getElementById('btn-clear-data');
  const btnSettings     = document.getElementById('btn-settings');
  const confirmOverlay  = document.getElementById('confirm-overlay');
  const confirmCancel   = document.getElementById('confirm-cancel');
  const confirmDelete   = document.getElementById('confirm-delete');
  const subjectSelector = document.getElementById('subject-selector');
  const btnManageSubj   = document.getElementById('btn-manage-subjects');

  // =====================
  // Load & render stats + subjects
  // =====================
  await loadStats();
  await loadSubjects();

  async function loadStats() {
    const data = await getAllData();

    // Filter out non-video keys (settings keys like openai_api_key, pref_*, etc.)
    const videoEntries = Object.entries(data).filter(([key, val]) => {
      return val && typeof val === 'object' && Array.isArray(val.screenshots);
    });

    const videoCount = videoEntries.length;
    const screenshotCount = videoEntries.reduce((sum, [, v]) => sum + v.screenshots.length, 0);
    const noteCount = videoEntries.reduce((sum, [, v]) => {
      return sum + v.screenshots.filter(s => s.note && s.note.trim()).length;
    }, 0);

    // Animate stat numbers
    animateNumber(statVideos, videoCount);
    animateNumber(statScreenshots, screenshotCount);
    animateNumber(statNotes, noteCount);

    // Render recent videos list
    renderRecentVideos(videoEntries);

    // Disable buttons if no data
    btnGeneratePDF.disabled = screenshotCount === 0;
    btnClearData.disabled = screenshotCount === 0;
  }

  function animateNumber(el, target) {
    const duration = 400;
    const start = parseInt(el.textContent) || 0;
    if (start === target) { el.textContent = target; return; }

    const startTime = performance.now();
    function update(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  function renderRecentVideos(videoEntries) {
    if (videoEntries.length === 0) {
      recentList.innerHTML = '<p class="empty-state">No screenshots yet. Open a YouTube video and click 📸!</p>';
      return;
    }

    // Sort by most screenshots (most active first), take top 5
    const sorted = videoEntries
      .sort((a, b) => b[1].screenshots.length - a[1].screenshots.length)
      .slice(0, 5);

    recentList.innerHTML = sorted.map(([videoId, video]) => {
      const title = video.title || videoId;
      const count = video.screenshots.length;
      return `
        <div class="recent-item" title="${escapeHtml(title)}">
          <span class="recent-title">${escapeHtml(title)}</span>
          <span class="recent-badge">📷 ${count}</span>
        </div>
      `;
    }).join('');
  }

  // =====================
  // Generate PDF
  // =====================
  btnGeneratePDF.addEventListener('click', async () => {
    btnGeneratePDF.disabled = true;
    btnGeneratePDF.innerHTML = '<span class="spinner"></span> Generating...';
    showToast('info', '📄 Generating your PDF...');

    try {
      const data = await getAllData();
      // Filter to only video data
      const videoData = {};
      Object.entries(data).forEach(([key, val]) => {
        if (val && typeof val === 'object' && Array.isArray(val.screenshots)) {
          videoData[key] = val;
        }
      });

      await generateFullPDF(videoData);
      showToast('success', '✅ PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF generation failed:', err);
      showToast('error', `❌ Failed: ${err.message}`);
    } finally {
      btnGeneratePDF.disabled = false;
      btnGeneratePDF.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span>Generate PDF</span>`;
    }
  });

  // =====================
  // Export OneNote
  // =====================
  btnExportOneNote.addEventListener('click', async () => {
    btnExportOneNote.disabled = true;
    const oldHtml = btnExportOneNote.innerHTML;
    btnExportOneNote.innerHTML = '<span class="spinner"></span> Syncing...';
    if(btnOpenOneNote) btnOpenOneNote.classList.add('hidden');
    showToast('info', '☁️ Uploading to Microsoft OneNote...');

    try {
      const resp = await exportToOneNote();
      showToast('success', '✅ Successfully pushed to OneNote!');
      
      // Auto-open the exact note in a new tab so the user never has to search for it!
      if (resp && resp.links && resp.links.oneNoteWebUrl) {
        if(btnOpenOneNote) { btnOpenOneNote.classList.remove('hidden'); btnOpenOneNote.onclick = () => chrome.tabs.create({ url: resp.links.oneNoteWebUrl.href }); }
      }
    } catch (err) {
      console.error('OneNote export failed:', err);
      // Let the user know if it's an auth error vs a network error
      showToast('error', `❌ ${err.message}`);
      if (err.message.includes('Not connected')) {
        setTimeout(() => chrome.runtime.openOptionsPage(), 2000);
      }
    } finally {
      btnExportOneNote.disabled = false;
      btnExportOneNote.innerHTML = oldHtml;
    }
  });

  // =====================
  // Clear Data (with confirmation)
  // =====================
  btnClearData.addEventListener('click', () => {
    confirmOverlay.classList.remove('hidden');
  });

  confirmCancel.addEventListener('click', () => {
    confirmOverlay.classList.add('hidden');
  });

  confirmDelete.addEventListener('click', async () => {
    confirmOverlay.classList.add('hidden');

    // We need to preserve settings keys before clearing
    const data = await getAllData();
    const settingsToPreserve = {};
    const settingsKeys = ['openai_api_key', 'openai_model', 'pref_autopause', 'pref_quality'];
    settingsKeys.forEach(key => {
      if (data[key] !== undefined) settingsToPreserve[key] = data[key];
    });

    await clearAllData();

    // Restore settings
    if (Object.keys(settingsToPreserve).length > 0) {
      await new Promise(resolve => chrome.storage.local.set(settingsToPreserve, resolve));
    }

    showToast('success', '🗑️ All screenshot data cleared!');
    await loadStats();
  });

  // =====================
  // Auto Mode Toggle (Coming Soon)
  // =====================
  const btnToggleAuto  = document.getElementById('btn-toggle-auto');
  const autoBtnText    = document.getElementById('auto-btn-text');

  btnToggleAuto.addEventListener('click', () => {
    alert('🚀 Smart Auto Mode is coming soon! Stay tuned.');
  });

  // =====================
  // Subject Selector
  // =====================
  async function loadSubjects() {
    const subjects = await getAllSubjects();
    const active = await new Promise(res =>
      chrome.storage.local.get(['active_subject'], d => res(d.active_subject || 'General'))
    );

    // Clear and rebuild options (General always first)
    subjectSelector.innerHTML = '<option value="General">General</option>';
    subjects.forEach(name => {
      if (name === 'General') return;
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      subjectSelector.appendChild(opt);
    });
    subjectSelector.value = active;
  }

  subjectSelector.addEventListener('change', () => {
    setActiveSubject(subjectSelector.value);
  });

  btnManageSubj.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // =====================
  // Settings button
  // =====================
  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // =====================
  // Background message listener
  // =====================
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'GENERATE_PDF') {
      generateFullPDF(msg.payload);
    }
  });
});

// =====================
// Helpers
// =====================
function showToast(type, message) {
  const toast = document.getElementById('popup-toast');
  toast.className = `popup-toast ${type}`;
  toast.textContent = message;

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Finds the active YouTube tab and calls the callback with it.
 * Calls callback(null) if no YouTube tab is found.
 */
function getActiveYouTubeTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const ytTab = tabs.find(t => t.url && t.url.includes('youtube.com/watch'));
    callback(ytTab || null);
  });
}
