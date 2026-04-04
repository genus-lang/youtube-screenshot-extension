import json

with open('manifest.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for war in data.get('web_accessible_resources', []):
    if 'public/facefinder' in war.get('resources', []):
        war['resources'].remove('public/facefinder')

with open('manifest.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)
