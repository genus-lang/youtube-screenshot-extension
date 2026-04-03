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
 * Generates a PDF containing:
 *   Page 1 → AI Summary of all notes
 *   Page 2+ → Each screenshot with its timestamp and note
 */
export async function generateFullPDF(allData) {
  const doc = new jsPDF();

  const notes = getAllNotes(allData);
  let summary = 'No notes were provided — screenshots are included below.';

  if (notes.length > 0) {
    try {
      summary = await generateAISummary(notes);
    } catch (err) {
      console.error('AI Summary failed:', err);
      if (err.message === 'NO_API_KEY') {
        summary = '⚠️ No Groq API key configured.\n\nGo to the extension Options page to add your key, then try again.';
      } else {
        summary = `⚠️ AI summary failed: ${err.message}\n\nYour raw notes are included with each screenshot below.`;
      }
    }
  }

  // ───── Page 1: AI Summary ─────
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 60);
  doc.text('AI Study Summary', 10, 18);

  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.5);
  doc.line(10, 22, 200, 22);

  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  const splitSummary = doc.splitTextToSize(summary, 180);
  doc.text(splitSummary, 10, 30);

  // ───── Pages 2+: Screenshots + Notes ─────
  Object.entries(allData).forEach(([videoId, video]) => {
    if (!video.screenshots || !video.screenshots.length) return;

    video.screenshots.forEach((item) => {
      doc.addPage();

      // Video title header
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(video.title || videoId, 10, 10);

      // Timestamp
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 60);
      doc.text(`Time: ${item.time || 'N/A'}`, 10, 18);

      // Screenshot image
      if (item.image) {
        try {
          doc.addImage(item.image, 'JPEG', 10, 24, 180, 100);
        } catch (e) {
          console.error('Image embed failed:', e);
          doc.setTextColor(200, 50, 50);
          doc.text('[Image could not be embedded]', 10, 70);
        }
      }

      // Note text
      if (item.note) {
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        const splitNote = doc.splitTextToSize(`Note: ${item.note}`, 180);
        doc.text(splitNote, 10, 132);
      }
    });
  });

  doc.save('Smart_Notes.pdf');
}

export function exportToPDF(data) {
  console.log('Exporting data to PDF...', data);
  return generateFullPDF(data);
}
