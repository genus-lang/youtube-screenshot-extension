import { jsPDF } from 'jspdf';

// ─── Page constants (A4 in mm) ───────────────────────────────────────────────
const PW = 210;
const PH = 297;
const ML = 14;
const MR = 14;
const MT = 14;
const CONTENT_W = PW - ML - MR;  // 182 mm

const C = {
  purple:   [109, 40, 217],
  darkText: [22,  22,  38],
  midText:  [55,  65,  81],
  lightGray:[120, 120, 135],
  rule:     [200, 200, 215],
  noteBg:   [245, 243, 255],
  noteBrd:  [109, 40, 217],
  videoBg:  [237, 233, 254],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function drawRule(doc, y, color = C.rule) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(ML, y, PW - MR, y);
}

function drawRect(doc, x, y, w, h, fillColor) {
  doc.setFillColor(...fillColor);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
}

// ─── Subject cover page ───────────────────────────────────────────────────────
function drawSubjectCover(doc, subject, screenshotCount) {
  const cx = PW / 2;
  const cy = PH / 2 - 20;

  drawRect(doc, 0, cy - 35, PW, 70, [235, 228, 255]);

  doc.setFontSize(30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.purple);
  doc.text(subject, cx, cy, { align: 'center' });

  const tw = doc.getTextWidth(subject);
  doc.setDrawColor(...C.purple);
  doc.setLineWidth(0.8);
  doc.line(cx - tw / 2, cy + 4, cx + tw / 2, cy + 4);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.lightGray);
  doc.text(`${screenshotCount} screenshot${screenshotCount !== 1 ? 's' : ''}`, cx, cy + 14, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(190, 190, 200);
  doc.text('YouTube Screenshot Notes', cx, PH - 10, { align: 'center' });
}

// ─── Video title header page (shown ONCE per video within a subject) ──────────
function drawVideoTitlePage(doc, videoTitle) {
  const cx = PW / 2;
  const cy = PH / 2;

  drawRect(doc, ML, cy - 20, CONTENT_W, 32, C.videoBg);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.lightGray);
  doc.text('VIDEO', cx, cy - 10, { align: 'center' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.darkText);
  const titleLines = doc.splitTextToSize(videoTitle, CONTENT_W - 20);
  const lineH = 7;
  titleLines.forEach((line, i) => {
    doc.text(line, cx, cy + i * lineH, { align: 'center' });
  });

  doc.setFontSize(8);
  doc.setTextColor(190, 190, 200);
  doc.text('YouTube Screenshot Notes', cx, PH - 10, { align: 'center' });
}

// ─── Single screenshot page ───────────────────────────────────────────────────
function drawScreenshotPage(doc, snap, pageNum, totalPages) {
  let y = MT;

  // Top: page number
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.lightGray);
  doc.text(`${pageNum} / ${totalPages}`, PW - MR, y, { align: 'right' });
  y += 4;
  drawRule(doc, y);
  y += 5;

  // Timestamp chip
  const timeStr = snap.time || '0:00';
  const chipW = 30;
  drawRect(doc, ML, y - 4, chipW, 7, [235, 228, 255]);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.purple);
  doc.text(timeStr, ML + chipW / 2, y, { align: 'center' });
  y += 7;

  // Screenshot image (full-width 16:9)
  const imgH = Math.round(CONTENT_W * 9 / 16);
  if (snap.image) {
    try {
      doc.addImage(snap.image, 'JPEG', ML, y, CONTENT_W, imgH, undefined, 'FAST');
    } catch (e) {
      drawRect(doc, ML, y, CONTENT_W, imgH, [240, 240, 245]);
      doc.setFontSize(9);
      doc.setTextColor(180, 50, 50);
      doc.text('[Image could not be embedded]', ML + CONTENT_W / 2, y + imgH / 2, { align: 'center' });
    }
  }
  y += imgH + 5;

  // Note box
  if (snap.note && snap.note.trim()) {
    const noteLines = doc.splitTextToSize(snap.note.trim(), CONTENT_W - 10);
    const noteBoxH = noteLines.length * 5 + 10;

    if (y + noteBoxH < PH - 16) {
      drawRect(doc, ML, y, CONTENT_W, noteBoxH, C.noteBg);
      doc.setFillColor(...C.noteBrd);
      doc.rect(ML, y, 1.5, noteBoxH, 'F');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.purple);
      doc.text('Note', ML + 4, y + 5);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.darkText);
      noteLines.forEach((line, i) => {
        doc.text(line, ML + 4, y + 10 + i * 5);
      });
    }
  }

  // Footer
  drawRule(doc, PH - 10);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(170, 170, 180);
  doc.text('YouTube Screenshot Notes', PW / 2, PH - 6, { align: 'center' });
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * PDF structure:
 *   [Subject Cover Page]
 *     [Video Title Page]   ← shown ONCE per video
 *       Screenshot 1
 *       Screenshot 2
 *     [Next Video Title Page]
 *       Screenshot 3
 *   [Next Subject Cover Page]
 *     ...
 */
export async function generateFullPDF(allData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // Build: subjectMap → { subject: { videoId: { title, screenshots[] } } }
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
  if (subjects.length === 0) {
    doc.setFontSize(14);
    doc.setTextColor(...C.midText);
    doc.text('No screenshots found.', PW / 2, PH / 2, { align: 'center' });
    doc.save('Smart_Notes.pdf');
    return;
  }

  // Count total screenshot pages for page numbering
  let totalPages = 0;
  subjects.forEach(s => Object.values(subjectMap[s]).forEach(v => totalPages += v.screenshots.length));
  let pageNum = 0;
  let firstSection = true;

  for (const subject of subjects) {
    const videoMap = subjectMap[subject];
    const subjectTotal = Object.values(videoMap).reduce((s, v) => s + v.screenshots.length, 0);

    if (!firstSection) doc.addPage();
    firstSection = false;
    drawSubjectCover(doc, subject, subjectTotal);

    for (const videoId of Object.keys(videoMap)) {
      const { title, screenshots } = videoMap[videoId];

      // Video title page (once per video)
      doc.addPage();
      drawVideoTitlePage(doc, title);

      // One screenshot per page
      for (const snap of screenshots) {
        doc.addPage();
        pageNum++;
        drawScreenshotPage(doc, snap, pageNum, totalPages);
      }
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`Study_Notes_${date}.pdf`);
}

// ─── Keep generateAISummary exported for onenoteExport.js ────────────────────
export async function generateAISummary(notes, videoTitle) {
  const stored = await new Promise(res =>
    chrome.storage.local.get(['openai_api_key', 'openai_model'], res)
  );
  const apiKey = stored.openai_api_key;
  const model = stored.openai_model || 'llama-3.3-70b-versatile';
  if (!apiKey) throw new Error('NO_API_KEY');

  const text = Array.isArray(notes) ? notes.join('\n') : notes;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a study assistant. Summarize these lecture notes from "${videoTitle || 'a video'}" as structured bullet points with clear headings. Be concise and educational.`
        },
        { role: 'user', content: text }
      ],
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Groq API Error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

export function exportToPDF(data) {
  return generateFullPDF(data);
}
