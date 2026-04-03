/**
 * ocrEngine.js
 * Wraps Tesseract.js for browser-compatible OCR text extraction.
 *
 * Design decisions:
 *  - We create ONE persistent worker and reuse it (loading the model is expensive)
 *  - We only load the worker on first use (lazy init)
 *  - We provide a progress callback for the UI spinner
 *  - We clean up extracted text (remove junk characters, collapse whitespace)
 */
import { createWorker } from 'tesseract.js';

let _worker = null;
let _isInitializing = false;
let _initPromise = null;

/**
 * Lazy-initializes the Tesseract worker. Reuses it across calls.
 */
async function getWorker() {
  if (_worker) return _worker;

  // Prevent race conditions if called multiple times before init finishes
  if (_isInitializing) return _initPromise;

  _isInitializing = true;
  _initPromise = (async () => {
    console.log('[OCR] Initializing Tesseract worker...');
    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          // Emit progress event for the UI
          const event = new CustomEvent('ocr-progress', { detail: m.progress });
          document.dispatchEvent(event);
        }
      }
    });
    _worker = worker;
    _isInitializing = false;
    console.log('[OCR] Worker ready');
    return worker;
  })();

  return _initPromise;
}

/**
 * Extracts text from a base64 image data URL.
 * @param {string} imageDataUrl - base64 encoded image
 * @returns {Promise<string>} cleaned extracted text
 */
export async function extractText(imageDataUrl) {
  const worker = await getWorker();

  const { data } = await worker.recognize(imageDataUrl);
  const rawText = data.text || '';

  return cleanText(rawText);
}

/**
 * Cleans OCR output: removes junk, collapses whitespace, trims.
 */
function cleanText(raw) {
  return raw
    // Remove non-printable characters except newlines
    .replace(/[^\x20-\x7E\n\r\t]/g, '')
    // Collapse multiple spaces into one
    .replace(/[ \t]+/g, ' ')
    // Collapse 3+ newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}

/**
 * Terminates the worker to free memory. Call when the extension is done.
 */
export async function terminateOCR() {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
    console.log('[OCR] Worker terminated');
  }
}
