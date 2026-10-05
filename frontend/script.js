const API_URL = "http://localhost:5000";

// ─── State ────────────────────────────────────────────────
let sessionStats = { total: 0, fake: 0, real: 0 };
let history = [];
let lastResult = null;
let currentTab = "text";

// ─── Tab Switching ────────────────────────────────────────
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    currentTab = btn.dataset.tab;
    document.getElementById(`tab-${currentTab}`).classList.add("active");
  });
});

// ─── Character Counter ────────────────────────────────────
document.getElementById("newsInput").addEventListener("input", function () {
  document.getElementById("charCount").textContent = this.value.length;
});

// ─── Theme Toggle ─────────────────────────────────────────
const themeBtn = document.getElementById("themeToggle");
let isDark = true;

themeBtn.addEventListener("click", () => {
  isDark = !isDark;
  document.body.classList.toggle("light-mode", !isDark);
  themeBtn.textContent = isDark ? "🌙" : "☀️";
});

// ─── Clear Input ──────────────────────────────────────────
function clearInput() {
  document.getElementById("newsInput").value = "";
  document.getElementById("charCount").textContent = "0";
}

// ─── Fetch URL ────────────────────────────────────────────
async function fetchURL() {
  const url = document.getElementById("urlInput").value.trim();
  if (!url) return showToast("Please enter a URL", "warn");

  const fetchBtn = document.querySelector(".fetch-btn");
  fetchBtn.textContent = "Fetching…";
  fetchBtn.disabled = true;

  try {
    // Backend handles the fetch — no CORS issues
    const res = await fetch(`${API_URL}/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch article.");

    const text = data.text;

    // Switch to text tab and populate
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    document.querySelector('[data-tab="text"]').classList.add("active");
    document.getElementById("tab-text").classList.add("active");
    currentTab = "text";

    document.getElementById("newsInput").value = text;
    document.getElementById("charCount").textContent = text.length;
    showToast("Article fetched! Click Analyze.", "success");

  } catch (err) {
    showToast("Failed to fetch URL: " + err.message, "error");
  } finally {
    fetchBtn.textContent = "Fetch";
    fetchBtn.disabled = false;
  }
}

// ─── Main Analyze ─────────────────────────────────────────
async function checkNews() {
  const text = document.getElementById("newsInput").value.trim();
  const btn = document.getElementById("analyzeBtn");

  if (!text) return showToast("Please enter some text first.", "warn");
  if (text.length > 10000) return showToast("Text too long. Max 10,000 characters.", "warn");

  // Loading state
  btn.disabled = true;
  btn.querySelector(".btn-text").style.display = "none";
  btn.querySelector(".btn-loader").style.display = "inline";

  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Server error");
    }

    const data = await response.json();
    lastResult = { ...data, text, timestamp: new Date() };

    renderVerdict(data);
    renderKeywords(data.keywords, data.prediction);
    renderHighlightedText(text, data.keywords);
    updateStats(data.prediction);
    addToHistory(text, data);

  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.querySelector(".btn-text").style.display = "inline";
    btn.querySelector(".btn-loader").style.display = "none";
  }
}

// ─── Render Verdict ───────────────────────────────────────
function renderVerdict(data) {
  const card = document.getElementById("verdictCard");
  card.querySelector(".verdict-placeholder").style.display = "none";

  const content = card.querySelector(".verdict-content");
  content.style.display = "block";

  const isReal = data.prediction === "REAL";
  const badge = document.getElementById("verdictBadge");
  badge.textContent = isReal ? "✅ REAL NEWS" : "❌ FAKE NEWS";
  badge.className = "verdict-badge " + (isReal ? "real" : "fake");

  // Animate confidence bar
  const fill = document.getElementById("confidenceFill");
  const confText = document.getElementById("confidenceText");
  fill.style.width = "0%";
  fill.className = "confidence-bar-fill " + (isReal ? "real" : "fake");

  confText.textContent = data.confidence + "%";
  setTimeout(() => { fill.style.width = data.confidence + "%"; }, 100);

  card.classList.remove("animate-in");
  void card.offsetWidth;
  card.classList.add("animate-in");
}

// ─── Render Keywords ──────────────────────────────────────
function renderKeywords(keywords, prediction) {
  if (!keywords || keywords.length === 0) return;

  const card = document.getElementById("keywordsCard");
  const grid = document.getElementById("keywordsGrid");
  card.style.display = "block";
  grid.innerHTML = "";

  const maxInfluence = Math.max(...keywords.map(k => Math.abs(k.influence)));

  keywords.forEach(kw => {
    const strength = Math.abs(kw.influence) / maxInfluence;
    const isPositive = kw.influence > 0; // positive coef → leans real
    const tag = document.createElement("div");
    tag.className = "keyword-tag " + (isPositive ? "kw-real" : "kw-fake");
    tag.style.opacity = 0.4 + strength * 0.6;
    tag.innerHTML = `<span class="kw-word">${kw.word}</span><span class="kw-bar" style="width:${Math.round(strength * 60)}px"></span>`;
    tag.title = `Influence score: ${kw.influence.toFixed(4)}`;
    grid.appendChild(tag);
  });

  card.classList.remove("animate-in");
  void card.offsetWidth;
  card.classList.add("animate-in");
}

// ─── Highlighted Text ─────────────────────────────────────
function renderHighlightedText(text, keywords) {
  if (!keywords || keywords.length === 0) return;

  const card = document.getElementById("highlightCard");
  const container = document.getElementById("highlightedText");
  card.style.display = "block";

  // Build a map of word → influence
  const wordMap = {};
  keywords.forEach(kw => { wordMap[kw.word.toLowerCase()] = kw.influence; });

  // Tokenize and highlight
  const words = text.split(/(\s+)/);
  const html = words.map(token => {
    const clean = token.toLowerCase().replace(/[^a-z]/g, "");
    if (wordMap[clean] !== undefined) {
      const cls = wordMap[clean] > 0 ? "hl-real" : "hl-fake";
      const intensity = Math.min(Math.abs(wordMap[clean]) * 5, 1);
      return `<mark class="${cls}" style="--intensity:${intensity}" title="${clean}: ${wordMap[clean].toFixed(3)}">${token}</mark>`;
    }
    return token;
  }).join("");

  container.innerHTML = html;

  card.classList.remove("animate-in");
  void card.offsetWidth;
  card.classList.add("animate-in");
}

// ─── Stats ────────────────────────────────────────────────
function updateStats(prediction) {
  sessionStats.total++;
  if (prediction === "FAKE") sessionStats.fake++;
  else sessionStats.real++;

  document.getElementById("totalChecks").textContent = sessionStats.total;
  document.getElementById("fakeCount").textContent = sessionStats.fake;
  document.getElementById("realCount").textContent = sessionStats.real;
}

// ─── History ──────────────────────────────────────────────
function addToHistory(text, data) {
  const entry = {
    snippet: text.slice(0, 60) + (text.length > 60 ? "…" : ""),
    prediction: data.prediction,
    confidence: data.confidence,
    time: new Date().toLocaleTimeString()
  };
  history.unshift(entry);
  if (history.length > 10) history.pop();
  renderHistory();
}

function renderHistory() {
  const card = document.getElementById("historyCard");
  const list = document.getElementById("historyList");
  card.style.display = "block";
  list.innerHTML = "";

  history.forEach(entry => {
    const item = document.createElement("div");
    item.className = "history-item " + (entry.prediction === "REAL" ? "h-real" : "h-fake");
    item.innerHTML = `
      <div class="h-snippet">${entry.snippet}</div>
      <div class="h-meta">
        <span class="h-badge ${entry.prediction === "REAL" ? "real" : "fake"}">${entry.prediction}</span>
        <span class="h-conf">${entry.confidence}%</span>
        <span class="h-time">${entry.time}</span>
      </div>
    `;
    list.appendChild(item);
  });
}

function clearHistory() {
  history = [];
  document.getElementById("historyCard").style.display = "none";
}

// ─── Copy Result ──────────────────────────────────────────
function copyResult() {
  if (!lastResult) return;
  const text = `TruthLens Result: ${lastResult.prediction} (${lastResult.confidence}% confidence)\nAnalyzed: ${lastResult.timestamp.toLocaleString()}`;
  navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard!", "success"));
}

// ─── Toast ────────────────────────────────────────────────
function showToast(msg, type = "info") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("toast-show"), 10);
  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}