const fs = require('fs');

const htmlPath = 'src/popup/popup.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// Undo top header feedback
html = html.replace(
  '<a href="https://github.com/genus-lang/youtube-screenshot-extension/issues/new" target="_blank" id="btn-feedback" class="icon-btn" title="Give Feedback" style="text-decoration: none; color: inherit; display: inline-flex; align-items: center; justify-content: center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></a>\n      <button id="btn-settings" class="icon-btn" title="Settings">',
  '<button id="btn-settings" class="icon-btn" title="Settings">'
);

if (!html.includes('feedback-btn')) {
  // Add to bottom right corner
  html = html.replace(
    '</body>',
    '  <!-- Floating Feedback Button -->\n  <a href="https://github.com/genus-lang/youtube-screenshot-extension/issues/new" target="_blank" id="btn-feedback-floating" class="feedback-btn" title="Give Feedback">\n    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>\n  </a>\n</body>'
  );
  fs.writeFileSync(htmlPath, html, 'utf8');
}

const cssPath = 'src/popup/popup.css';
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.feedback-btn')) {
  css += `
.feedback-btn {
  position: fixed;
  bottom: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 100;
  text-decoration: none;
}
.feedback-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.6);
  color: white;
}
`;
  fs.writeFileSync(cssPath, css, 'utf8');
}

console.log('Feedback button correctly added.');
