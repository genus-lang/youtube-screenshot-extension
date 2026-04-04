const fs = require('fs');
let code = fs.readFileSync('src/content/noteUI.js', 'utf8');

const target = \const result = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'EXTRACT_OCR', payload: { imageDataUrl: frameData } },
            resolve
          );
        });\;

const replacement = \// Load extraction module and run directly inside the iframe sandbox
        const { extractText } = await import('./ocrEngine.js');
        const textResult = await extractText(frameData);
        const result = { success: typeof textResult === 'string', text: textResult, error: 'Extraction failed or returned no text.' };\;

code = code.replace(target, replacement);
fs.writeFileSync('src/content/noteUI.js', code);
