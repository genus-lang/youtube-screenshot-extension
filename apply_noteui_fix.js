const fs = require('fs');

let code = fs.readFileSync('src/content/noteUI.js', 'utf8');

// replace the chrome.runtime.sendMessage with extractText
code = code.replace(
  \chrome.runtime.sendMessage(
            { action: 'EXTRACT_OCR', payload: { imageDataUrl: frameData } },
            resolve
          );\,
  \// use local ocrEngine to bypass MV3 background worker limits
          import('./ocrEngine.js').then(m => m.extractText(frameData).then(resolve).catch(e => resolve({ success: false, error: e.message })));\
);

code = code.replace(
  \if (result && result.success && result.text && result.text.length > 0)\,
  \// result is a string if successful, or an object with error if failed
        if (typeof result === 'string' && result.length > 0)\
);

code = code.replace(
  \
oteField.value = existing
            ? \\\\\\\\\\n\\\n--- OCR Extracted ---\\\\n\\\\\\
            : result.text;\,
  \
oteField.value = existing
            ? \\\\\\\\\\n\\\n--- OCR Extracted ---\\\\n\\\\\\
            : result;\
);

fs.writeFileSync('src/content/noteUI.js', code);
