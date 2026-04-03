import { getAllData, getTotalScreenshotCount } from '../storage/storage.js';
import { generateAISummary } from './pdfExport.js';

export async function exportToOneNote() {
  const token = await new Promise(resolve => {
    chrome.storage.local.get(['microsoft_token'], (res) => resolve(res.microsoft_token));
  });

  if (!token) {
    throw new Error('Not connected to Microsoft. Please go to Settings > Integrations and click "Connect to Microsoft".');
  }

  const allData = await getAllData();
  const videoIds = Object.keys(allData);

  if (videoIds.length === 0 || getTotalScreenshotCount(allData) === 0) {
    throw new Error('No screenshots found. Capture some frames first!');
  }

  const formData = new FormData();
  let fullHtmlSource = `<!DOCTYPE html><html><head><title>YouTube Study Notes</title></head><body>`;
  const imagePromises = [];
  let imageCounter = 0;

  for (const videoId of videoIds) {
    const videoObj = allData[videoId];
    if (!videoObj.screenshots || videoObj.screenshots.length === 0) continue;

    const safeTitle = (videoObj.title || 'Unknown Video').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    fullHtmlSource += `<h1 style="font-size: 24px; color: #2563eb; margin-top: 20px;">🎬 ${safeTitle}</h1>`;
    
    const prefs = await new Promise(res => chrome.storage.local.get(['openai_api_key'], res));
    if (prefs.openai_api_key) {
      try {
        const rawNotes = videoObj.screenshots.map(s => s.note).filter(Boolean).join('\n');
        if (rawNotes) {
          const aiSummary = await generateAISummary(rawNotes, videoObj.title);
          if (aiSummary) {
            fullHtmlSource += `<div style="background-color: #f3f4f6; padding: 15px; margin-bottom: 20px;">`;
            fullHtmlSource += `<h2>✨ AI Executive Summary</h2>`;
            fullHtmlSource += `<p>${aiSummary.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
            fullHtmlSource += `</div>`;
          }
        }
      } catch (e) {
        console.warn('AI Summary skipped:', e);
      }
    }

    fullHtmlSource += `<hr/>`;

    for (const snap of videoObj.screenshots) {
      const snapNote = snap.note ? snap.note.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'No note.';
      const imgId = `imagePart${imageCounter++}`;
      
      fullHtmlSource += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #64748b;">⏱ Timestamp: ${snap.time}</h3>
          <p>${snapNote}</p>
          <img src="name:${imgId}" alt="Video Frame at ${snap.time}" />
        </div>
      `;

      // Convert Base64 dataURL to Blob securely using fetch trick
      // This forces the request to send as a true multipart binary instead of string
      imagePromises.push(
        fetch(snap.image)
          .then(r => r.blob())
          .then(blob => {
            formData.append(imgId, blob, `frame_${imgId}.jpg`);
          })
      );
    }
  }

  fullHtmlSource += `</body></html>`;
  
  // Package HTML as the primary Presentation part
  const htmlBlob = new Blob([fullHtmlSource], { type: 'application/xhtml+xml' });
  formData.append('Presentation', htmlBlob, 'Presentation');

  // Wait for all Base64 images to be converted strictly to binary blobs
  await Promise.all(imagePromises);

  const response = await fetch('https://graph.microsoft.com/v1.0/me/onenote/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Do NOT explicitly set Content-Type. fetch + FormData auto-injects multipart with correct boundaries!
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 401) {
      chrome.storage.local.remove(['microsoft_token']);
      throw new Error('Microsoft session expired. Please reconnect in Settings.');
    }
    throw new Error(`Graph API Error: ${errorData?.error?.message || response.statusText}`);
  }

  return response.json();
}
