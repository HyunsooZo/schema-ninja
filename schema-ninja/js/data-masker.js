/**
 * Data Masker Logic
 */

// Default sensitive field keywords
const DEFAULT_SENSITIVE_FIELDS = [
    'password', 'passwd', 'pwd', 'secret', 'token',
    'apiKey', 'apiSecret', 'accessToken', 'refreshToken',
    'credential', 'authorization', 'private', 'privateKey',
    'key', 'auth', 'bearer'
];

// State
const state = {
    sensitiveFields: [],
    maskChar: '*'
};

// DOM Elements
const elements = {
    input: null,
    output: null,
    inputHighlight: null,
    fieldsContainer: null,
    newFieldInput: null
};

// Masking patterns
const patterns = {
    // Email: user@example.com -> u***@example.com
    email: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,

    // Korean phone: 010-1234-5678 -> 010-****-5678
    phone: /(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g,

    // Card number: 1234-5678-9012-3456 -> 1234-****-****-3456
    card: /(\d{4})[-.\s]?(\d{4})[-.\s]?(\d{4})[-.\s]?(\d{4})/g,

    // Korean SSN: 900101-1234567 -> 900101-*******
    ssn: /(\d{6})[-.\s]?([1-4]\d{6})/g
};

// Initialize
function init() {
    elements.input = document.getElementById('masker-input');
    elements.output = document.getElementById('masker-output');
    elements.inputHighlight = document.getElementById('input-highlight-layer');
    elements.fieldsContainer = document.getElementById('fields-container');
    elements.newFieldInput = document.getElementById('new-field-input');

    // Load sensitive fields from localStorage or use defaults
    loadSensitiveFields();
    renderFieldTags();
    initResizer();

    // Add enter key listener for new field input
    elements.newFieldInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addField();
        }
    });
}

// Load sensitive fields from localStorage
function loadSensitiveFields() {
    const saved = localStorage.getItem('dataMasker_sensitiveFields');
    if (saved) {
        state.sensitiveFields = JSON.parse(saved);
    } else {
        state.sensitiveFields = [...DEFAULT_SENSITIVE_FIELDS];
    }
}

// Save sensitive fields to localStorage
function saveSensitiveFields() {
    localStorage.setItem('dataMasker_sensitiveFields', JSON.stringify(state.sensitiveFields));
}

// Render field tags
function renderFieldTags() {
    elements.fieldsContainer.innerHTML = state.sensitiveFields.map(field => `
        <span class="field-tag">
            ${escapeHtml(field)}
            <button class="remove-btn" onclick="removeField('${escapeHtml(field)}')">&times;</button>
        </span>
    `).join('');
}

// Add new field
window.addField = function () {
    const value = elements.newFieldInput.value.trim();
    if (value && !state.sensitiveFields.includes(value)) {
        state.sensitiveFields.push(value);
        saveSensitiveFields();
        renderFieldTags();
        elements.newFieldInput.value = '';
        handleMask();
    }
};

// Remove field
window.removeField = function (field) {
    state.sensitiveFields = state.sensitiveFields.filter(f => f !== field);
    saveSensitiveFields();
    renderFieldTags();
    handleMask();
};

// Handle input changes
window.handleInput = function (el) {
    syncScroll(el);
    updateHighlight(el.value);
    handleMask();
};

// Sync scroll
window.syncScroll = function (el) {
    elements.inputHighlight.scrollTop = el.scrollTop;
    elements.inputHighlight.scrollLeft = el.scrollLeft;
};

// Update highlight
function updateHighlight(text) {
    let html = escapeHtml(text);
    if (html[html.length - 1] === "\n") html += " ";
    elements.inputHighlight.innerHTML = html;
}

// Main masking function
window.handleMask = function () {
    const input = elements.input.value;
    if (!input.trim()) {
        elements.output.textContent = '';
        return;
    }

    // Get options
    const opts = {
        email: document.getElementById('opt-email').checked,
        phone: document.getElementById('opt-phone').checked,
        card: document.getElementById('opt-card').checked,
        ssn: document.getElementById('opt-ssn').checked,
        fields: document.getElementById('opt-fields').checked
    };
    state.maskChar = document.getElementById('mask-char').value;

    let result;

    // Try to parse as JSON
    try {
        const json = JSON.parse(input);
        result = JSON.stringify(maskObject(json, opts), null, 2);
    } catch (e) {
        // Plain text masking
        result = maskText(input, opts);
    }

    elements.output.textContent = result;
};

// Mask plain text
function maskText(text, opts) {
    let result = text;
    const m = state.maskChar;

    if (opts.email) {
        result = result.replace(patterns.email, (match, local, domain) => {
            const masked = local[0] + m.repeat(Math.min(local.length - 1, 5));
            return `${masked}@${domain}`;
        });
    }

    if (opts.phone) {
        result = result.replace(patterns.phone, (match, p1, p2, p3) => {
            return `${p1}-${m.repeat(4)}-${p3}`;
        });
    }

    if (opts.card) {
        result = result.replace(patterns.card, (match, g1, g2, g3, g4) => {
            return `${g1}-${m.repeat(4)}-${m.repeat(4)}-${g4}`;
        });
    }

    if (opts.ssn) {
        result = result.replace(patterns.ssn, (match, front, back) => {
            return `${front}-${m.repeat(7)}`;
        });
    }

    return result;
}

// Mask object (JSON)
function maskObject(obj, opts) {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => maskObject(item, opts));
    }

    if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            // Check if key is a sensitive field
            if (opts.fields && isSensitiveField(key)) {
                result[key] = maskSensitiveValue(value);
            } else if (typeof value === 'string') {
                result[key] = maskText(value, opts);
            } else if (typeof value === 'object') {
                result[key] = maskObject(value, opts);
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    return obj;
}

// Check if field name matches sensitive keywords
function isSensitiveField(fieldName) {
    const lower = fieldName.toLowerCase();
    return state.sensitiveFields.some(keyword =>
        lower.includes(keyword.toLowerCase())
    );
}

// Mask sensitive value completely
function maskSensitiveValue(value) {
    if (typeof value === 'string') {
        const m = state.maskChar;
        if (value.length <= 3) return m.repeat(value.length);
        return m.repeat(Math.min(value.length, 10));
    }
    return state.maskChar.repeat(5);
}

// Copy output
window.copyOutput = function () {
    const text = elements.output.textContent;
    if (!text) {
        alert('No output to copy');
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy: ' + err.message);
    });
};

// Theme toggle
window.toggleTheme = function () {
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

// Escape HTML
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Initialize resizer
function initResizer() {
    const resizer = document.getElementById("resizer");
    const editorContainer = document.querySelector(".editor-container");

    if (!resizer || !editorContainer) return;

    let isResizing = false;

    resizer.addEventListener("mousedown", () => {
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
