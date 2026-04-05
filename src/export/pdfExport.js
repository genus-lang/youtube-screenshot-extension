import { jsPDF } from 'jspdf';
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
  doc.text(`${count} screenshot${count !== 1 ? 's' : ''}`, cx, cy + 14, { align: 'center' });
}

export async function generateFullPDF(allData, options = {}) {
  if (options.mode === 'images') {
    // Exact layout like Maths.pdf (1280x720 pts, 1 image per page)
    const doc = new jsPDF({ unit: 'pt', format: [1280, 720], orientation: 'landscape' });

    let isFirst = true;
    for (const [key, video] of Object.entries(allData)) {
      if (!video.screenshots) continue;
      
      for (const snap of video.screenshots) {
        if (!isFirst) {
          doc.addPage([1280, 720], 'landscape');
        }
        isFirst = false;

        if (snap.image) {
          try {
            doc.addImage(snap.image, 'JPEG', 0, 0, 1280, 720, undefined, 'FAST');
          } catch (e) {
            doc.setFillColor(240, 240, 245);
            doc.rect(0, 0, 1280, 720, 'F');
          }
        } else {
             doc.setFillColor(240, 240, 245);
             doc.rect(0, 0, 1280, 720, 'F');
        }
      }
    }

    if (isFirst) {
      doc.setFontSize(24);
      doc.text('No screenshots found.', 640, 360, { align: 'center' });
    }

    const date = new Date().toISOString().slice(0, 10);
    const finalName = options.subject ? `${options.subject}.pdf` : `Screenshots_${date}.pdf`;
    doc.save(finalName);
    return;
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });const stored = await new Promise(res =>
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
        
                                const imgW = CONTENT_W;
        const imgH = Math.round(imgW * 9 / 16); 
        const imgX = ML;

        let initialY = y;
        let noteLines = [];
        let totalNeeded = imgH + 5; 

        if (snap.note && snap.note.trim()) {
           noteLines = doc.splitTextToSize(snap.note.trim(), CONTENT_W - 10);
           totalNeeded += 20 + noteLines.length * 4.5;    
        }

        checkPage(totalNeeded);

        const timeStr = snap.time || '0:00';
        const chipW = 28;

        if (snap.image) {
          try {
            doc.addImage(snap.image, 'JPEG', imgX, y, imgW, imgH, undefined, 'FAST');
          } catch (e) {
            drawRect(doc, imgX, y, imgW, imgH, [240, 240, 245]);
          }
        }
        
        drawRect(doc, imgX + 6, y + 6, chipW, 6, [235, 228, 255]);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.purple);
        doc.text(timeStr, imgX + 6 + chipW / 2, y + 10.2, { align: 'center' });      

        if (snap.note && snap.note.trim()) {
           let noteY = y + imgH + 6;

           drawRect(doc, ML, noteY, CONTENT_W, 6, C.noteBg);      
           doc.setFillColor(...C.noteBrd);
           doc.rect(ML, noteY, 1.5, 6, 'F');
           doc.setFontSize(7.5);
           doc.setFont('helvetica', 'bold');
           doc.setTextColor(...C.purple);
           doc.text('Note / Extracted Text', ML + 4, noteY + 4.2);
           noteY += 10;

           doc.setFontSize(9.5);
           doc.setFont('helvetica', 'normal');
           doc.setTextColor(...C.darkText);

           for (const line of noteLines) {
             doc.text(line, ML + 4, noteY);
             noteY += 4.5;
           }
           y = noteY + 6;
        } else {
           y = y + imgH + 8;
        }
      }
      y += 8; 
    } 

    if (apiKey && allNotesForSubject.length > 0) {
      try {
          const combinedTitles = Array.from(videoTitlesForSubject).join(', ');
          const summary = await generateAISummary(allNotesForSubject, combinedTitles);
          
          if (summary) {
             doc.addPage();
             y = MT;
             const textLines = doc.splitTextToSize(summary, CONTENT_W - 8);
             
             doc.setFontSize(14);
             doc.setFont('helvetica', 'bold');
             doc.setTextColor(...C.purple);
             doc.text(`AI Summary — ${subject}`, ML, y + 6);
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
  const finalNameFull = options.subject ? `${options.subject}_Notes.pdf` : `Study_Notes_${date}.pdf`;
  doc.save(finalNameFull);
}

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
          content: `You are a study assistant. Summarize these combined notes extending across the subject consisting of videos (${videoTitle}). Produce structured bullet points with clear headings covering all key topics. Be concise and educational.`
        },
        { role: 'user', content: text }
      ],
      max_tokens: 1500
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
