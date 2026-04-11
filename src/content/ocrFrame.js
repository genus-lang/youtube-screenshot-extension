import { createWorker } from 'tesseract.js';

let _worker = null;
let _isInitializing = false;
let _initPromise = null;

async function getWorker() {
  if (_worker) return _worker;
  if (_isInitializing) return _initPromise;

  _isInitializing = true;
  _initPromise = (async () => {
    console.log('[OCR Frame] Initializing internal Tesseract worker...');
    // We are on extension origin, so Blob and native Worker paths work flawlessly!
    const worker = await createWorker('eng', 1, { workerBlobURL: false,
      workerPath: chrome.runtime.getURL('public/tesseract/worker.min.js'), corePath: chrome.runtime.getURL('public/tesseract/tesseract-core.wasm.js'),
      logger: (m) => {
        if (m.status === 'recognizing text') {
          // Send progress back to parent window
          window.parent.postMessage({ type: 'OCR_PROGRESS', progress: m.progress }, '*');
        }
      }
    });
    _worker = worker;
    _isInitializing = false;
    console.log('[OCR Frame] Worker ready');
    return worker;
  })();

  return _initPromise;
}

window.addEventListener('message', async (event) => {
  // We only accept messages from our own extension/tab
  if (!event.data || event.data.type !== 'EXTRACT_TEXT') return;

  try {
    const { imageDataUrl, messageId } = event.data;
    const worker = await getWorker();

    const { data } = await worker.recognize(imageDataUrl);
    const rawText = data.text || '';

    window.parent.postMessage({
      type: 'OCR_RESULT',
      messageId,
      text: cleanText(rawText),
      success: true
    }, '*');
  } catch (error) {
    window.parent.postMessage({
      type: 'OCR_RESULT',
      messageId: event.data.messageId,
      error: error.message,
      success: false
    }, '*');
  }
});

function cleanText(raw) {
  return raw
    .replace(/[^\x20-\x7E\n\r\t]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}
