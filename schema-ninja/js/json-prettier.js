// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  lastValidJSON: null,   // Last successfully parsed JSON object
  isMinified: false,     // Whether output is currently minified
  autoFormat: true,      // Auto-format on input
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────

let elements = {};

function init() {
  elements = {
    input:          document.getElementById('json-input'),
    highlightLayer: document.getElementById('input-highlight-layer'),
    output:         document.getElementById('json-output'),
    errorBanner:    document.getElementById('error-banner'),
    statChips:      document.getElementById('stat-chips'),
    indentSelect:   document.getElementById('indent-select'),
    sortKeys:       document.getElementById('sort-keys'),
    autoFormat:     document.getElementById('auto-format'),
    resizer:        document.getElementById('resizer'),
  };

  initResizer();
  applyHljsTheme();

  // Populate example JSON on first load
  const example = `{
  "name": "Jane Doe",
  "age": 28,
  "active": true,
  "role": "developer",
  "address": {
    "city": "Seoul",
    "zip": "04524"
  },
  "tags": ["ninja", "dev", "tools"],
  "score": 9.8,
  "meta": null
}`;
  elements.input.value = example;
  handleInput(elements.input);
}

// ─── Core: Formatting ─────────────────────────────────────────────────────────

function getIndent() {
  const v = elements.indentSelect.value;
  if (v === 'tab') return '\t';
  return parseInt(v, 10);
}

/**
 * Sort object keys recursively (arrays preserved as-is).
 */
function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    Object.keys(value).sort().forEach(k => {
      sorted[k] = sortObjectKeys(value[k]);
    });
    return sorted;
  }
  return value;
}

/**
 * Format JSON text with options.
 * Returns { formatted: string } or throws on parse error.
 */
function formatJSON(text, { indent, sort }) {
  const parsed = JSON.parse(text);             // throws SyntaxError on invalid
  const target = sort ? sortObjectKeys(parsed) : parsed;
  return JSON.stringify(target, null, indent);
}

/**
 * Minify JSON text.
 */
function minifyJSON(text) {
  const parsed = JSON.parse(text);
  return JSON.stringify(parsed);
}

// ─── Core: Stats ──────────────────────────────────────────────────────────────

function getJSONStats(parsed, rawFormatted) {
  return {
    lines:  rawFormatted.split('\n').length,
    size:   formatBytes(new TextEncoder().encode(rawFormatted).length),
    keys:   countKeys(parsed),
    depth:  getDepth(parsed),
  };
}

function countKeys(value) {
  if (Array.isArray(value)) {
    return value.reduce((sum, v) => sum + countKeys(v), 0);
  }
  if (value !== null && typeof value === 'object') {
    const own = Object.keys(value).length;
    return own + Object.values(value).reduce((sum, v) => sum + countKeys(v), 0);
  }
  return 0;
}

function getDepth(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return 1;
    return 1 + Math.max(...value.map(getDepth));
  }
  if (value !== null && typeof value === 'object') {
    const vals = Object.values(value);
    if (vals.length === 0) return 1;
    return 1 + Math.max(...vals.map(getDepth));
  }
  return 0;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  return (bytes / 1024).toFixed(1) + ' KB';
}

// ─── UI: Error / Stats ────────────────────────────────────────────────────────

function showError(msg) {
  elements.errorBanner.textContent = msg;
  elements.errorBanner.classList.add('visible');
  elements.statChips.innerHTML = '<span class="stat-chip" style="color:#ff6b6b;">Invalid JSON</span>';
  elements.output.textContent = '';
  state.lastValidJSON = null;
}

function clearError() {
  elements.errorBanner.classList.remove('visible');
  elements.errorBanner.textContent = '';
}

function renderStats(stats) {
  elements.statChips.innerHTML = `
    <span class="stat-chip">Lines <span>${stats.lines}</span></span>
    <span class="stat-chip">Keys <span>${stats.keys}</span></span>
    <span class="stat-chip">Depth <span>${stats.depth}</span></span>
    <span class="stat-chip">Size <span>${stats.size}</span></span>
  `;
}

// ─── UI: Syntax Highlighting (Input Layer) ────────────────────────────────────

function updateInputHighlight(text) {
  if (!text) {
    elements.highlightLayer.innerHTML = '';
    return;
  }
  // Lightweight JSON colorization for the input overlay
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const highlighted = escaped.replace(
    /("(?:\\.|[^"\\])*")\s*(:)?|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, str, colon, keyword, number) => {
      if (str && colon) return `<span class="json-key">${str}</span>${colon}`;
      if (str)          return `<span class="json-string">${str}</span>`;
      if (keyword)      return `<span class="json-keyword">${keyword}</span>`;
      if (number)       return `<span class="json-number">${number}</span>`;
      return match;
    }
  );

  elements.highlightLayer.innerHTML = highlighted;
}

// ─── UI: Output Rendering ────────────────────────────────────────────────────

function renderOutput(text) {
  elements.output.textContent = text;
  if (window.hljs) {
    hljs.highlightElement(elements.output);
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

window.handleInput = function (el) {
  syncScroll(el);
  updateInputHighlight(el.value);

  if (state.autoFormat) {
    handleFormat();
  } else {
    // Just validate silently
    const text = el.value.trim();
    if (!text) {
      clearError();
      state.lastValidJSON = null;
      elements.statChips.innerHTML = '<span class="stat-chip">Ready</span>';
      return;
    }
    try {
      state.lastValidJSON = JSON.parse(text);
      clearError();
    } catch (e) {
      showError('Parse Error: ' + e.message);
    }
  }
};

window.syncScroll = function (el) {
  elements.highlightLayer.scrollTop = el.scrollTop;
  elements.highlightLayer.scrollLeft = el.scrollLeft;
};

window.handleFormat = function () {
  const text = elements.input.value.trim();
  state.isMinified = false;

  if (!text) {
    clearError();
    elements.output.textContent = '';
    elements.statChips.innerHTML = '<span class="stat-chip">Ready</span>';
    state.lastValidJSON = null;
    return;
  }

  try {
    const indent = getIndent();
    const sort   = elements.sortKeys.checked;
    const formatted = formatJSON(text, { indent, sort });

    state.lastValidJSON = JSON.parse(text);
    clearError();

    renderOutput(formatted);
    renderStats(getJSONStats(state.lastValidJSON, formatted));
  } catch (e) {
    showError('Parse Error: ' + e.message);
  }
};

window.handleMinify = function () {
  const text = elements.input.value.trim();
  if (!text) return;

  try {
    const minified = minifyJSON(text);
    state.isMinified = true;
    clearError();
    renderOutput(minified);
    renderStats(getJSONStats(JSON.parse(text), minified));
  } catch (e) {
    showError('Parse Error: ' + e.message);
  }
};

window.toggleAutoFormat = function () {
  state.autoFormat = elements.autoFormat.checked;
  if (state.autoFormat) {
    handleFormat();
  }
};

window.copyOutput = function () {
  const text = elements.output.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.icon-btn[onclick="copyOutput()"]');
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline></svg>`;
    setTimeout(() => { btn.innerHTML = original; }, 1500);
  });
};

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyHljsTheme() {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  const link = document.getElementById('hljs-theme');
  if (!link) return;
  link.href = isDark
    ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
    : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
}

window.toggleTheme = function () {
  const body = document.body;
  const btn  = document.querySelector('.theme-toggle');
  const isDark = body.getAttribute('data-theme') === 'dark';

  body.setAttribute('data-theme', isDark ? 'light' : 'dark');
  btn.textContent = isDark ? 'Dark Mode' : 'Light Mode';

  applyHljsTheme();

  // Re-render output to pick up new theme
  if (elements.output && elements.output.textContent) {
    const text = elements.output.textContent;
    elements.output.removeAttribute('data-highlighted');
    elements.output.textContent = text;
    if (window.hljs) hljs.highlightElement(elements.output);
  }
};

// ─── Resizer ──────────────────────────────────────────────────────────────────

function initResizer() {
  const resizer        = elements.resizer;
  const editorContainer = document.querySelector('.editor-container');

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX     = e.clientX;
    startWidth = editorContainer.offsetWidth;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta    = e.clientX - startX;
    const newWidth = Math.min(Math.max(startWidth + delta, 200), window.innerWidth - 200);
    editorContainer.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizer.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.dispatchEvent(new Event('resize'));
  });

  // Touch support
  resizer.addEventListener('touchstart', (e) => {
    isResizing = true;
    startX     = e.touches[0].clientX;
    startWidth = editorContainer.offsetWidth;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!isResizing) return;
    const delta    = e.touches[0].clientX - startX;
    const newWidth = Math.min(Math.max(startWidth + delta, 200), window.innerWidth - 200);
    editorContainer.style.width = newWidth + 'px';
  }, { passive: true });

  document.addEventListener('touchend', () => {
    isResizing = false;
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
