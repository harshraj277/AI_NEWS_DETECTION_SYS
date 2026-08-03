import requests
import json

try:
    response = requests.post('http://localhost:5000/predict',
                           json={'text': 'This is a test news article'},
                           timeout=5)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")