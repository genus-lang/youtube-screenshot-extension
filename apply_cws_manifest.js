const fs = require('fs');
const path = require('path');
const manifestPath = path.join(__dirname, 'manifest.json');

const mf = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// 1. Expand Host Permissions:
// Google requires developers to declare ALL hosts they intend to fetch data from or inject content into, 
// otherwise they silently block it or researchers reject it for 'unjustified permissions / bypassing CORS blindly'.
const requiredHosts = [
  "https://www.youtube.com/*",
  "https://api.groq.com/*",
  "https://graph.microsoft.com/*"
];

mf.host_permissions = Array.from(new Set([...(mf.host_permissions || []), ...requiredHosts]));

// 2. Ensure Action icon is solid
// 3. Make sure privacy policy is linked? Chrome web store takes this on the web dashboard side, not inside manifest (though "homepage_url" can help).

fs.writeFileSync(manifestPath, JSON.stringify(mf, null, 2), 'utf8');

console.log("Manifest patched for CWS compliance.");