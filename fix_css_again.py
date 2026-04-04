import re

with open('src/popup/popup.css', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'\.hidden\s*\{.*\}', '', text)
text += '\n\n.hidden {\n  display: none !important;\n}\n'

with open('src/popup/popup.css', 'w', encoding='utf-8') as f:
    f.write(text)
