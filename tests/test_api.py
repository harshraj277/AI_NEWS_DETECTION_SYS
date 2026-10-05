"""Manual smoke test: POST a sample headline to the running API.

Usage: python tests/test_api.py   (with Api.py already serving on :5000)
"""
import requests


def main():
    try:
        response = requests.post(
            'http://localhost:5000/predict',
            json={'text': 'This is a test news article'},
            timeout=5,
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()