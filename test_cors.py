import requests

# Test OPTIONS preflight request
try:
    response = requests.options('http://localhost:5000/fetch-url',
                               headers={
                                   'Origin': 'http://localhost:3000',
                                   'Access-Control-Request-Method': 'POST',
                                   'Access-Control-Request-Headers': 'Content-Type'
                               },
                               timeout=5)
    print(f"OPTIONS Status Code: {response.status_code}")
    print(f"OPTIONS Headers: {dict(response.headers)}")
except Exception as e:
    print(f"OPTIONS Error: {e}")

# Test actual POST request
try:
    response = requests.post('http://localhost:5000/fetch-url',
                           json={'url': 'https://example.com'},
                           timeout=5)
    print(f"POST Status Code: {response.status_code}")
    print(f"POST Response: {response.text[:200]}...")
except Exception as e:
    print(f"POST Error: {e}")