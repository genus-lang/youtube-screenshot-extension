const fs = require('fs');
let code = fs.readFileSync('src/export/pdfExport.js', 'utf8');

const regex = /const imgW = 85;[\s\S]*?\} else \{\s*y = y \+ 8 \+ imgH \+ 6;\s*\}/;

const replaceFunc = `        const imgW = 145;
        const imgH = Math.round(imgW * 9 / 16); 
        const imgX = ML + (CONTENT_W - imgW) / 2;

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
        }`;

code = code.replace(regex, replaceFunc);
fs.writeFileSync('src/export/pdfExport.js', code);
console.log('Patched pdfExport.js');