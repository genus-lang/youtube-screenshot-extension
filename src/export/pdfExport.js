import { jsPDF } from 'jspdf';

// ─── Page constants (A4 in mm) ───────────────────────────────────────────────
const PW = 210;   // page width
const PH = 297;   // page height
const ML = 14;    // margin left
const MR = 14;    // margin right
const MT = 14;    // margin top
const CONTENT_W = PW - ML - MR;  // 182 mm usable width

// ─── Colour palette (RGB tuples for jsPDF) ───────────────────────────────────
const C = {
  purple:   [109, 40, 217],
  darkText: [22,  22,  38],
  midText:  [55,  65,  81],
  lightGray:[120, 120, 135],
  rule:     [200, 200, 215],
  noteBg:   [245, 243, 255],  // light lavender
  noteBrd:  [109, 40, 217],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns aspect-correct image dimensions fitting maxW × maxH */
function fitImage(imgEl, maxW, maxH) {
  // We don't have actual img element in jsPDF context, so use a canvas trick
  // Here we just use a standard 16:9 aspect ratio as fallback
  const ratio = 16 / 9;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  return { w, h };
}

/** Draw a thin horizontal rule */
function drawRule(doc, y, color = C.rule) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(ML, y, PW - MR, y);
}

/** Draw a rounded filled rect (approximated with regular rect in jsPDF) */
function drawRect(doc, x, y, w, h, fillColor, strokeColor = null) {
  doc.setFillColor(...fillColor);
  if (strokeColor) {
    doc.setDrawColor(...strokeColor);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  } else {
    doc.roundedRect(x, y, w, h, 2, 2, 'F');
  }
}

/** Write a text block clamped to page height; returns new yPos */
function writeText(doc, text, x, y, maxWidth, opts = {}) {
  const { fontSize = 10, color = C.midText, lineGap = 0.5, bold = false } = opts;
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  const lines = doc.splitTextToSize(text, maxWidth);
  const lineH = fontSize * 0.3528 + lineGap; // pt to mm
  lines.forEach((line, i) => {
    doc.text(line, x, y + i * lineH);
  });
  return y + lines.length * lineH;
}

// ─── Cover page for each Subject ─────────────────────────────────────────────
function drawSubjectCover(doc, subject, count) {
  const cx = PW / 2;
  const cy = PH / 2 - 20;

  // Background gradient stripe
  drawRect(doc, 0, cy - 30, PW, 60, [235, 228, 255]);

  // Subject title
  doc.setFontSize(30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.purple);
  doc.text(subject, cx, cy, { align: 'center' });

  // Underline
  const tw = doc.getTextWidth(subject);
  doc.setDrawColor(...C.purple);
  doc.setLineWidth(0.8);
  doc.line(cx - tw / 2, cy + 3, cx + tw / 2, cy + 3);

  // Count label
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.lightGray);
  doc.text(`${count} screenshot${count !== 1 ? 's' : ''}`, cx, cy + 12, { align: 'center' });

  // Watermark
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 190);
  doc.text('YouTube Screenshot Notes', cx, PH - 10, { align: 'center' });
}

// ─── Single screenshot page ───────────────────────────────────────────────────
async function drawScreenshotPage(doc, snap, videoTitle, pageNum, totalPages) {
  let y = MT;

  // — Top bar: video title + page number —
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.lightGray);
  const titleClamped = videoTitle.length > 80 ? videoTitle.slice(0, 77) + '...' : videoTitle;
  doc.text(titleClamped, ML, y);
  doc.text(`${pageNum} / ${totalPages}`, PW - MR, y, { align: 'right' });
  y += 4;

  drawRule(doc, y);
  y += 5;

  // — Timestamp chip —
  const timeStr = snap.time || '0:00';
  const chipW = 28;
  drawRect(doc, ML, y - 4, chipW, 7, [235, 228, 255]);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.purple);
  doc.text(timeStr, ML + chipW / 2, y, { align: 'center' });
  y += 7;

  // — Screenshot image (16:9, fills full content width) —
  const imgH = Math.round(CONTENT_W * 9 / 16);  // e.g., 102mm for 182mm wide
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
  y += imgH + 4;

  // — Note box —
  if (snap.note && snap.note.trim()) {
    const noteText = snap.note.trim();
    const noteLines = doc.splitTextToSize(noteText, CONTENT_W - 10);
    const noteBoxH = noteLines.length * 5 + 8;

    // Guard: if note would overflow page, truncate
    if (y + noteBoxH < PH - 20) {
      drawRect(doc, ML, y, CONTENT_W, noteBoxH, C.noteBg, null);
      // Left accent bar
      doc.setFillColor(...C.noteBrd);
      doc.rect(ML, y, 1.5, noteBoxH, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.purple);
      doc.text('Note', ML + 4, y + 5);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.darkText);
      noteLines.forEach((line, i) => {
        doc.text(line, ML + 4, y + 10 + i * 5);
      });
      y += noteBoxH + 4;
    }
  }

  // — Footer rule —
  if (y < PH - 12) {
    drawRule(doc, PH - 10);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(170, 170, 180);
    doc.text('YouTube Screenshot Notes', PW / 2, PH - 6, { align: 'center' });
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Generates a clean, scalable PDF grouped by Subject.
 * Each subject has a cover page, then one page per screenshot.
 * No AI summary — just pristine image + note layout.
 */
export async function generateFullPDF(allData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // Group all screenshots by subject
  const subjectMap = {};
  Object.values(allData).forEach(video => {
    if (!video.screenshots) return;
    video.screenshots.forEach(snap => {
      const subj = snap.subject || 'General';
      if (!subjectMap[subj]) subjectMap[subj] = [];
      subjectMap[subj].push({ snap, videoTitle: video.title || 'Unknown Video' });
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
  const totalPages = subjects.reduce((sum, s) => sum + subjectMap[s].length, 0);
  let pageNum = 0;
  let firstSection = true;

  for (const subject of subjects) {
    const items = subjectMap[subject];

    // Subject cover page
    if (!firstSection) doc.addPage();
    firstSection = false;
    drawSubjectCover(doc, subject, items.length);

    // One page per screenshot
    for (const { snap, videoTitle } of items) {
      doc.addPage();
      pageNum++;
      await drawScreenshotPage(doc, snap, videoTitle, pageNum, totalPages);
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`Study_Notes_${date}.pdf`);
}

// Keep generateAISummary exported so onenoteExport.js can still import it
export async function generateAISummary(notes, videoTitle) {
  const stored = await new Promise(res =>
    chrome.storage.local.get(['openai_api_key', 'openai_model'], res)
  );
  const apiKey = stored.openai_api_key;
  const model = stored.openai_model || 'llama-3.3-70b-versatile';
  if (!apiKey) throw new Error('NO_API_KEY');

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
        { role: 'user', content: Array.isArray(notes) ? notes.join('\n') : notes }
      ],
      max_tokens: 600
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
