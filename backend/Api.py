from flask import Flask, request, jsonify
import pickle
import re
import os
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from flask_cors import CORS
from nltk.corpus import stopwords
from langdetect import detect, LangDetectException

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)

# Paths resolve relative to this file, so the app runs from any working directory
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "model.pkl"
VECTORIZER_PATH = BASE_DIR / "models" / "vectorizer.pkl"

model = pickle.load(open(MODEL_PATH, "rb"))
vectorizer = pickle.load(open(VECTORIZER_PATH, "rb"))

stop_words = set(stopwords.words('english'))

def preprocess(text):
    text = re.sub('[^a-zA-Z]', ' ', text)
    text = text.lower()
    words = [w for w in text.split() if w not in stop_words]
    return ' '.join(words)

def get_top_keywords(text, top_n=10):
    """Extract top influential keywords using LR coefficients + TF-IDF scores."""
    processed = preprocess(text)
    vector = vectorizer.transform([processed])
    feature_names = vectorizer.get_feature_names_out()
    coefficients = model.coef_[0]  # LR coefficients per feature

    # Get non-zero TF-IDF indices for this input
    nonzero_indices = vector.nonzero()[1]

    word_scores = []
    for idx in nonzero_indices:
        word = feature_names[idx]
        tfidf_score = vector[0, idx]
        coef = coefficients[idx]
        influence = float(tfidf_score * coef)
        word_scores.append({
            "word": word,
            "influence": influence
        })

    # Sort by absolute influence
    word_scores.sort(key=lambda x: abs(x["influence"]), reverse=True)
    return word_scores[:top_n]

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()

    if not data or 'text' not in data:
        return jsonify({"error": "Missing 'text' field"}), 400

    text = data['text'].strip()

    if not text:
        return jsonify({"error": "Text cannot be empty"}), 400

    if len(text) > 10000:
        return jsonify({"error": "Text too long. Max 10,000 characters."}), 400

    # Language detection
    try:
        lang = detect(text)
        if lang != 'en':
            return jsonify({"error": "Only English text is supported. Detected language: " + lang}), 400
    except LangDetectException:
        pass  # If detection fails, proceed anyway

    processed = preprocess(text)
    vector = vectorizer.transform([processed])
    result = model.predict(vector)[0]

    proba = model.predict_proba(vector)[0]
    confidence = round(float(max(proba)) * 100, 1)

    keywords = get_top_keywords(text)

    return jsonify({
        "prediction": "REAL" if result == 1 else "FAKE",
        "confidence": confidence,
        "keywords": keywords
    })

@app.route('/fetch-url', methods=['POST'])
def fetch_url():
    data = request.get_json()

    if not data or 'url' not in data:
        return jsonify({"error": "Missing 'url' field"}), 400

    url = data['url'].strip()

    if not url.startswith("http://") and not url.startswith("https://"):
        return jsonify({"error": "Invalid URL. Must start with http:// or https://"}), 400

    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Remove script / style / nav / footer noise
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
            tag.decompose()

        # Prefer <article> or <main>, fallback to all <p> tags
        article = soup.find("article") or soup.find("main")
        if article:
            paragraphs = article.find_all("p")
        else:
            paragraphs = soup.find_all("p")

        text = " ".join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 40)

        if not text:
            return jsonify({"error": "Could not extract readable article text from this URL."}), 422

        return jsonify({"text": text[:10000]})

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out. The site took too long to respond."}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Could not connect to the URL. Check if the link is valid."}), 502
    except requests.exceptions.HTTPError as e:
        return jsonify({"error": f"HTTP error: {e.response.status_code}"}), 502
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    app.run(debug=debug_mode)