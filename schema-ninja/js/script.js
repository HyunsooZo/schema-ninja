import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
});

const highlight = document.getElementById("highlight-layer");
const input = document.getElementById("sql-input");
let panZoomInstance = null;

// 스크롤 및 입력 핸들러
window.syncScroll = function (el) {
  highlight.scrollTop = el.scrollTop;
  highlight.scrollLeft = el.scrollLeft;
};
window.handleInput = function (el) {
  window.syncScroll(el);
  updateHighlight(el.value);
};

function updateHighlight(text) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /\b(CREATE|TABLE|PRIMARY|KEY|FOREIGN|REFERENCES|NOT|NULL|UNIQUE|CONSTRAINT|ALTER|DROP|SELECT|FROM|WHERE|INSERT|INTO|VALUES)\b/gi,
      '<span class="kw">$1</span>'
    )
    .replace(
      /\b(INT|VARCHAR|CHAR|TEXT|DATE|DATETIME|DECIMAL|FLOAT|BOOLEAN|NUMBER|BIGINT|TIMESTAMP)\b/gi,
      '<span class="dt">$1</span>'
    );
  if (html[html.length - 1] === "\n") html += " ";
  highlight.innerHTML = html;
}

window.visualize = async function () {
  const inputVal = input.value;
  const outputDiv = document.getElementById("mermaid-output");

  if (panZoomInstance) {
    panZoomInstance.destroy();
    panZoomInstance = null;
  }

  const mermaidSyntax = parseDDLtoMermaidV6(inputVal);
  if (!mermaidSyntax) {
    outputDiv.innerHTML =
      '<p class="error-msg">⚠️ CREATE TABLE 문을 찾을 수 없습니다.</p>';
    return;
  }

  outputDiv.innerHTML = `<div class="mermaid">${mermaidSyntax}</div>`;

  try {
    await mermaid.run({ nodes: document.querySelectorAll(".mermaid") });
    const svgElement = outputDiv.querySelector("svg");

    if (svgElement) {
      if (svgElement.parentElement) {
        svgElement.parentElement.style.width = "100%";
        svgElement.parentElement.style.height = "100%";
        svgElement.parentElement.style.overflow = "hidden";
      }

      svgElement.removeAttribute("height");
      svgElement.removeAttribute("width");
      svgElement.removeAttribute("style");

      svgElement.style.width = "100%";
      svgElement.style.height = "100%";
      svgElement.style.maxWidth = "none";
      svgElement.style.minWidth = "100%";

      setTimeout(() => {
        panZoomInstance = window.svgPanZoom(svgElement, {
          zoomEnabled: true,
          controlIconsEnabled: false,
          fit: true,
          center: true,
          minZoom: 0.1,
          maxZoom: 50,
          dblClickZoomEnabled: false,
        });
        panZoomInstance.resize();
        panZoomInstance.fit();
        panZoomInstance.center();
      }, 10);
    }
  } catch (error) {
    console.error(error);
    outputDiv.innerHTML = `<p class="error-msg">❌ Syntax Error!<br>${error.message}</p>`;
  }
};

// 🔥 [수정됨] 강력해진 PNG 내보내기 (에러 방지 적용)
window.exportPNG = function () {
  try {
    const svgElement = document.querySelector("#mermaid-output svg");
    if (!svgElement) {
      alert("먼저 ERD를 생성해주세요! 🥷");
      return;
    }

    // 1. Clone the SVG content to a temporary hidden container
    // This allows us to measure it WITHOUT any zoom/pan transforms interfering
    const clonedSvg = svgElement.cloneNode(true);

    // Remove svg-pan-zoom artifacts from the clone
    const viewportGroup = clonedSvg.querySelector(".svg-pan-zoom_viewport");
    if (viewportGroup) {
      viewportGroup.removeAttribute("transform");
      viewportGroup.removeAttribute("style");
    }

    // Reset attributes on the clone
    clonedSvg.removeAttribute("style");
    clonedSvg.removeAttribute("height");
    clonedSvg.removeAttribute("width");

    // Create a temporary container to measure the "natural" size
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.top = "-9999px";
    tempContainer.style.left = "-9999px";
    tempContainer.style.width = "auto";
    tempContainer.style.height = "auto";
    // Important: SVG needs to be visible to be measured, so we append to body but hidden
    tempContainer.appendChild(clonedSvg);
    document.body.appendChild(tempContainer);

    // Get the bounding box of the CONTENT
    // We select g.root which is usually where Mermaid puts the diagram
    // If not found, fallback to the SVG itself (though bbox might be 0 if empty)
    const innerContent = clonedSvg.querySelector("g.root") || clonedSvg;
    const bbox = innerContent.getBBox();

    // Clean up
    document.body.removeChild(tempContainer);

    // Add some padding
    const padding = 20;
    const x = bbox.x - padding;
    const y = bbox.y - padding;
    const width = bbox.width + padding * 2;
    const height = bbox.height + padding * 2;

    // Set viewBox to exactly matches the content
    clonedSvg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);

    // 3. Canvas setup
    const canvas = document.createElement("canvas");
    const scale = 3; // Ultra High resolution
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");

    // 4. Background
    const isDark = document.body.getAttribute("data-theme") === "dark";
    ctx.fillStyle = isDark ? "#1a1b26" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 5. Draw
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const img = new Image();
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = function () {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a");
      link.download = `schema_ninja_${new Date().getTime()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      URL.revokeObjectURL(url);
    };

    img.onerror = function () {
      console.error("Image load error");
      alert("이미지 변환 중 오류가 발생했습니다.");
    };

    img.src = url;

  } catch (e) {
    console.error(e);
    alert("내보내기 실패! " + e.message);
  }
};

document
  .getElementById("btn-zoom-in")
  .addEventListener("click", () => panZoomInstance?.zoomIn());
document
  .getElementById("btn-zoom-out")
  .addEventListener("click", () => panZoomInstance?.zoomOut());
document.getElementById("btn-reset").addEventListener("click", () => {
  if (panZoomInstance) {
    panZoomInstance.reset();
    panZoomInstance.fit();
    panZoomInstance.center();
  }
});

window.toggleTheme = function () {
  const body = document.body;
  const btn = document.querySelector(".theme-toggle");
  const isDark = body.getAttribute("data-theme") === "dark";
  if (panZoomInstance) {
    panZoomInstance.destroy();
    panZoomInstance = null;
  }

  if (isDark) {
    body.setAttribute("data-theme", "light");
    btn.textContent = "Dark Mode";
    mermaid.initialize({ theme: "default" });
  } else {
    body.setAttribute("data-theme", "dark");
    btn.textContent = "Light Mode";
    mermaid.initialize({ theme: "dark" });
  }
  window.visualize();
};

window.formatSQL = function () {
  const raw = input.value;
  let clean = raw.replace(/`/g, "");
  let formatted = "";
  let parenDepth = 0;
  clean = clean
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")");
  for (let i = 0; i < clean.length; i++) {
    let char = clean[i];
    if (char === "(") {
      parenDepth++;
      if (parenDepth === 1) {
        if (formatted.endsWith(" ")) formatted = formatted.slice(0, -1);
        formatted += " (\n    ";
      } else formatted += "(";
    } else if (char === ")") {
      parenDepth--;
      if (parenDepth === 0) formatted += "\n)";
      else formatted += ")";
    } else if (char === ",") {
      formatted += ",";
      if (parenDepth === 1) formatted += "\n    ";
      else formatted += " ";
    } else if (char === ";") {
      formatted += ";\n\n";
    } else {
      formatted += char;
    }
  }
  input.value = formatted.trim();
  updateHighlight(formatted.trim());
};

function parseDDLtoMermaidV6(ddl) {
  let mermaidText = "erDiagram\n";
  let relationships = [];

  // Extract Magic Comments (Virtual Relationships)
  // Format: -- mermaid: Users }|--|| Orders : "friend"
  const lines = ddl.split("\n");
  lines.forEach(line => {
    const match = line.match(/^\s*--\s*mermaid:\s*(.+)$/);
    if (match) {
      relationships.push(match[1].trim());
    }
  });

  let cleanDDL = ddl
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/`/g, "");
  const chunks = cleanDDL.split(/CREATE\s+TABLE\s+/i);
  if (chunks.length < 2) return null;
  for (let i = 1; i < chunks.length; i++) {
    let chunk = chunks[i].trim();
    if (!chunk) continue;
    let tableNameMatch = chunk.match(/^(\w+)/);
    if (!tableNameMatch) continue;
    let tableName = tableNameMatch[1];
    let firstParen = chunk.indexOf("(");
    let lastParen = chunk.lastIndexOf(")");
    if (firstParen === -1 || lastParen === -1) continue;
    let body = chunk.substring(firstParen + 1, lastParen);
    let tempBody = body.replace(/\(([^)]+)\)/g, (match) =>
      match.replace(/,/g, "###COMMA###")
    );
    let lines = tempBody.split(",");
    let columns = {};
    let pks = new Set();
    let fks = [];
    lines.forEach((line) => {
      line = line.trim().replace(/###COMMA###/g, ",");
      if (!line) return;
      let parts = line.split(/\s+/);
      let firstWord = parts[0].toUpperCase();
      if (firstWord === "PRIMARY" && parts[1] === "KEY") {
        let match = line.match(/\((.*?)\)/);
        if (match) match[1].split(",").forEach((k) => pks.add(k.trim()));
        return;
      }
      if (
        firstWord === "KEY" ||
        firstWord === "UNIQUE" ||
        firstWord === "INDEX"
      )
        return;
      if (firstWord === "CONSTRAINT" || firstWord === "FOREIGN") {
        let fkMatch = line.match(
          /FOREIGN\s+KEY\s*\((.*?)\)\s*REFERENCES\s+(\w+)/i
        );
        if (fkMatch) {
          let fkCol = fkMatch[1];
          let refTable = fkMatch[2];
          fks.push(fkCol);
          relationships.push(
            `${tableName} }o--|| ${refTable} : "FK: ${fkCol}"`
          );
        }
        return;
      }
      let colName = parts[0];
      let colType = parts[1];
      if (colName && colType) {
        columns[colName] = {
          type: colType,
          isNotNull: line.toUpperCase().includes("NOT NULL"),
        };
        if (line.toUpperCase().includes("PRIMARY KEY")) pks.add(colName);
      }
    });
    mermaidText += `  ${tableName} {\n`;
    Object.keys(columns).forEach((colName) => {
      let col = columns[colName];
      let safeType = col.type
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/__+/g, "_")
        .replace(/_$/, "");
      let keyStr = "";
      if (pks.has(colName)) keyStr = "PK";
      if (fks.includes(colName)) keyStr = keyStr ? "PK,FK" : "FK";
      mermaidText += `    ${safeType} ${colName} ${keyStr}\n`;
    });
    mermaidText += `  }\n`;
  }
  relationships.forEach((rel) => (mermaidText += `  ${rel}\n`));
  return mermaidText;
}

updateHighlight(input.value);
window.visualize();

// ------------------------------------------------------------
// Resizable Layout Implementation
// ------------------------------------------------------------
const resizer = document.getElementById("resizer");
const editorContainer = document.querySelector(".editor-container");

if (resizer && editorContainer) {
  let isResizing = false;

  resizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    resizer.classList.add("resizing");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none"; // Disable text selection while dragging
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    // Calculate new width
    // Limit min/max width for safety
    const newWidth = e.clientX;
    const minWidth = 200;
    const maxWidth = window.innerWidth - 200; // Keep at least 200px for preview

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

      // Trigger resize event so mermaid/panzoom can adjust if needed
      window.dispatchEvent(new Event('resize'));
    }
  });

  // Mobile Touch Support
  resizer.addEventListener("touchstart", (e) => {
    isResizing = true;
    resizer.classList.add("resizing");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault(); // Prevent scrolling check
  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    if (!isResizing) return;

    const newWidth = e.touches[0].clientX;
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
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.dispatchEvent(new Event('resize'));
    }
  });
}

// ------------------------------------------------------------
// Relationship Builder Helper
// ------------------------------------------------------------
window.populateTableSelects = function () {
  const sourceSel = document.getElementById("rel-source");
  const targetSel = document.getElementById("rel-target");
  const ddl = input.value;

  // Find all create tables
  const tables = [];
  const regex = /CREATE\s+TABLE\s+(\w+)/gi;
  let match;
  while ((match = regex.exec(ddl)) !== null) {
    tables.push(match[1]);
  }

  const options = tables.map(t => `<option value="${t}">${t}</option>`).join("");
  sourceSel.innerHTML = options;
  targetSel.innerHTML = options;
};

window.addRelationship = function () {
  const source = document.getElementById("rel-source").value;
  const target = document.getElementById("rel-target").value;
  const type = document.getElementById("rel-type").value;
  const label = document.getElementById("rel-label").value.trim();

  if (!source || !target) return;

  /* Mermaid often requires a label (colon) for relationships */
  const labelStr = label ? ` : "${label}"` : ' : ""';
  const magicComment = `\n-- mermaid: ${source} ${type} ${target}${labelStr}`;

  // Append to editor
  input.value += magicComment;
  updateHighlight(input.value);

  // Close modal
  document.getElementById('rel-modal').close();

  // Visualize
  window.visualize();

  // Scroll to bottom
  input.scrollTop = input.scrollHeight;
};
