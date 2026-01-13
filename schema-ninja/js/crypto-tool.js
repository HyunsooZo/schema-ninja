// State management
const state = {
  algorithm: 'base64',
  key: '',
  iv: '',
  inputText: 'Hello World!',
  outputText: 'SGVsbG8gV29ybGQh',
  outputFormat: 'Base64'
};

// DOM element references
const elements = {
  algorithmSelect: null,
  keyInput: null,
  ivInput: null,
  cryptoInput: null,
  cryptoOutput: null,
  encryptBtn: null,
  decryptBtn: null,
  inputHighlight: null,
  formatLabel: null
};

// Algorithm implementations
const algorithms = {
  base64: {
    encrypt: (text) => {
      try {
        return btoa(unescape(encodeURIComponent(text)));
      } catch (e) {
        throw new Error('Failed to encode as Base64');
      }
    },
    decrypt: (text) => {
      try {
        return decodeURIComponent(escape(atob(text)));
      } catch (e) {
        throw new Error('Invalid Base64 string');
      }
    },
    needsKey: false,
    oneWay: false,
    format: 'Base64'
  },

  aes: {
    encrypt: async (text, key, iv) => {
      if (!key || key.length !== 32) {
        throw new Error('Key must be exactly 32 characters');
      }
      if (!iv || iv.length !== 16) {
        throw new Error('IV must be exactly 16 characters');
      }

      const keyBuffer = new TextEncoder().encode(key);
      const ivBuffer = new TextEncoder().encode(iv);
      const textBuffer = new TextEncoder().encode(text);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-CBC' },
        false,
        ['encrypt']
      );

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv: ivBuffer },
        cryptoKey,
        textBuffer
      );

      return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    },
    decrypt: async (text, key, iv) => {
      if (!key || key.length !== 32) {
        throw new Error('Key must be exactly 32 characters');
      }
      if (!iv || iv.length !== 16) {
        throw new Error('IV must be exactly 16 characters');
      }

      const keyBuffer = new TextEncoder().encode(key);
      const ivBuffer = new TextEncoder().encode(iv);

      let encryptedBuffer;
      try {
        const binaryString = atob(text);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        encryptedBuffer = bytes.buffer;
      } catch (e) {
        throw new Error('Invalid Base64 encrypted text');
      }

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
      );

      try {
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-CBC', iv: ivBuffer },
          cryptoKey,
          encryptedBuffer
        );

        return new TextDecoder().decode(decrypted);
      } catch (e) {
        throw new Error('Decryption failed. Check your key, IV, and encrypted text.');
      }
    },
    needsKey: true,
    oneWay: false,
    format: 'Base64'
  },

  md5: {
    encrypt: (text) => {
      if (typeof CryptoJS === 'undefined') {
        throw new Error('CryptoJS library not loaded');
      }
      return CryptoJS.MD5(text).toString();
    },
    needsKey: false,
    oneWay: true,
    format: 'Hex'
  },

  sha256: {
    encrypt: async (text) => {
      const buffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    needsKey: false,
    oneWay: true,
    format: 'Hex'
  },

  sha512: {
    encrypt: async (text) => {
      const buffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-512', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    needsKey: false,
    oneWay: true,
    format: 'Hex'
  },

  url: {
    encrypt: (text) => {
      return encodeURIComponent(text);
    },
    decrypt: (text) => {
      try {
        return decodeURIComponent(text);
      } catch (e) {
        throw new Error('Invalid URL encoded string');
      }
    },
    needsKey: false,
    oneWay: false,
    format: 'URL'
  },

  hex: {
    encrypt: (text) => {
      return Array.from(new TextEncoder().encode(text))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    },
    decrypt: (text) => {
      if (text.length % 2 !== 0) {
        throw new Error('Invalid hex string: odd length');
      }
      if (!/^[0-9a-fA-F]*$/.test(text)) {
        throw new Error('Invalid hex string: contains non-hex characters');
      }
      try {
        const bytes = text.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
        return new TextDecoder().decode(new Uint8Array(bytes));
      } catch (e) {
        throw new Error('Failed to decode hex string');
      }
    },
    needsKey: false,
    oneWay: false,
    format: 'Hex'
  },

  rot13: {
    encrypt: (text) => {
      return text.replace(/[a-zA-Z]/g, (char) => {
        const base = char <= 'Z' ? 65 : 97;
        return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
      });
    },
    decrypt: (text) => {
      // ROT13 is its own inverse
      return algorithms.rot13.encrypt(text);
    },
    needsKey: false,
    oneWay: false,
    format: 'Text'
  }
};

// Initialize on load
function init() {
  // Cache DOM elements
  elements.algorithmSelect = document.getElementById('algorithm-select');
  elements.keyInput = document.getElementById('crypto-key');
  elements.ivInput = document.getElementById('crypto-iv');
  elements.cryptoInput = document.getElementById('crypto-input');
  elements.cryptoOutput = document.getElementById('crypto-output');
  elements.encryptBtn = document.getElementById('encrypt-btn');
  elements.decryptBtn = document.getElementById('decrypt-btn');
  elements.inputHighlight = document.getElementById('input-highlight-layer');
  elements.formatLabel = document.getElementById('output-format-label');

  // Setup initial state
  state.inputText = elements.cryptoInput.value;
  updateHighlight(state.inputText);

  // Initialize resizer
  initResizer();
}

// Handle algorithm change
window.handleAlgorithmChange = function() {
  const algorithm = elements.algorithmSelect.value;
  const algo = algorithms[algorithm];

  // Update state
  state.algorithm = algorithm;
  state.outputFormat = algo.format;

  // Show/hide key inputs for AES
  if (algo.needsKey) {
    elements.keyInput.style.display = 'block';
    elements.ivInput.style.display = 'block';
  } else {
    elements.keyInput.style.display = 'none';
    elements.ivInput.style.display = 'none';
  }

  // Disable decrypt button for one-way algorithms
  if (algo.oneWay) {
    elements.decryptBtn.disabled = true;
    elements.decryptBtn.style.opacity = '0.5';
    elements.decryptBtn.style.cursor = 'not-allowed';
  } else {
    elements.decryptBtn.disabled = false;
    elements.decryptBtn.style.opacity = '1';
    elements.decryptBtn.style.cursor = 'pointer';
  }

  // Update format label
  elements.formatLabel.textContent = `Output: ${algo.format}`;

  // Clear output
  elements.cryptoOutput.textContent = '';
  elements.cryptoOutput.style.color = 'var(--text-color)';
};

// Handle input changes
window.handleInput = function(el) {
  if (el) {
    window.syncScroll(el);
    updateHighlight(el.value);
    state.inputText = el.value;
  }
};

// Sync scroll between textarea and highlight layer
window.syncScroll = function(el) {
  elements.inputHighlight.scrollTop = el.scrollTop;
  elements.inputHighlight.scrollLeft = el.scrollLeft;
};

// Update syntax highlighting
function updateHighlight(text) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Add trailing space to preserve newlines
  if (html[html.length - 1] === "\n") html += " ";

  elements.inputHighlight.innerHTML = html;
}

// Encrypt text
window.encryptText = async function() {
  const algorithm = algorithms[state.algorithm];
  const input = state.inputText.trim();

  if (!input) {
    displayError('Input text is empty');
    return;
  }

  try {
    let result;
    if (algorithm.needsKey) {
      state.key = elements.keyInput.value;
      state.iv = elements.ivInput.value;
      result = await algorithm.encrypt(input, state.key, state.iv);
    } else {
      result = await algorithm.encrypt(input);
    }

    displaySuccess(result);
    state.outputText = result;
  } catch (error) {
    displayError(error.message);
  }
};

// Decrypt text
window.decryptText = async function() {
  const algorithm = algorithms[state.algorithm];

  // Check if algorithm supports decryption
  if (algorithm.oneWay) {
    displayError('This algorithm does not support decryption (one-way hash)');
    return;
  }

  const input = state.inputText.trim();

  if (!input) {
    displayError('Input text is empty');
    return;
  }

  try {
    let result;
    if (algorithm.needsKey) {
      state.key = elements.keyInput.value;
      state.iv = elements.ivInput.value;
      result = await algorithm.decrypt(input, state.key, state.iv);
    } else {
      result = await algorithm.decrypt(input);
    }

    displaySuccess(result);
    state.outputText = result;
  } catch (error) {
    displayError(error.message);
  }
};

// Copy output to clipboard
window.copyOutput = function() {
  const text = elements.cryptoOutput.textContent;

  if (!text || text.startsWith('❌ Error:')) {
    alert('No valid output to copy');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    alert('Output copied to clipboard!');
  }).catch(err => {
    alert('Failed to copy: ' + err.message);
  });
};

// Theme toggle
window.toggleTheme = function() {
  const body = document.body;
  const btn = document.querySelector(".theme-toggle");
  const isDark = body.getAttribute("data-theme") === "dark";

  if (isDark) {
    body.setAttribute("data-theme", "light");
    btn.textContent = "Dark Mode";
  } else {
    body.setAttribute("data-theme", "dark");
    btn.textContent = "Light Mode";
  }
};

// Display error message
function displayError(message) {
  elements.cryptoOutput.textContent = `❌ Error: ${message}`;
  elements.cryptoOutput.style.color = '#ff6b6b';
}

// Display success result
function displaySuccess(result) {
  elements.cryptoOutput.textContent = result;
  elements.cryptoOutput.style.color = 'var(--text-color)';
}

// Initialize resizer (copied from erd-converter.js pattern)
function initResizer() {
  const resizer = document.getElementById("resizer");
  const editorContainer = document.querySelector(".editor-container");

  if (!resizer || !editorContainer) return;

  let isResizing = false;

  // Mouse events
  resizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    resizer.classList.add("resizing");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    const minWidth = 200;
    const maxWidth = window.innerWidth - 200;
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      editorContainer.style.width = `${newWidth}px`;
    }
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove("resizing");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.dispatchEvent(new Event('resize'));
    }
  });

  // Touch events (mobile)
  resizer.addEventListener("touchstart", (e) => {
    isResizing = true;
    resizer.classList.add("resizing");
    e.preventDefault();
  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    if (!isResizing) return;
    const touch = e.touches[0];
    const newWidth = touch.clientX;
    const minWidth = 200;
    const maxWidth = window.innerWidth - 200;
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      editorContainer.style.width = `${newWidth}px`;
    }
  }, { passive: true });

  document.addEventListener("touchend", () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove("resizing");
      window.dispatchEvent(new Event('resize'));
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
