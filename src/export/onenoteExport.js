import { getAllData, getTotalScreenshotCount } from '../storage/storage.js';
import { generateAISummary } from './pdfExport.js';

/**
 * Pushes the captured notes to Microsoft OneNote via Graph API.
 */
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

  let fullHtmlSource = `<!DOCTYPE html><html><head><title>YouTube Study Notes</title></head><body>`;

  // Process each video
  for (const videoId of videoIds) {
    const videoObj = allData[videoId];
    if (!videoObj.screenshots || videoObj.screenshots.length === 0) continue;

    const safeTitle = (videoObj.title || 'Unknown Video').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    fullHtmlSource += `<h1 style="font-size: 24px; color: #2563eb; margin-top: 20px;">🎬 ${safeTitle}</h1>`;
    
    // Attempt AI Generation if they have a Groq key
    const prefs = await new Promise(res => chrome.storage.local.get(['openai_api_key'], res));
    if (prefs.openai_api_key) {
      try {
        const rawNotes = videoObj.screenshots.map(s => s.note).filter(Boolean).join('\n');
        if (rawNotes) {
          const aiSummary = await generateAISummary(rawNotes, videoObj.title);
          if (aiSummary) {
            fullHtmlSource += `<div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px;">`;
            fullHtmlSource += `<h2 style="font-size: 18px; margin-top: 0;">✨ AI Executive Summary</h2>`;
            fullHtmlSource += `<p style="font-family: Arial, sans-serif; white-space: pre-wrap;">${aiSummary}</p>`;
            fullHtmlSource += `</div>`;
          }
        }
      } catch (e) {
        console.warn('AI Summary skipped for OneNote export:', e);
      }
    }

    fullHtmlSource += `<hr/>`;

    // Process screenshots
    for (const snap of videoObj.screenshots) {
      const snapNote = snap.note ? snap.note.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'No note.';
      
      fullHtmlSource += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #64748b;">⏱ Timestamp: ${snap.time}</h3>
          <p style="font-size: 14px; white-space: pre-wrap; font-weight: bold;">${snapNote}</p>
          <img src="${snap.image}" alt="Video Frame at ${snap.time}" style="max-width: 800px; border: 1px solid #ccc; border-radius: 4px;" />
        </div>
      `;
    }
  }

  fullHtmlSource += `</body></html>`;

  // POST to Microsoft Graph API
  const response = await fetch('https://graph.microsoft.com/v1.0/me/onenote/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/xhtml+xml'
    },
    body: fullHtmlSource
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 401) {
      // Token expired, clear it
      chrome.storage.local.remove(['microsoft_token']);
      throw new Error('Microsoft session expired. Please reconnect in Settings.');
    }
    throw new Error(`Graph API Error: ${errorData?.error?.message || response.statusText}`);
  }

  return response.json();
}
