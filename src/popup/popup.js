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
    const activeSubject = await new Promise(res =>
      chrome.storage.local.get(['active_subject'], d => res(d.active_subject || 'General'))
    );

    // Filter out non-video keys and only include screenshots for the active subject
    let videoEntries = Object.entries(data).filter(([key, val]) => {
      return val && typeof val === 'object' && Array.isArray(val.screenshots);
    });

    // Map to keep the original structure but filter screenshots by subject
    videoEntries = videoEntries.map(([key, val]) => {
      const filteredScreenshots = val.screenshots.filter(s => (s.subject || 'General') === activeSubject);
      return [key, { ...val, screenshots: filteredScreenshots }];
    }).filter(([, val]) => val.screenshots.length > 0);

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
    // PDF Dropdown toggle
  const pdfMenu = document.getElementById('pdf-dropdown-menu');
  let isPdfMenuOpen = false;

  btnGeneratePDF.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!btnGeneratePDF.disabled) {
       pdfMenu.classList.toggle('hidden');
       isPdfMenuOpen = !isPdfMenuOpen;
    }
  });

  document.addEventListener('click', (e) => {
    if (isPdfMenuOpen && !btnGeneratePDF.contains(e.target) && !pdfMenu.contains(e.target)) {
      pdfMenu.classList.add('hidden');
      isPdfMenuOpen = false;
    }
  });

  const handlePDFGenerate = async (mode) => {
    pdfMenu.classList.add('hidden');
    isPdfMenuOpen = false;
    btnGeneratePDF.disabled = true;
    btnGeneratePDF.innerHTML = '<span class="spinner"></span> Generating...';
    showToast('info', '⏳ Generating your PDF...');

    try {
      const data = await getAllData();
      const activeSubject = await new Promise(res =>
        chrome.storage.local.get(['active_subject'], d => res(d.active_subject || 'General'))
      );

      // Filter to only video data and only screenshots for the active subject
      const videoData = {};
      Object.entries(data).forEach(([key, val]) => {
        if (val && typeof val === 'object' && Array.isArray(val.screenshots)) {
          const filteredScreenshots = val.screenshots.filter(s => (s.subject || 'General') === activeSubject);
          if (filteredScreenshots.length > 0) {
            videoData[key] = { ...val, screenshots: filteredScreenshots };
          }
        }
      });

      await generateFullPDF(videoData, { mode, subject: activeSubject });
      showToast('success', '✅ PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF generation failed:', err);
      showToast('error', `❌ Failed: ${err.message}`);
    } finally {
      btnGeneratePDF.disabled = false;
      btnGeneratePDF.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><span>Generate PDF</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:auto"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    }
  };

  const btnPdfFull = document.getElementById('btn-pdf-full');
  const btnPdfImages = document.getElementById('btn-pdf-images');

  if(btnPdfFull && btnPdfImages) {
    btnPdfFull.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePDFGenerate('full');
    });
    btnPdfImages.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePDFGenerate('images');
    });
  }

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

  subjectSelector.addEventListener('change', async () => {
    await setActiveSubject(subjectSelector.value);
    await loadStats();
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


// --- Feedback System ---
const feedbackBtnBtn = document.getElementById('btn-feedback-floating');
const feedbackModal = document.getElementById('feedback-modal');
const btnCancelFeedback = document.getElementById('btn-cancel-feedback');
const btnSendFeedback = document.getElementById('btn-send-feedback');

if (feedbackBtnBtn && feedbackModal) {
  feedbackBtnBtn.addEventListener('click', () => {
    feedbackModal.classList.remove('hidden');
  });

  btnCancelFeedback.addEventListener('click', () => {
    feedbackModal.classList.add('hidden');
  });

  btnSendFeedback.addEventListener('click', () => {
    const email = document.getElementById('feedback-email').value;
    const message = document.getElementById('feedback-message').value;

    if (!message.trim()) {
      alert('Please enter a message.');
      return;
    }

    // 1. Save to DB (chrome.storage.local)
    chrome.storage.local.get(['feedbacks'], (res) => {
      const allFeedbacks = res.feedbacks || [];
      allFeedbacks.push({ email, message, date: new Date().toISOString() });
      chrome.storage.local.set({ feedbacks: allFeedbacks }, () => {
        
        // 2. Mail System
        // Change the below email to your actual Developer Mail ID
        const DEV_EMAIL = "info.lazyar@gmail.com";
        const subject = encodeURIComponent("Extension Feedback");
        const body = encodeURIComponent(`From: ${email || 'Anonymous'}\n\nMessage:\n${message}`);
        
        // Opens default mail client (Gmail, Outlook, etc)
        // Open Gmail Composition directly via web intent instead of mailto: OS default
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${DEV_EMAIL}&su=${subject}&body=${body}`;
        window.open(gmailUrl, '_blank');
        
        // Close modal and reset
        document.getElementById('feedback-message').value = '';
        feedbackModal.classList.add('hidden');
        alert("Feedback saved locally and mail client opened!");
      });
    });
  });
}
