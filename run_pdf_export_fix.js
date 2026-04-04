const fs = require('fs');

const code = \import { jsPDF } from 'jspdf';

// Page constants (A4 in mm)
const PW = 210;
const PH = 297;
const ML = 14;
const MR = 14;
const MT = 14;
const CONTENT_W = PW - ML - MR;

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

function drawRect(doc, x, y, w, h, fill) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
}

function drawSubjectCover(doc, subject, count) {
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
  doc.text(\\\\ screenshot\\\\, cx, cy + 14, { align: 'center' });
}

export async function generateFullPDF(allData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const stored = await new Promise(res =>
    chrome.storage.local.get(['openai_api_key', 'openai_model'], res)
  );
  const apiKey = stored.openai_api_key;

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
    doc.text('No screenshots found.', PW / 2, PH / 2, { align: 'center' });
    doc.save('Smart_Notes.pdf');
    return;
  }

  let y = MT;
  function checkPage(need) {
    if (y + need >= PH - 20) {
      doc.addPage();
      y = MT;
      return true;
    }
    return false;
  }

  let firstSection = true;

  for (const subject of subjects) {
    const videoMap = subjectMap[subject];
    const subjectTotal = Object.values(videoMap).reduce((s, v) => s + v.screenshots.length, 0);

    if (!firstSection) doc.addPage();
    firstSection = false;
    
    drawSubjectCover(doc, subject, subjectTotal);

    let allNotesForSubject = [];
    let videoTitlesForSubject = new Set();
    doc.addPage();
    y = MT;
    
    for (const videoId of Object.keys(videoMap)) {
      const { title, screenshots } = videoMap[videoId];
      videoTitlesForSubject.add(title);

      // Video Title
      checkPage(24);
      drawRect(doc, ML, y, CONTENT_W, 14, C.videoBg);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.darkText);
      doc.text(title, ML + 4, y + 9.5, { maxWidth: CONTENT_W - 8 });
      y += 24;

      for (const snap of screenshots) {
        if (snap.note && snap.note.trim()) {
           allNotesForSubject.push(snap.note.trim());
        }

        // Force 2 images per page: scale width to 135mm (height ~76mm).
        // 2 * (76 + 20) = 192 < 297, so 2 will easily fit.
        const imgW = 125;
        const imgH = Math.round(imgW * 9 / 16); // 70mm
        const imgX = ML + (CONTENT_W - imgW) / 2;

        checkPage(imgH + 25);

        // Timestamp chip
        const timeStr = snap.time || '0:00';
        const chipW = 28;
        drawRect(doc, imgX, y, chipW, 7, [235, 228, 255]);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.purple);
        doc.text(timeStr, imgX + chipW / 2, y + 5, { align: 'center' });
        y += 9;

        // Image
        if (snap.image) {
          try {
            doc.addImage(snap.image, 'JPEG', imgX, y, imgW, imgH, undefined, 'FAST');
          } catch (e) {
            drawRect(doc, imgX, y, imgW, imgH, [240, 240, 245]);
          }
        }
        y += imgH + 6;

        // Notes directly under image
        if (snap.note && snap.note.trim()) {
           const noteLines = doc.splitTextToSize(snap.note.trim(), CONTENT_W - 10);
           
           checkPage(16);
           drawRect(doc, ML, y, CONTENT_W, 6, C.noteBg);
           doc.setFillColor(...C.noteBrd);
           doc.rect(ML, y, 1.5, 6, 'F');
           doc.setFontSize(7.5);
           doc.setFont('helvetica', 'bold');
           doc.setTextColor(...C.purple);
           doc.text('Note / Extracted Text', ML + 4, y + 4.2);
           y += 10;

           doc.setFontSize(9.5);
           doc.setFont('helvetica', 'normal');
           doc.setTextColor(...C.darkText);

           for (const line of noteLines) {
             checkPage(8);
             doc.text(line, ML + 4, y);
             y += 4.5;
           }
           y += 6; 
        } else {
           y += 8; 
        }
      }
      
      y += 8; 
    } 

    // ALL VIDEOS IN SUBJECT FINISHED. Now print ONE final AI Summary for ALL notes.
    if (apiKey && allNotesForSubject.length > 0) {
      try {
          const combinedTitles = Array.from(videoTitlesForSubject).join(', ');
          const summary = await generateAISummary(allNotesForSubject, combinedTitles);
          
          if (summary) {
             doc.addPage(); // Force summary on its own clean final page(s)
             y = MT;
             const textLines = doc.splitTextToSize(summary, CONTENT_W - 8);
             
             doc.setFontSize(14);
             doc.setFont('helvetica', 'bold');
             doc.setTextColor(...C.purple);
             doc.text(\\\AI Summary — \\\\, ML, y + 6);
             y += 14;
             
             doc.setFontSize(10);
             doc.setFont('helvetica', 'normal');
             doc.setTextColor(...C.darkText);

             for (const line of textLines) {
               checkPage(6);
               doc.text(line, ML + 4, y);
               y += 5.5;
             }
          }
      } catch(e) {
          console.warn('Subject AI Summary failed:', e);
      }
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(\\\Study_Notes_\.pdf\\\);
}

export async function generateAISummary(notes, videoTitle) {
  const stored = await new Promise(res =>
    chrome.storage.local.get(['openai_api_key', 'openai_model'], res)
  );
  const apiKey = stored.openai_api_key;
  const model = stored.openai_model || 'llama-3.3-70b-versatile';
  if (!apiKey) throw new Error('NO_API_KEY');

  const text = Array.isArray(notes) ? notes.join('\\n') : notes;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': \\\Bearer \\\\,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: \\\You are a study assistant. Summarize these combined notes extending across the subject consisting of videos (\). Produce structured bullet points with clear headings covering all key topics. Be concise and educational.\\\
        },
        { role: 'user', content: text }
      ],
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(\\\Groq API Error: \\\\);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

export function exportToPDF(data) {
  return generateFullPDF(data);
}
\

fs.writeFileSync('src/export/pdfExport.js', code);
