import urllib.request
import os
import json

base_url = "https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1"

os.makedirs('public/blazeface', exist_ok=True)

print("Downloading model.json...")
model_json_data = urllib.request.urlopen(f"{base_url}/model.json?tfjs-format=file").read()
with open('public/blazeface/model.json', 'wb') as f:
    f.write(model_json_data)

model_info = json.loads(model_json_data.decode('utf-8'))
for weight_file in model_info['weightsManifest'][0]['paths']:
    print(f"Downloading {weight_file}...")
    weight_data = urllib.request.urlopen(f"{base_url}/{weight_file}?tfjs-format=file").read()
    with open(f'public/blazeface/{weight_file}', 'wb') as f:
        f.write(weight_data)

print("Done!")
