import { getAllData, getTotalScreenshotCount } from '../storage/storage.js';

/**
 * Generates a per-screenshot AI summary using Groq.
 * Returns null silently if no API key is set.
 */
async function getPerShotSummary(note, apiKey, model) {
  if (!apiKey || !note || !note.trim()) return null;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a study assistant. In 2-3 bullet points, summarize the key idea from this note taken during a lecture. Be concise and clear.'
          },
          { role: 'user', content: note }
        ],
        max_tokens: 200
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (e) {
    return null;
  }
}

/**
 * Exports screenshots to Microsoft OneNote, grouped by Subject.
 * Each subject gets its own dedicated OneNote page.
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

  // ── Collect all screenshots across all videos, grouped by subject ──────────
  const subjectMap = {}; // { subjectName: [{ snap, videoTitle }] }

  Object.values(allData).forEach(videoObj => {
    if (!videoObj.screenshots) return;
    videoObj.screenshots.forEach(snap => {
      const subj = snap.subject || 'General';
      if (!subjectMap[subj]) subjectMap[subj] = [];
      subjectMap[subj].push({ snap, videoTitle: videoObj.title || 'Unknown Video' });
    });
  });

  const subjects = Object.keys(subjectMap);
  if (subjects.length === 0) throw new Error('No screenshots found.');

  let lastResponse = null;

  // ── Push one OneNote page per subject ──────────────────────────────────────
  for (const subject of subjects) {
    const items = subjectMap[subject];
    const formData = new FormData();
    const imagePromises = [];
    let imageCounter = 0;

    let html = `<!DOCTYPE html><html><head><title>${escHtml(subject)}</title></head><body>`;
    html += `<h1 style="color:#7c3aed;font-size:26px;">📚 ${escHtml(subject)}</h1><hr/>`;

    for (const { snap, videoTitle } of items) {
      const snapNote = escHtml(snap.note || '');
      const imgId = `img${imageCounter++}`;

      html += `<div style="margin-bottom:32px;">`;
      html += `<p style="color:#64748b;font-size:13px;">🎬 ${escHtml(videoTitle)} &nbsp;|&nbsp; ⏱ ${snap.time}</p>`;
      html += `<img src="name:${imgId}" alt="Screenshot at ${snap.time}" style="max-width:700px;" />`;

      if (snapNote) {
        html += `<p style="font-size:14px;white-space:pre-wrap;margin-top:8px;"><strong>📝 Note:</strong> ${snapNote}</p>`;
      }

      // Per-screenshot AI summary
      if (apiKey && snap.note && snap.note.trim()) {
        const summary = await getPerShotSummary(snap.note, apiKey, model);
        if (summary) {
          html += `<div style="background:#f3f0ff;border-left:4px solid #7c3aed;padding:10px 14px;border-radius:4px;margin-top:8px;">`;
          html += `<strong>✨ AI Summary</strong><br/><pre style="font-size:13px;white-space:pre-wrap;margin:6px 0 0 0;">${escHtml(summary)}</pre>`;
          html += `</div>`;
        }
      }

      html += `</div><hr/>`;

      imagePromises.push(
        fetch(snap.image).then(r => r.blob()).then(blob => {
          formData.append(imgId, blob, `${imgId}.jpg`);
        })
      );
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

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
