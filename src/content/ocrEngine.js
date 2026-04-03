/**
 * ocrEngine.js
 * Wraps Tesseract.js behind an invisible sandbox iframe.
 * Bypass for strict CSP environments like YouTube.
 */

let _iframe = null;
let _initPromise = null;
let _messageIdCounter = 0;
const _pendingResolvers = {};

/**
 * Injects the hidden sandbox iframe into the page.
 */
async function getIframe() {
  if (_iframe) return _iframe;
  if (_initPromise) return _initPromise;

  _initPromise = new Promise((resolve) => {
    console.log('[OCR] Injecting Sandbox iframe...');
    const iframe = document.createElement('iframe');
    iframe.id = 'yt-ocr-sandbox';
    iframe.src = chrome.runtime.getURL('src/content/ocrFrame.html');
    iframe.style.display = 'none';

    iframe.onload = () => {
      console.log('[OCR] Sandbox ready.');
      _iframe = iframe;
      resolve(iframe);
    };

    document.body.appendChild(iframe);
  });

  // Listen for messages from the iframe
  window.addEventListener('message', (event) => {
    // Only trust our own extension origin
    if (!event.origin.startsWith('chrome-extension://')) return;

    const data = event.data;
    if (!data) return;

    if (data.type === 'OCR_PROGRESS') {
      const pEvent = new CustomEvent('ocr-progress', { detail: data.progress });
      document.dispatchEvent(pEvent);
    } else if (data.type === 'OCR_RESULT') {
      const resolver = _pendingResolvers[data.messageId];
      if (resolver) {
        if (data.success) {
          resolver.resolve(data.text);
        } else {
          resolver.reject(new Error(data.error));
        }
        delete _pendingResolvers[data.messageId];
      }
    }
  });

  return _initPromise;
}

/**
 * Extracts text from a base64 image data URL.
 * @param {string} imageDataUrl - base64 encoded image
 * @returns {Promise<string>} cleaned extracted text
 */
export async function extractText(imageDataUrl) {
  const iframe = await getIframe();
  const messageId = ++_messageIdCounter;

  return new Promise((resolve, reject) => {
    _pendingResolvers[messageId] = { resolve, reject };

    iframe.contentWindow.postMessage({
      type: 'EXTRACT_TEXT',
      messageId,
      imageDataUrl
    }, chrome.runtime.getURL(''));
  });
}

export async function terminateOCR() {
  if (_iframe) {
    _iframe.remove();
    _iframe = null;
    _initPromise = null;
    console.log('[OCR] Sandbox iframe removed.');
  }
}

