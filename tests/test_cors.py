"""Manual smoke test: verify CORS preflight and URL fetching work.

Usage: python tests/test_cors.py   (with Api.py already serving on :5000)
"""
import requests


def test_preflight():
    # Test OPTIONS preflight request
    try:
        response = requests.options(
            'http://localhost:5000/fetch-url',
            headers={
                'Origin': 'http://localhost:3000',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type',
            },
            timeout=5,
        )
        print(f"OPTIONS Status Code: {response.status_code}")
        print(f"OPTIONS Headers: {dict(response.headers)}")
    except Exception as e:
        print(f"OPTIONS Error: {e}")


def test_fetch_url():
    # Test actual POST request
    try:
        response = requests.post(
            'http://localhost:5000/fetch-url',
            json={'url': 'https://example.com'},
            timeout=15,
        )
        print(f"POST Status Code: {response.status_code}")
        print(f"POST Response: {response.text[:200]}...")
    except Exception as e:
        print(f"POST Error: {e}")


if __name__ == "__main__":
    test_preflight()
    test_fetch_url()