import re

with open('src/popup/popup.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('setTimeout(() => {\\n          chrome.tabs.create({ url: resp.links.oneNoteWebUrl.href });\\n        }, 1500);', 
'''btnOpenOneNote.classList.remove(\\'hidden\\');
          btnOpenOneNote.onclick = () => chrome.tabs.create({ url: resp.links.oneNoteWebUrl.href });''')

text = text.replace('btnExportOneNote.innerHTML = \\'<span class=\"spinner\"></span> Syncing...\\';',
'''btnExportOneNote.innerHTML = \\'<span class=\"spinner\"></span> Syncing...\\';
    btnOpenOneNote.classList.add(\\'hidden\\');''')

with open('src/popup/popup.js', 'w', encoding='utf-8') as f:
    f.write(text)
