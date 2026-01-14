/**
 * JSON to Java Converter Logic
 */

const jsonInput = document.getElementById("json-input");
const javaOutput = document.getElementById("java-output");
const classNameInput = document.getElementById("class-name");
const typeRecord = document.getElementById("type-record"); // Toggle Switch
const jsonHighlightLayer = document.getElementById("json-highlight-layer");

// Options (우측 상단 툴바)
const optGetSet = document.getElementById("opt-getset");
const optLombokGetSet = document.getElementById("opt-lombok-getset");
const optCtor = document.getElementById("opt-ctor");
const optLombokCtor = document.getElementById("opt-lombok-ctor");
const optJsonProp = document.getElementById("opt-jsonprop");

// JSON Scroll and Highlighting
window.syncJSONScroll = function (el) {
    if (jsonHighlightLayer) {
        jsonHighlightLayer.scrollTop = el.scrollTop;
        jsonHighlightLayer.scrollLeft = el.scrollLeft;
    }
};

window.handleJSONInput = function (el) {
    window.syncJSONScroll(el);
    updateJSONHighlight(el.value);
    handleInput();
};

function updateJSONHighlight(text) {
    if (!jsonHighlightLayer) return;

    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        // Strings (keys and values)
        .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, function (match) {
            return `<span class="json-string">${match}</span>`;
        })
        // Numbers
        .replace(/\b(\d+\.?\d*)\b/g, '<span class="json-number">$1</span>')
        // Booleans and null
        .replace(/\b(true|false|null)\b/g, '<span class="json-keyword">$1</span>')
        // Brackets and braces
        .replace(/([{}[\]])/g, '<span class="json-bracket">$1</span>')
        // Colons and commas
        .replace(/([,:])/g, '<span class="json-punctuation">$1</span>');

    // Add space at end to preserve trailing newline
    if (html[html.length - 1] === "\n") html += " ";

    jsonHighlightLayer.innerHTML = html;
}

// Handle Input
window.handleInput = function () {
    const inputVal = jsonInput.value;
    const tabsContainer = document.getElementById("class-tabs");

    if (!inputVal.trim()) {
        javaOutput.innerHTML = "";
        if (tabsContainer) tabsContainer.style.display = "none";
        return;
    }

    try {
        const json = JSON.parse(inputVal);
        const rootClassName = classNameInput.value || "Root";
        const isRecord = typeRecord ? typeRecord.checked : false;
        const optNested = document.getElementById("opt-nested");

        // 옵션 상태 읽기
        const options = {
            useGetSet: optGetSet ? optGetSet.checked : false,
            useLombokGetSet: (optLombokGetSet && !optLombokGetSet.disabled) ? optLombokGetSet.checked : false,
            useCtor: optCtor ? optCtor.checked : false,
            useLombokCtor: (optLombokCtor && !optLombokCtor.disabled) ? optLombokCtor.checked : false,
            useJsonProp: optJsonProp ? optJsonProp.checked : false,
            useNested: optNested ? optNested.checked : false
        };

        // 1. Java Code 생성 (structured format)
        const result = generateJavaCode(json, rootClassName, isRecord, options);

        // result = { imports: Set, classes: [{name, code}] }

        // 2. Nested mode or single class: show as one block
        if (options.useNested || result.classes.length === 1) {
            if (tabsContainer) tabsContainer.style.display = "none";

            let fullCode = "";
            if (result.imports.size > 0) {
                fullCode = Array.from(result.imports).sort().map(imp => `import ${imp};`).join("\n") + "\n\n";
            }
            fullCode += result.classes.map(c => c.code).join("\n\n");

            let highlightedCode = hljs.highlight(fullCode, { language: 'java' }).value;
            highlightedCode = highlightedCode.replace(/(@[A-Z]\w*)/g, '<span class="hljs-meta">$1</span>');
            highlightedCode = highlightedCode.replace(
                /(<span class="hljs-meta">@JsonProperty<\/span>\s*\()(&quot;.*?&quot;)(\))/g,
                function (match, prefix, content, suffix) {
                    if (content.includes('<span')) return match;
                    return `${prefix}<span class="hljs-string">${content}</span>${suffix}`;
                }
            );
            javaOutput.innerHTML = highlightedCode;

        }
        // 3. Tab mode: multiple classes
        else {
            if (tabsContainer) {
                tabsContainer.style.display = "flex";
                tabsContainer.innerHTML = "";

                result.classes.forEach((cls, index) => {
                    const btn = document.createElement("button");
                    btn.className = "tab-button" + (index === 0 ? " active" : "");
                    btn.textContent = cls.name;
                    btn.onclick = () => switchTab(result, index);
                    tabsContainer.appendChild(btn);
                });

                // Show first class by default
                switchTab(result, 0);
            }
        }

    } catch (e) {
        javaOutput.innerHTML = `<span style="color: #ff6b6b;">Invalid JSON: ${e.message}</span>`;
        if (tabsContainer) tabsContainer.style.display = "none";
    }
};

window.copyCode = function () {
    const code = javaOutput.innerText;
    navigator.clipboard.writeText(code).then(() => {
        alert("Code copied to clipboard!");
    });
};

window.prettifyJSON = function () {
    const inputVal = jsonInput.value;
    if (!inputVal.trim()) { return; }
    try {
        const json = JSON.parse(inputVal);
        jsonInput.value = JSON.stringify(json, null, 2);
        updateJSONHighlight(jsonInput.value);
        handleInput();
    } catch (e) {
        alert(`Invalid JSON: ${e.message}`);
    }
};

// Switch Tab (for multi-class mode)
function switchTab(result, index) {
    const tabsContainer = document.getElementById("class-tabs");
    if (!tabsContainer) return;

    // Update active tab
    const tabs = tabsContainer.querySelectorAll(".tab-button");
    tabs.forEach((tab, i) => {
        tab.classList.toggle("active", i === index);
    });

    // Show selected class
    const selectedClass = result.classes[index];
    let fullCode = "";
    if (result.imports.size > 0) {
        fullCode = Array.from(result.imports).sort().map(imp => `import ${imp};`).join("\n") + "\n\n";
    }
    fullCode += selectedClass.code;

    let highlightedCode = hljs.highlight(fullCode, { language: 'java' }).value;
    highlightedCode = highlightedCode.replace(/(@[A-Z]\w*)/g, '<span class="hljs-meta">$1</span>');
    highlightedCode = highlightedCode.replace(
        /(<span class="hljs-meta">@JsonProperty<\/span>\s*\()(&quot;.*?&quot;)(\))/g,
        function (match, prefix, content, suffix) {
            if (content.includes('<span')) return match;
            return `${prefix}<span class="hljs-string">${content}</span>${suffix}`;
        }
    );
    javaOutput.innerHTML = highlightedCode;
}

// Main Generation Function
function generateJavaCode(json, rootClassName, isRecord, options) {
    const classes = [];
    const usedImports = new Set();

    function parseObject(obj, className) {
        const fields = [];

        for (const [key, value] of Object.entries(obj)) {
            const fieldName = toCamelCase(key);
            const originalKey = key;
            let type = "Object";

            if (value === null) {
                type = "Object";
            } else if (typeof value === "string") {
                type = "String";
            } else if (typeof value === "number") {
                type = Number.isInteger(value) ? "int" : "double";
            } else if (typeof value === "boolean") {
                type = "boolean";
            } else if (Array.isArray(value)) {
                if (value.length > 0) {
                    const firstItem = value[0];
                    if (typeof firstItem === "object" && firstItem !== null) {
                        const subClassName = capitalize(fieldName) + "Item";
                        parseObject(firstItem, subClassName);
                        type = `List<${subClassName}>`;
                        usedImports.add("java.util.List");
                    } else if (typeof firstItem === "string") {
                        type = "List<String>";
                        usedImports.add("java.util.List");
                    } else if (typeof firstItem === "number") {
                        type = Number.isInteger(firstItem) ? "List<Integer>" : "List<Double>";
                        usedImports.add("java.util.List");
                    } else {
                        type = "List<Object>";
                        usedImports.add("java.util.List");
                    }
                } else {
                    type = "List<Object>";
                    usedImports.add("java.util.List");
                }
            } else if (typeof value === "object") {
                const subClassName = capitalize(fieldName);
                parseObject(value, subClassName);
                type = subClassName;
            }

            fields.push({ originalKey, fieldName, type });
        }

        let classCode = "";

        // 1. Record Type
        if (isRecord) {
            const fieldParams = fields.map(f => {
                let param = `${f.type} ${f.fieldName}`;
                if (options.useJsonProp) {
                    usedImports.add("com.fasterxml.jackson.annotation.JsonProperty");
                    return `@JsonProperty("${f.originalKey}") ${param}`;
                }
                return param;
            });

            if (fields.length > 0) {
                const joinedParams = fieldParams.join(",\n    ");
                classCode = `public record ${className}(\n    ${joinedParams}\n) {}`;
            } else {
                classCode = `public record ${className}() {}`;
            }

        }
        // 2. Class Type
        else {
            let classAnnotations = "";

            if (options.useGetSet && options.useLombokGetSet) {
                classAnnotations += "@Getter\n@Setter\n";
                usedImports.add("lombok.Getter");
                usedImports.add("lombok.Setter");
            }
            if (options.useCtor && options.useLombokCtor) {
                classAnnotations += "@AllArgsConstructor\n";
                usedImports.add("lombok.AllArgsConstructor");
            }

            classCode = `${classAnnotations}public class ${className} {\n`;

            fields.forEach(f => {
                if (options.useJsonProp) {
                    classCode += `    @JsonProperty("${f.originalKey}")\n`;
                    usedImports.add("com.fasterxml.jackson.annotation.JsonProperty");
                }
                classCode += `    private ${f.type} ${f.fieldName};\n`;
            });

            // Constructor (Manual)
            if (options.useCtor && !options.useLombokCtor && fields.length > 0) {
                classCode += `\n    public ${className}(${fields.map(f => `${f.type} ${f.fieldName}`).join(", ")}) {\n`;
                fields.forEach(f => {
                    classCode += `        this.${f.fieldName} = ${f.fieldName};\n`;
                });
                classCode += `    }\n`;
            }

            // Getters and Setters (Manual)
            if (options.useGetSet && !options.useLombokGetSet) {
                classCode += `\n    // Getters and Setters`;
                fields.forEach((f) => {
                    const capName = capitalize(f.fieldName);
                    classCode += `\n    public ${f.type} get${capName}() {\n        return ${f.fieldName};\n    }\n`;
                    classCode += `\n    public void set${capName}(${f.type} ${f.fieldName}) {\n        this.${f.fieldName} = ${f.fieldName};\n    }\n`;
                });
            }

            classCode += `}`;
        }

        classes.push({ name: className, code: classCode });
    }

    if (Array.isArray(json)) {
        if (json.length > 0 && typeof json[0] === 'object') {
            parseObject(json[0], rootClassName);
        }
    } else {
        parseObject(json, rootClassName);
    }

    // Nested mode: wrap all inner classes inside Root
    if (options.useNested && classes.length > 1) {
        const rootClass = classes[classes.length - 1]; // Root is last (reversed order)
        const innerClasses = classes.slice(0, -1); // All except Root

        // Indent inner classes
        const indentedInner = innerClasses.map(cls => {
            const lines = cls.code.split('\n');
            return lines.map(line => line ? '    ' + line : line).join('\n');
        }).join('\n\n');

        // Insert inner classes before the closing brace of Root
        let rootCode = rootClass.code;
        const lastBraceIndex = rootCode.lastIndexOf('}');
        rootCode = rootCode.substring(0, lastBraceIndex) +
            '\n    // Nested Classes\n' +
            indentedInner + '\n' +
            rootCode.substring(lastBraceIndex);

        return {
            imports: usedImports,
            classes: [{ name: rootClass.name, code: rootCode }]
        };
    }

    // Return structured data (reversed so Root comes first)
    return {
        imports: usedImports,
        classes: classes.reverse()
    };
}

function toCamelCase(str) {
    return str.toLowerCase().replace(/([-_][a-z])/g, (group) =>
        group.toUpperCase().replace('-', '').replace('_', '')
    );
}

function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

if (jsonInput) {
    updateJSONHighlight(jsonInput.value);
    handleInput();
}

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