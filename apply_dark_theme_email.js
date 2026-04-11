const fs = require('fs');
const path = require('path');

const POPUP_CSS = path.join(__dirname, 'src/popup/popup.css');
const POPUP_JS = path.join(__dirname, 'src/popup/popup.js');
const OPTIONS_HTML = path.join(__dirname, 'src/options/options.html');

// 1. Fix Popup CSS for dark theme
let css = fs.readFileSync(POPUP_CSS, 'utf8');
css = css.replace('.modal-content {', '.modal-content {\n  background: #1e1e2e;\n  color: #e2e8f0; /* Dark theme default */');
css = css.replace('.input-group input, .input-group textarea {\n  width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px;\n  background: var(--bg); color: var(--text); font-family: inherit; font-size: 13px;\n}', 
`.input-group input, .input-group textarea {
  width: 100%; padding: 8px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
  background: #0f0f1a; color: #e2e8f0; font-family: inherit; font-size: 13px;
}`);
css = css.replace('.btn-ghost { background: transparent; border: none; color: var(--text); padding: 8px 12px; cursor: pointer; border-radius: 6px; }', 
`.btn-ghost { background: transparent; border: none; color: #e2e8f0; padding: 8px 12px; cursor: pointer; border-radius: 6px; }`);
fs.writeFileSync(POPUP_CSS, css, 'utf8');


// 2. Fix Popup JS for Email and Database functionality
let js = fs.readFileSync(POPUP_JS, 'utf8');
js = js.replace('const DEV_EMAIL = "your_email@domain.com";', 'const DEV_EMAIL = "info.lazyar@gmail.com";');
js = js.replace('window.open(`mailto:${DEV_EMAIL}?subject=${subject}&body=${body}`);', 
`// Open Gmail Composition directly via web intent instead of mailto: OS default
        const gmailUrl = \`https://mail.google.com/mail/?view=cm&fs=1&to=\${DEV_EMAIL}&su=\${subject}&body=\${body}\`;
        window.open(gmailUrl, '_blank');`);
fs.writeFileSync(POPUP_JS, js, 'utf8');


// 3. Add instructions for OneNote API key in Options HTML
let html = fs.readFileSync(OPTIONS_HTML, 'utf8');

const onenoteHintOld = `Required to push notes directly to your personal OneNote notebook.

              Created via the <a href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps" target="_blank" rel="noopener">Azure Portal</a>.`;

const onenoteHintNew = `Required to push notes directly to your personal OneNote notebook. 
              <br><br>
              <strong style="color:#60a5fa;">How to get your API Key (Client ID) in 3 simple steps:</strong>
              <ol style="margin-top: 8px; margin-left: 20px; line-height: 1.6; color: #cbd5e1;">
                <li>Go to the <a href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps" target="_blank" rel="noopener" style="color: #3b82f6;">App Registrations page</a> in the Microsoft Azure Portal and sign in.</li>
                <li>Click <strong>"New registration"</strong>, give it a name (like <em>LazyAR Notes</em>), choose <em>"Accounts in any organizational directory and personal Microsoft accounts"</em>, and under <strong>Redirect URI</strong>, choose <em>"Single-page application (SPA)"</em> and paste exactly: <code style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px;">https://&lt;your-extension-id&gt;.chromiumapp.org/</code> (or whatever standard redirect URL the extension uses). Click Register.</li>
                <li>On the next screen, copy the <strong>"Application (client) ID"</strong> and paste it into the box above. That's it!</li>
              </ol>`;

html = html.replace(onenoteHintOld, onenoteHintNew);
fs.writeFileSync(OPTIONS_HTML, html, 'utf8');

console.log('App updates applied successfully.');
