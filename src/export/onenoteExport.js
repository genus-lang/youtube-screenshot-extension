import { getAllData, getTotalScreenshotCount } from '../storage/storage.js';
import { generateAISummary } from './pdfExport.js';

/**
 * OneNote export structure:
 *   [OneNote Page: Subject "DSA"]
 *     Video 1 Title
 *       Screenshot 1 (image + note)
 *       Screenshot 2 (image + note)
 *     AI Summary of Video 1
 *     ---
 *     Video 2 Title
 *       Screenshot 3 (image + note)
 *     AI Summary of Video 2
 *
 *   [OneNote Page: Subject "DBMS"]
 *     ...
 *
 * Each Subject = one OneNote page.
 * Each video has its title once, then all its screenshots, then its AI summary.
 */
export async function exportToOneNote() {
  const stored = await new Promise(resolve => {
    chrome.storage.local.get(['microsoft_token', 'openai_api_key', 'openai_model'], resolve);
  });

  const token = stored.microsoft_token;
  if (!token) {
    throw new Error('Not connected to Microsoft. Please go to Settings > Integrations and click "Connect to Microsoft".');
  }

  const allData = await getAllData();
  if (getTotalScreenshotCount(allData) === 0) {
    throw new Error('No screenshots found. Capture some frames first!');
  }

  const apiKey = stored.openai_api_key || null;
  const model = stored.openai_model || 'llama-3.3-70b-versatile';

  // ── Build: subjectMap → { subject: { videoId: { title, screenshots[] } } } ──
  const subjectMap = {};
  Object.values(allData).forEach(video => {
    if (!video.screenshots) return;
    video.screenshots.forEach(snap => {
      const subj = snap.subject || 'General';
      if (!subjectMap[subj]) subjectMap[subj] = {};
      const vid = video.videoId || 'unknown';
      if (!subjectMap[subj][vid]) {
        subjectMap[subj][vid] = { title: video.title || 'Unknown Video', screenshots: [] };
      }
      subjectMap[subj][vid].screenshots.push(snap);
    });
  });

  const subjects = Object.keys(subjectMap);
  if (subjects.length === 0) throw new Error('No screenshots found.');

  let lastResponse = null;

  // ── One OneNote PAGE per Subject ──────────────────────────────────────────
  for (const subject of subjects) {
    const videoMap = subjectMap[subject];
    const formData = new FormData();
    const imagePromises = [];
    let imageCounter = 0;

    let html = `<!DOCTYPE html><html><head><title>${esc(subject)}</title></head><body>`;

    // Subject heading
    html += `
      <h1 style="font-size:28px;color:#6d28d9;border-bottom:3px solid #6d28d9;padding-bottom:8px;margin-bottom:20px;">
        ${esc(subject)}
      </h1>
    `;

    // ── Loop each VIDEO within this subject ──────────────────────────────────
    for (const videoId of Object.keys(videoMap)) {
      const { title, screenshots } = videoMap[videoId];

      // Video title (once per video)
      html += `
        <div style="background:#ede9fe;border-left:5px solid #6d28d9;padding:10px 16px;border-radius:4px;margin:24px 0 16px 0;">
          <h2 style="margin:0;font-size:18px;color:#1e1b4b;">${esc(title)}</h2>
        </div>
      `;

      // Screenshots for this video
      for (const snap of screenshots) {
        const snapNote = esc(snap.note || '');
        const imgId = `img${imageCounter++}`;

        html += `
          <div style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <div style="background:#f9f9ff;padding:6px 12px;font-size:12px;color:#6d28d9;font-weight:600;">
              ${esc(snap.time || '0:00')}
            </div>
            <img src="name:${imgId}" alt="Screenshot at ${esc(snap.time || '0:00')}"
              style="display:block;width:100%;max-width:700px;" />
            ${snapNote
              ? `<div style="padding:12px 14px;background:#faf8ff;border-top:1px solid #e5e7eb;">
                   <span style="font-weight:bold;color:#4c1d95;">Note: </span>
                   <span style="color:#1e1b4b;">${snapNote}</span>
                 </div>`
              : ''}
          </div>
        `;

        imagePromises.push(
          fetch(snap.image).then(r => r.blob()).then(blob => {
            formData.append(imgId, blob, `${imgId}.jpg`);
          })
        );

        if (hasAudio) {
           imagePromises.push(
             fetch(snap.audioData).then(r => r.blob()).then(blob => {
               formData.append(audioId, blob, 'AudioNote.webm');
             })
           );
        }
      }

      // AI Summary after all screenshots of this video
      if (apiKey) {
        const notesForVideo = screenshots.map(s => s.note).filter(Boolean);
        if (notesForVideo.length > 0) {
          try {
            const summary = await generateAISummary(notesForVideo, title);
            if (summary) {
              html += `
                <div style="background:#f3f0ff;border:1px solid #c4b5fd;border-radius:8px;padding:16px 18px;margin:8px 0 28px 0;">
                  <div style="font-size:14px;font-weight:bold;color:#6d28d9;margin-bottom:8px;">
                    AI Summary — ${esc(title)}
                  </div>
                  <div style="color:#1e1b4b;font-size:13px;white-space:pre-wrap;line-height:1.7;">${esc(summary)}</div>
                </div>
              `;
            }
          } catch (e) {
            console.warn('[OneNote] AI Summary skipped for:', title, e.message);
          }
        }
      }

      // Divider between videos
      html += `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />`;
    }

    html += `</body></html>`;

    await Promise.all(imagePromises);

    const htmlBlob = new Blob([html], { type: 'application/xhtml+xml' });
    formData.append('Presentation', htmlBlob, 'Presentation');

    const response = await fetch('https://graph.microsoft.com/v1.0/me/onenote/pages', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
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

    lastResponse = await response.json();
  }

  return lastResponse;
}

function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
