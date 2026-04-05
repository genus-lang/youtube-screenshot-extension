const fs = require('fs');
let code = fs.readFileSync('src/popup/popup.js', 'utf8');

const regex = /async function loadStats\(\) \{[\s\S]*?const data = await getAllData\(\);[\s\S]*?\/\/ Filter out non-video keys \(settings keys like openai_api_key, pref_\*, etc\.\)[\s\S]*?const videoEntries = Object\.entries\(data\)\.filter\(\(\[key, val\]\) => \{[\s\S]*?return val && typeof val === 'object' && Array\.isArray\(val\.screenshots\);[\s\S]*?\}\);/;

const replaceFunc = `  async function loadStats() {
    const data = await getAllData();
    const activeSubject = await new Promise(res =>
      chrome.storage.local.get(['active_subject'], d => res(d.active_subject || 'General'))
    );

    // Filter out non-video keys and only include screenshots for the active subject
    let videoEntries = Object.entries(data).filter(([key, val]) => {
      return val && typeof val === 'object' && Array.isArray(val.screenshots);
    });

    // Map to keep the original structure but filter screenshots by subject
    videoEntries = videoEntries.map(([key, val]) => {
      const filteredScreenshots = val.screenshots.filter(s => (s.subject || 'General') === activeSubject);
      return [key, { ...val, screenshots: filteredScreenshots }];
    }).filter(([, val]) => val.screenshots.length > 0);`;

code = code.replace(regex, replaceFunc);

const regex2 = /subjectSelector\.addEventListener\('change', \(\) => \{\s*setActiveSubject\(subjectSelector\.value\);\s*\}\);/;
const replaceFunc2 = `subjectSelector.addEventListener('change', async () => {
    await setActiveSubject(subjectSelector.value);
    await loadStats();
  });`;

code = code.replace(regex2, replaceFunc2);

fs.writeFileSync('src/popup/popup.js', code);
console.log('patched');