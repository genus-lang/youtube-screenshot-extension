const fs = require('fs');
let code = fs.readFileSync('src/export/pdfExport.js', 'utf8');

const regex = /const imgW = 145;\s*const imgH = Math\.round\(imgW \* 9 \/ 16\); \s*const imgX = ML \+ \(CONTENT_W - imgW\) \/ 2;/;

const replaceFunc = `        const imgW = CONTENT_W;
        const imgH = Math.round(imgW * 9 / 16); 
        const imgX = ML;`;

code = code.replace(regex, replaceFunc);
fs.writeFileSync('src/export/pdfExport.js', code);
console.log('Patched pdfExport.js');