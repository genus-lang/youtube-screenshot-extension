import re

with open('src/popup/popup.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Add btnOpenOneNote definition if missing
if "btnOpenOneNote" not in text:
    text = text.replace("const btnExportOneNote= document.getElementById('btn-export-onenote');", "const btnExportOneNote= document.getElementById('btn-export-onenote');\n  const btnOpenOneNote  = document.getElementById('btn-open-onenote');")

# Replace logic 
old_block = '''  btnExportOneNote.addEventListener('click', async () => {
    btnExportOneNote.disabled = true;
    const oldHtml = btnExportOneNote.innerHTML;
    btnExportOneNote.innerHTML = '<span class="spinner"></span> Syncing...';
    showToast('info', '☁️ Uploading to Microsoft OneNote...');

    try {
      const resp = await exportToOneNote();
      showToast('success', '✅ Successfully pushed to OneNote!');

      // Auto-open the exact note in a new tab so the user never has to search for it!
      if (resp && resp.links && resp.links.oneNoteWebUrl) {
        setTimeout(() => {
          chrome.tabs.create({ url: resp.links.oneNoteWebUrl.href });       
        }, 1500);
      }'''

new_block = '''  btnExportOneNote.addEventListener('click', async () => {
    btnExportOneNote.disabled = true;
    const oldHtml = btnExportOneNote.innerHTML;
    btnExportOneNote.innerHTML = '<span class="spinner"></span> Syncing...';
    if (btnOpenOneNote) btnOpenOneNote.classList.add('hidden');
    showToast('info', '☁️ Uploading to Microsoft OneNote...');

    try {
      const resp = await exportToOneNote();
      showToast('success', '✅ Successfully pushed to OneNote!');

      if (resp && resp.links && resp.links.oneNoteWebUrl) {
        if (btnOpenOneNote) {
            btnOpenOneNote.classList.remove('hidden');
            btnOpenOneNote.onclick = () => {
                chrome.tabs.create({ url: resp.links.oneNoteWebUrl.href });
            };
        }
      }'''

text = text.replace(old_block, new_block)

with open('src/popup/popup.js', 'w', encoding='utf-8') as f:
    f.write(text)
