# image_gen.py
import json
import time
import requests
import base64

class FusionBrainAPI:
    def __init__(self, url, api_key, secret_key):
        self.URL = url
        self.AUTH_HEADERS = {
            'X-Key': f'Key {api_key}',
            'X-Secret': f'Secret {secret_key}',
        }

    def get_pipeline(self):
        r = requests.get(self.URL + 'key/api/v1/pipelines', headers=self.AUTH_HEADERS)
        r.raise_for_status()
        data = r.json()
        return data[0]['id']

    def generate(self, prompt, pipeline_id, images=1, width=1024, height=1024, style=None, negative_prompt=None):
        params = {
            "type": "GENERATE",
            "numImages": images,
            "width": width,
            "height": height,
            "generateParams": {"query": prompt}
        }
        if style:             params["style"] = style
        if negative_prompt:   params["negativePromptDecoder"] = negative_prompt

        files = {
            'pipeline_id': (None, pipeline_id),
            'params':      (None, json.dumps(params), 'application/json'),
        }
        r = requests.post(self.URL + 'key/api/v1/pipeline/run',
                          headers=self.AUTH_HEADERS, files=files)
        r.raise_for_status()
        return r.json()['uuid']

    def check_generation(self, request_id, attempts=10, delay=5):
        for _ in range(attempts):
            r = requests.get(self.URL + f'key/api/v1/pipeline/status/{request_id}',
                             headers=self.AUTH_HEADERS)
            r.raise_for_status()
            data = r.json()
            if data['status'] == 'DONE':
                return data['result']['files']
            time.sleep(delay)
        return None

    def save_images(self, files, out_path_prefix):
        """Save all returned files under out_path_prefix_1.png, _2.png, …"""
        for i, fdata in enumerate(files, start=1):
            if fdata.startswith('http'):
                img = requests.get(fdata).content
            else:
                img = base64.b64decode(fdata)
            dst = f"{out_path_prefix}_{i}.png"
            with open(dst, 'wb') as fd:
                fd.write(img)
        return True
