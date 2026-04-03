/**
 * options.js
 * Handles all logic for the extension settings page:
 *   - Saving / loading the OpenAI API key
 *   - Testing the API connection
 *   - Toggling key visibility
 *   - Sidebar navigation
 *   - Saving user preferences
 */
import './options.css';

// =====================
// DOM References
// =====================
document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput    = document.getElementById('api-key-input');
  const modelSelect    = document.getElementById('model-select');
  const toggleVisBtn   = document.getElementById('toggle-visibility');
  const eyeIcon        = document.getElementById('eye-icon');
  const saveApiBtn     = document.getElementById('save-api-btn');
  const testApiBtn     = document.getElementById('test-api-btn');
  const apiStatus      = document.getElementById('api-status');

  const prefAutopause  = document.getElementById('pref-autopause');
  const prefQuality    = document.getElementById('pref-quality');
  const savePrefsBtn   = document.getElementById('save-prefs-btn');
  const prefsStatus    = document.getElementById('prefs-status');

  const navLinks       = document.querySelectorAll('.nav-link');

  // =====================
  // Sidebar navigation
  // =====================
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = link.dataset.section;

      // Toggle active nav
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Toggle active section
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${sectionId}`).classList.add('active');
    });
  });

  // =====================
  // Load saved settings
  // =====================
  chrome.storage.local.get(['openai_api_key', 'openai_model', 'pref_autopause', 'pref_quality'], (data) => {
    if (data.openai_api_key) {
      apiKeyInput.value = data.openai_api_key;
    }
    if (data.openai_model) {
      modelSelect.value = data.openai_model;
    }
    if (typeof data.pref_autopause === 'boolean') {
      prefAutopause.checked = data.pref_autopause;
    }
    if (data.pref_quality) {
      prefQuality.value = data.pref_quality;
    }
  });

  // =====================
  // Toggle key visibility
  // =====================
  toggleVisBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    eyeIcon.textContent = isPassword ? '🙈' : '👁️';
  });

  // =====================
  // Save API settings
  // =====================
  saveApiBtn.addEventListener('click', () => {
    const key   = apiKeyInput.value.trim();
    const model = modelSelect.value;

    if (!key) {
      showStatus(apiStatus, 'error', 'Please enter an API key.');
      return;
    }

    if (!key.startsWith('gsk_')) {
      showStatus(apiStatus, 'error', 'Invalid key format. Groq keys start with "gsk_".');
      return;
    }

    chrome.storage.local.set({ openai_api_key: key, openai_model: model }, () => {
      showStatus(apiStatus, 'success', '✅ Settings saved successfully!');
    });
  });

  // =====================
  // Test API connection
  // =====================
  testApiBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();

    if (!key) {
      showStatus(apiStatus, 'error', 'Enter an API key before testing.');
      return;
    }

    // Show loading state
    testApiBtn.disabled = true;
    testApiBtn.innerHTML = '<span class="spinner"></span> Testing...';
    showStatus(apiStatus, 'info', 'Connecting to Groq...');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelSelect.value,
          messages: [{ role: 'user', content: 'Say "connected" in one word.' }],
          max_tokens: 5
        })
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || 'OK';
        showStatus(apiStatus, 'success', `✅ Connection successful! Model replied: "${reply.trim()}"`);
      } else {
        const err = await response.json().catch(() => ({}));
        const msg = err.error?.message || `HTTP ${response.status}`;
        showStatus(apiStatus, 'error', `❌ API error: ${msg}`);
      }
    } catch (e) {
      showStatus(apiStatus, 'error', `❌ Network error: ${e.message}`);
    } finally {
      testApiBtn.disabled = false;
      testApiBtn.innerHTML = 'Test Connection';
    }
  });

  // =====================
  // Save preferences
  // =====================
  savePrefsBtn.addEventListener('click', () => {
    chrome.storage.local.set({
      pref_autopause: prefAutopause.checked,
      pref_quality: prefQuality.value
    }, () => {
      showStatus(prefsStatus, 'success', '✅ Preferences saved!');
    });
  });
});

// =====================
// Helper: show toast
// =====================
function showStatus(el, type, message) {
  el.className = `status-toast ${type}`;
  el.textContent = message;
  el.classList.remove('hidden');

  // Auto-hide after 5s
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.add('hidden');
  }, 5000);
}
