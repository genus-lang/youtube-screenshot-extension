/**
 * storage.js
 * Clean separation of data logic (IndexedDB / Chrome Storage)
 */
export function saveScreenshot(videoId, videoTitle, dataUrl, timestamp, note) {
  chrome.storage.local.get([videoId], (result) => {
    const videoData = result[videoId] || { title: videoTitle, screenshots: [] };
    videoData.screenshots.push({ image: dataUrl, time: timestamp, note: note || '' });
    
    const update = {};
    update[videoId] = videoData;
    chrome.storage.local.set(update, () => {
      console.log(`Saved screenshot + note for video ${videoId} at ${timestamp}s`);
    });
  });
}

export function getStorageData(key, callback) {
  chrome.storage.local.get([key], callback);
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

/**
 * Get all stored data (every video and its screenshots).
 * Returns a Promise.
 */
export function getAllData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (data) => {
      resolve(data || {});
    });
  });
}

/**
 * Count total screenshots across all videos.
 */
export function getTotalScreenshotCount(data) {
  let count = 0;
  Object.values(data).forEach(video => {
    if (video.screenshots) {
      count += video.screenshots.length;
    }
  });
  return count;
}

/**
 * Clear all stored screenshot data.
 */
export function clearAllData() {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      console.log('All screenshot data cleared.');
      resolve();
    });
  });
}
