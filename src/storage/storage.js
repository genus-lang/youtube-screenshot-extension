/**
 * storage.js
 * High-performance data persistence using IndexedDB.
 * v2: Adds Subject management system.
 */

const DB_NAME = 'YT_Screenshot_DB';
const DB_VERSION = 2;            // Bumped to 2 to add subjects store
const STORE_NAME = 'videos';
const SUBJECTS_STORE = 'subjects';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'videoId' });
      }
      // New in v2: subjects store (key = subject name)
      if (!db.objectStoreNames.contains(SUBJECTS_STORE)) {
        db.createObjectStore(SUBJECTS_STORE, { keyPath: 'name' });
      }
    };
  });
}

// ─── Screenshots ────────────────────────────────────────────────────────────

export async function saveScreenshot(videoId, videoTitle, dataUrl, timestamp, note, subject) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(videoId);

    getRequest.onsuccess = () => {
      const videoData = getRequest.result || { videoId, title: videoTitle, screenshots: [] };
      videoData.screenshots.push({
        image: dataUrl,
        time: timestamp,
        note: note || '',
        subject: subject || 'General',
        savedAt: Date.now()
      });
      store.put(videoData);
    };
  } catch (error) {
    console.error('[IndexedDB] Failed to save screenshot:', error);
  }
}

export async function getAllData() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const result = {};
        request.result.forEach(item => { result[item.videoId] = item; });
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[IndexedDB] Failed to get all data:', error);
    return {};
  }
}

export function getAllNotes(data) {
  let notes = [];
  Object.values(data).forEach(video => {
    if (video.screenshots) {
      video.screenshots.forEach(s => { if (s.note) notes.push(s.note); });
    }
  });
  return notes;
}

export function getTotalScreenshotCount(data) {
  let count = 0;
  Object.values(data).forEach(video => {
    if (video.screenshots) count += video.screenshots.length;
  });
  return count;
}

export async function clearAllData() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => { console.log('[IndexedDB] All data cleared.'); resolve(); };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[IndexedDB] Failed to clear data:', error);
  }
}

// ─── Subject Management ──────────────────────────────────────────────────────

export async function getAllSubjects() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SUBJECTS_STORE, 'readonly');
      const request = tx.objectStore(SUBJECTS_STORE).getAll();
      request.onsuccess = () => resolve(request.result.map(s => s.name));
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    return [];
  }
}

export async function addSubject(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBJECTS_STORE, 'readwrite');
    const request = tx.objectStore(SUBJECTS_STORE).put({ name: name.trim() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSubject(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBJECTS_STORE, 'readwrite');
    const request = tx.objectStore(SUBJECTS_STORE).delete(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Active subject is stored in chrome.storage.local for cross-context access */
export function getActiveSubject() {
  return new Promise(resolve => {
    chrome.storage.local.get(['active_subject'], res =>
      resolve(res.active_subject || 'General')
    );
  });
}

export function setActiveSubject(name) {
  return new Promise(resolve =>
    chrome.storage.local.set({ active_subject: name }, resolve)
  );
}

// Backwards compat shim
export async function getStorageData(key, callback) {
  const data = await getAllData();
  const obj = {};
  if (key && typeof key !== 'function') {
    obj[key] = data[key];
  } else {
    Object.assign(obj, data);
  }
  if (callback) callback(obj);
}


