/**
 * ID Generator Logic
 */

const idInput = document.getElementById("id-input");
const idOutput = document.getElementById("id-output");
const idTypeSelect = document.getElementById("id-type-select");
const quantitySelect = document.getElementById("quantity-select");
const outputLabel = document.getElementById("output-format-label");

// ============================================
// ID Generation Implementations
// ============================================

// UUID v4 implementation
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ULID implementation (Crockford's Base32)
const ULID_ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function generateULID() {
    const now = Date.now();
    let str = '';
    // Timestamp (10 chars)
    let time = now;
    for (let i = 9; i >= 0; i--) {
        str = ULID_ENCODING[time % 32] + str;
        time = Math.floor(time / 32);
    }
    // Randomness (16 chars)
    for (let i = 0; i < 16; i++) {
        str += ULID_ENCODING[Math.floor(Math.random() * 32)];
    }
    return str;
}

// TSID implementation (timestamp + random, base32)
function generateTSID() {
    const now = Date.now();
    const random = Math.floor(Math.random() * 0xFFFFFF);
    const combined = BigInt(now) * BigInt(0x1000000) + BigInt(random);
    return combined.toString(36).toUpperCase().padStart(13, '0');
}

// CUID2 implementation (collision-resistant)
let cuid2Counter = Math.floor(Math.random() * 0xFFFFFF);
function generateCUID2() {
    const timestamp = Date.now().toString(36);
    const counter = (cuid2Counter++).toString(36).padStart(4, '0');
    const fingerprint = Math.floor(Math.random() * 0xFFFFFFFF).toString(36);
    const random = Array.from({ length: 12 }, () =>
        Math.floor(Math.random() * 36).toString(36)
    ).join('');
    return (timestamp + counter + fingerprint + random).slice(0, 24);
}

// KSUID implementation (K-Sortable Unique ID)
const KSUID_EPOCH = 1400000000; // Custom epoch (May 2014)
const KSUID_BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function generateKSUID() {
    const timestamp = Math.floor(Date.now() / 1000) - KSUID_EPOCH;
    const payload = new Uint8Array(16);
    crypto.getRandomValues(payload);

    // Combine timestamp (4 bytes) + payload (16 bytes) = 20 bytes
    const bytes = new Uint8Array(20);
    bytes[0] = (timestamp >> 24) & 0xFF;
    bytes[1] = (timestamp >> 16) & 0xFF;
    bytes[2] = (timestamp >> 8) & 0xFF;
    bytes[3] = timestamp & 0xFF;
    bytes.set(payload, 4);

    // Convert to base62
    let num = BigInt(0);
    for (let b of bytes) {
        num = num * BigInt(256) + BigInt(b);
    }
    let result = '';
    while (num > 0) {
        result = KSUID_BASE62[Number(num % BigInt(62))] + result;
        num = num / BigInt(62);
    }
    return result.padStart(27, '0');
}

// NanoID implementation
const NANOID_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
function generateNanoID(size = 21) {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    let id = '';
    for (let i = 0; i < size; i++) {
        id += NANOID_ALPHABET[bytes[i] & 63];
    }
    return id;
}

// ============================================
// Main Generate Function
// ============================================

// Generate IDs based on selected type and quantity
window.generateIDs = function () {
    const idType = idTypeSelect.value;
    const quantity = parseInt(quantitySelect.value);
    const ids = [];

    try {
        for (let i = 0; i < quantity; i++) {
            let id;
            switch (idType) {
                case 'uuid':
                    id = generateUUID();
                    break;
                case 'ulid':
                    id = generateULID();
                    break;
                case 'tsid':
                    id = generateTSID();
                    break;
                case 'cuid2':
                    id = generateCUID2();
                    break;
                case 'ksuid':
                    id = generateKSUID();
                    break;
                case 'nanoid':
                    id = generateNanoID();
                    break;
                default:
                    id = 'Unknown type';
            }
            ids.push(id);
        }

        const output = ids.join('\n');
        idOutput.textContent = output;
        idInput.value = output;

        // Update label
        const typeNames = {
            'uuid': 'UUID',
            'ulid': 'ULID',
            'tsid': 'TSID',
            'cuid2': 'CUID2',
            'ksuid': 'KSUID',
            'nanoid': 'Nano ID'
        };
        outputLabel.textContent = `${typeNames[idType]} (${quantity})`;

    } catch (error) {
        console.error('Error generating IDs:', error);
        idOutput.textContent = `Error: ${error.message}`;
    }
};

// Copy output to clipboard
window.copyOutput = function () {
    const text = idOutput.textContent;
    if (!text || text === '') {
        alert('No IDs to copy. Generate some first!');
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        alert('IDs copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
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

// Resizer Logic
const resizer = document.getElementById("resizer");
const editorContainer = document.querySelector(".editor-container");
if (resizer && editorContainer) {
    let isResizing = false;
    resizer.addEventListener("mousedown", (e) => { isResizing = true; resizer.classList.add("resizing"); document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; });
    document.addEventListener("mousemove", (e) => { if (!isResizing) return; const newWidth = e.clientX; const minWidth = 200; const maxWidth = window.innerWidth - 200; if (newWidth >= minWidth && newWidth <= maxWidth) { editorContainer.style.width = `${newWidth}px`; } });
    document.addEventListener("mouseup", () => { if (isResizing) { isResizing = false; resizer.classList.remove("resizing"); document.body.style.cursor = ""; document.body.style.userSelect = ""; window.dispatchEvent(new Event('resize')); } });
    resizer.addEventListener("touchstart", (e) => { isResizing = true; resizer.classList.add("resizing"); document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; e.preventDefault(); }, { passive: false });
    document.addEventListener("touchmove", (e) => { if (!isResizing) return; const newWidth = e.touches[0].clientX; const minWidth = 200; const maxWidth = window.innerWidth - 200; if (newWidth >= minWidth && newWidth <= maxWidth) { editorContainer.style.width = `${newWidth}px`; } }, { passive: true });
    document.addEventListener("touchend", () => { if (isResizing) { isResizing = false; resizer.classList.remove("resizing"); document.body.style.cursor = ""; document.body.style.userSelect = ""; window.dispatchEvent(new Event('resize')); } });
}

// Generate initial IDs on page load
generateIDs();
