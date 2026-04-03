import { jsPDF } from 'jspdf';
import { getAllNotes } from '../storage/storage.js';

/**
 * Retrieves the user's saved OpenAI API key and model from chrome.storage.
 * Returns { apiKey, model } or throws if the key is missing.
 */
async function getAPISettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['openai_api_key', 'openai_model'], (data) => {
      if (!data.openai_api_key) {
        reject(new Error('NO_API_KEY'));
        return;
      }
      resolve({
        apiKey: data.openai_api_key,
        model: data.openai_model || 'gpt-4o-mini'
      });
    });
  });
}

/**
 * Generates an AI summary from the user's notes.
 * Pulls the API key dynamically from chrome.storage.
 */
export async function generateAISummary(notes) {
  const { apiKey, model } = await getAPISettings();
  const limitedNotes = notes.slice(0, 50);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'Convert these notes into structured study notes with headings and bullet points.'
        },
        {
          role: 'user',
          content: limitedNotes.join('\n')
        }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || `HTTP ${response.status}`;
    throw new Error(`Groq API Error: ${msg}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Generates a short per-screenshot AI summary from a single note.
 */
export async function generateScreenshotSummary(note, apiKey, model) {
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
            content: 'You are a study assistant. In 2-3 concise bullet points, summarize the key idea from this note. Be brief.'
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
 * Generates a PDF containing:
 *   - Screenshots grouped by Subject
 *   - Each screenshot has: timestamp, image, note, AI summary below it
 */
export async function generateFullPDF(allData) {
  const doc = new jsPDF();

  // Load Groq settings
  const stored = await new Promise(res =>
    chrome.storage.local.get(['openai_api_key', 'openai_model'], res)
  );
  const apiKey = stored.openai_api_key || null;
  const model = stored.openai_model || 'llama-3.3-70b-versatile';

  // ── Group all screenshots by subject ──────────────────────────────────────
  const subjectMap = {};  // { subjectName: [{ snap, videoTitle }] }
  Object.values(allData).forEach(video => {
    if (!video.screenshots) return;
    video.screenshots.forEach(snap => {
      const subj = snap.subject || 'General';
      if (!subjectMap[subj]) subjectMap[subj] = [];
      subjectMap[subj].push({ snap, videoTitle: video.title || 'Unknown Video' });
    });
  });

  const subjects = Object.keys(subjectMap);
  let firstPage = true;

  for (const subject of subjects) {
    const items = subjectMap[subject];

    // Subject cover page
    if (!firstPage) doc.addPage();
    firstPage = false;

    doc.setFontSize(22);
    doc.setTextColor(124, 58, 237); // purple
    doc.text(`📚 ${subject}`, 10, 20);
    doc.setDrawColor(124, 58, 237);
    doc.setLineWidth(0.5);
    doc.line(10, 24, 200, 24);

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`${items.length} screenshot(s)`, 10, 32);

    for (const { snap, videoTitle } of items) {
      doc.addPage();

      // Header: video + timestamp
      doc.setFontSize(9);
      doc.setTextColor(130, 130, 130);
      doc.text(videoTitle, 10, 10);

      doc.setFontSize(12);
      doc.setTextColor(30, 30, 60);
      doc.text(`⏱ ${snap.time || 'N/A'}`, 10, 18);

      // Screenshot image
      let imageBottom = 24;
      if (snap.image) {
        try {
          doc.addImage(snap.image, 'JPEG', 10, 24, 180, 100);
          imageBottom = 128;
        } catch (e) {
          doc.setTextColor(200, 50, 50);
          doc.text('[Image could not be embedded]', 10, 60);
          imageBottom = 70;
        }
      }

      let yPos = imageBottom + 4;

      // Note text
      if (snap.note && snap.note.trim()) {
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        const splitNote = doc.splitTextToSize(`📝 Note: ${snap.note}`, 180);
        doc.text(splitNote, 10, yPos);
        yPos += splitNote.length * 5 + 4;
      }

      // Per-screenshot AI summary
      if (apiKey && snap.note && snap.note.trim()) {
        try {
          const summary = await generateScreenshotSummary(snap.note, apiKey, model);
          if (summary) {
            doc.setFontSize(9);
            doc.setTextColor(100, 50, 180);
            doc.text('✨ AI Summary:', 10, yPos);
            yPos += 6;
            doc.setTextColor(60, 60, 60);
            const splitSummary = doc.splitTextToSize(summary, 178);
            doc.text(splitSummary, 12, yPos);
          }
        } catch (e) {
          // AI summary is optional — skip silently
        }
      }
    }
  }

  doc.save('Smart_Notes.pdf');
}

export function exportToPDF(data) {
  return generateFullPDF(data);
}

