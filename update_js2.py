import re

with open('src/popup/popup.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(
    r"btnExportOneNote.innerHTML = '<span class=\"spinner\"></span> Syncing...';\s*showToast\('info', '☁️ Uploading to Microsoft OneNote...'\);",
    "btnExportOneNote.innerHTML = '<span class=\"spinner\"></span> Syncing...';\n    if(btnOpenOneNote) btnOpenOneNote.classList.add('hidden');\n    showToast('info', '☁️ Uploading to Microsoft OneNote...');",
    text
)

text = re.sub(
    r"setTimeout\(\(\) => \{\s*chrome\.tabs\.create\(\{ url: resp\.links\.oneNoteWebUrl\.href \}\);\s*\}, 1500\);",
    "if(btnOpenOneNote) { btnOpenOneNote.classList.remove('hidden'); btnOpenOneNote.onclick = () => chrome.tabs.create({ url: resp.links.oneNoteWebUrl.href }); }",
    text
)

with open('src/popup/popup.js', 'w', encoding='utf-8') as f:
    f.write(text)
