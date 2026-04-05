const fs = require('fs');
let code = fs.readFileSync('src/export/pdfExport.js', 'utf8');

const regex = /const imgW = 125;[\s\S]*?\} else \{\s*y \+= 8;\s*\}/;

const replaceFunc = `        const imgW = 85;
        const imgH = Math.round(imgW * 9 / 16); // 48mm
        const imgX = ML; // Align left
        
        let initialY = y;
        let noteLines = [];
        let totalNeeded = imgH + 20;

        if (snap.note && snap.note.trim()) {
           noteLines = doc.splitTextToSize(snap.note.trim(), CONTENT_W - imgW - 10);
           totalNeeded = Math.max(totalNeeded, 20 + noteLines.length * 4.5);
        }
        
        checkPage(totalNeeded);

        const timeStr = snap.time || '0:00';
        const chipW = 28;
        
        drawRect(doc, imgX, y, chipW, 6, [235, 228, 255]);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.purple);
        doc.text(timeStr, imgX + chipW / 2, y + 4.2, { align: 'center' });        
        
        if (snap.image) {
          try {
            doc.addImage(snap.image, 'JPEG', imgX, y + 8, imgW, imgH, undefined, 'FAST');
          } catch (e) {
            drawRect(doc, imgX, y + 8, imgW, imgH, [240, 240, 245]);
          }
        }

        if (snap.note && snap.note.trim()) {
           const noteX = imgX + imgW + 6;
           let noteY = y + 8;
           
           drawRect(doc, noteX, noteY, CONTENT_W - imgW - 6, 6, C.noteBg);
           doc.setFillColor(...C.noteBrd);
           doc.rect(noteX, noteY, 1.5, 6, 'F');
           doc.setFontSize(7.5);
           doc.setFont('helvetica', 'bold');
           doc.setTextColor(...C.purple);
           doc.text('Note / Extracted Text', noteX + 4, noteY + 4.2);
           noteY += 10;

           doc.setFontSize(9.5);
           doc.setFont('helvetica', 'normal');
           doc.setTextColor(...C.darkText);

           for (const line of noteLines) {
             doc.text(line, noteX + 4, noteY);
             noteY += 4.5;
           }
           y = Math.max(y + 8 + imgH + 6, noteY + 4);
        } else {
           y = y + 8 + imgH + 6;
        }`;

code = code.replace(regex, replaceFunc);
fs.writeFileSync('src/export/pdfExport.js', code);
console.log('Patched pdfExport.js');