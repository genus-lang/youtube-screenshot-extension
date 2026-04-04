import re

with open('src/content/frameDetector.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix duplicates in state
text = re.sub(r'let _lastSavedPixels = null;\s*(_lastSavedPixels = null;\s*|let _lastSavedPixels = null;\s*)+', 'let _lastSavedPixels = null;\n', text)

# Fix duplicate assignments in startScanning and stopScanning
text = re.sub(r'_lastSavedPixels = null;\s*(_lastSavedPixels = null;\s*)+', '_lastSavedPixels = null;\n', text)

with open('src/content/frameDetector.js', 'w', encoding='utf-8') as f:
    f.write(text)
