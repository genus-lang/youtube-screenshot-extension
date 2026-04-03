/**
 * storage.js
 * High-performance data persistence using IndexedDB to bypass Chrome Storage quotas.
 */

const DB_NAME = 'YT_Screenshot_DB';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

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
    };
  });
}

export async function saveScreenshot(videoId, videoTitle, dataUrl, timestamp, note) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Check if video exists
    const getRequest = store.get(videoId);
    
    getRequest.onsuccess = () => {
      const videoData = getRequest.result || { videoId, title: videoTitle, screenshots: [] };
      videoData.screenshots.push({ image: dataUrl, time: timestamp, note: note || '' });
      
      const putRequest = store.put(videoData);
      putRequest.onsuccess = () => {
        console.log(`[IndexedDB] Saved screenshot + note for video ${videoId} at ${timestamp}s`);
      };
    };
  } catch (error) {
    console.error('[IndexedDB] Failed to save screenshot:', error);
  }
}

/**
 * Returns all stored data as an object keyed by videoId, mimicking old chrome.storage shape.
 */
export async function getAllData() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const result = {};
        request.result.forEach(item => {
          result[item.videoId] = item;
        });
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
      video.screenshots.forEach(s => {
        if (s.note) notes.push(s.note);
      });
    }
  });
  return notes;
}

export function getTotalScreenshotCount(data) {
  let count = 0;
  Object.values(data).forEach(video => {
    if (video.screenshots) {
      count += video.screenshots.length;
    }
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
      
      request.onsuccess = () => {
        console.log('[IndexedDB] All screenshot data cleared.');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[IndexedDB] Failed to clear data:', error);
  }
}

// Preserve backwards compat for any callback-based usages
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

