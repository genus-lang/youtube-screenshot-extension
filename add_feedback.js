const fs = require('fs');

const htmlPath = 'src/popup/popup.html';
let html = fs.readFileSync(htmlPath, 'utf8');

if (!html.includes('id="btn-feedback"')) {
  // Add button to the top header right next to settings
  html = html.replace(
    '<button id="btn-settings" class="icon-btn" title="Settings">',
    '<a href="https://github.com/genus-lang/youtube-screenshot-extension/issues/new" target="_blank" id="btn-feedback" class="icon-btn" title="Give Feedback" style="text-decoration: none; color: inherit; display: inline-flex; align-items: center; justify-content: center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></a>\n      <button id="btn-settings" class="icon-btn" title="Settings">'
  );
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Feedback button added to popup.html');
}
