import re

with open('src/popup/popup.css', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'\.hidden \{ display: none !important; \}', '', text).strip()
text += '\n\n.hidden { display: none !important; }\n'

with open('src/popup/popup.css', 'w', encoding='utf-8') as f:
    f.write(text)
