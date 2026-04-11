const fs = require('fs');
const path = require('path');

const POPUP_HTML = path.join(__dirname, 'src/popup/popup.html');
const POPUP_CSS  = path.join(__dirname, 'src/popup/popup.css');
const POPUP_JS   = path.join(__dirname, 'src/popup/popup.js');

// 1. Add Feedback Modal to HTML
let html = fs.readFileSync(POPUP_HTML, 'utf8');

// Replace the old floating github link with a button that opens our modal
html = html.replace(
  /<a href="[^"]+" target="_blank" id="btn-feedback-floating" class="feedback-btn" [^>]+>([\s\S]*?)<\/a>/g,
  `<button id="btn-feedback-floating" class="feedback-btn" title="Give Feedback">
    $1
  </button>`
);

// Add the feedback modal HTML if it doesn't exist
if (!html.includes('id="feedback-modal"')) {
  const modalHTML = `
  <!-- Feedback Modal -->
  <div id="feedback-modal" class="modal-overlay hidden">
    <div class="modal-content">
      <h2>Send Feedback</h2>
      <p>Your suggestions will be saved locally & emailed to the developer.</p>
      
      <div class="input-group">
        <label>Your Email (optional)</label>
        <input type="email" id="feedback-email" placeholder="you@example.com" />
      </div>

      <div class="input-group">
        <label>Message</label>
        <textarea id="feedback-message" rows="4" placeholder="I found a bug / I have a suggestion..."></textarea>
      </div>

      <div class="modal-actions">
        <button id="btn-cancel-feedback" class="btn-ghost">Cancel</button>
        <button id="btn-send-feedback" class="btn-primary">Save & Send</button>
      </div>
    </div>
  </div>
  `;
  html = html.replace('</body>', `${modalHTML}\n</body>`);
  fs.writeFileSync(POPUP_HTML, html, 'utf8');
}

// 2. Add styles for Feedback Modal
let css = fs.readFileSync(POPUP_CSS, 'utf8');
if (!css.includes('.modal-overlay')) {
  css += `
/* Feedback Modal Styles */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.modal-overlay.hidden { display: none; }
.modal-content {
  background: white; padding: 20px; border-radius: 12px; width: 90%; max-width: 320px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 12px;
}
.dark-theme .modal-content {
  background: var(--surface); color: var(--text);
}
.modal-content h2 { margin: 0; font-size: 16px; }
.modal-content p { margin: 0; font-size: 12px; opacity: 0.8; }
.input-group { display: flex; flex-direction: column; gap: 4px; }
.input-group label { font-size: 12px; font-weight: 500; }
.input-group input, .input-group textarea {
  width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg); color: var(--text); font-family: inherit; font-size: 13px;
}
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.btn-ghost { background: transparent; border: none; color: var(--text); padding: 8px 12px; cursor: pointer; border-radius: 6px; }
.btn-ghost:hover { background: rgba(0,0,0,0.05); }
.dark-theme .btn-ghost:hover { background: rgba(255,255,255,0.05); }
`;
  fs.writeFileSync(POPUP_CSS, css, 'utf8');
}

// 3. Add JS logic for the Feedback Modal
let js = fs.readFileSync(POPUP_JS, 'utf8');
if (!js.includes('btn-feedback-floating')) {
  js += `

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
        const DEV_EMAIL = "your_email@domain.com";
        const subject = encodeURIComponent("Extension Feedback");
        const body = encodeURIComponent(\`From: \${email || 'Anonymous'}\\n\\nMessage:\\n\${message}\`);
        
        // Opens default mail client (Gmail, Outlook, etc)
        window.open(\`mailto:\${DEV_EMAIL}?subject=\${subject}&body=\${body}\`);
        
        // Close modal and reset
        document.getElementById('feedback-message').value = '';
        feedbackModal.classList.add('hidden');
        alert("Feedback saved locally and mail client opened!");
      });
    });
  });
}
`;
  fs.writeFileSync(POPUP_JS, js, 'utf8');
}

console.log('Feedback system applied to HTML, CSS, and JS.');
