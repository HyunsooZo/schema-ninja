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

    // 1. 복제 및 정리
    const clonedSvg = svgElement.cloneNode(true);
    const viewportGroup = clonedSvg.querySelector(".svg-pan-zoom_viewport");
    if (viewportGroup) {
      viewportGroup.removeAttribute("transform");
      viewportGroup.removeAttribute("style");
    }
    clonedSvg.removeAttribute("style");
    clonedSvg.setAttribute("width", "100%");
    clonedSvg.setAttribute("height", "100%");

    // 2. 크기 계산 (안전장치 추가)
    // viewBox가 없으면 실제 크기(getBoundingClientRect)를 사용
    let width, height;
    if (svgElement.hasAttribute("viewBox")) {
      const viewBox = svgElement
        .getAttribute("viewBox")
        .split(" ")
        .map(parseFloat);
      width = viewBox[2];
      height = viewBox[3];
    } else {
      const bbox = svgElement.getBoundingClientRect();
      width = bbox.width;
      height = bbox.height;
      // 복제본에 viewBox 강제 주입 (렌더링 보정)
      clonedSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    if (!width || !height) {
      alert("SVG 크기를 계산할 수 없습니다.");
      return;
    }

    // 3. 캔버스 준비 (2배 해상도)
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");

    // 4. 배경색 채우기
    const isDark = document.body.getAttribute("data-theme") === "dark";
    ctx.fillStyle = isDark ? "#1a1b26" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 5. 이미지 변환
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const img = new Image();

    // Base64 변환 시 한글/특수문자 깨짐 방지
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = function () {
      ctx.drawImage(img, 0, 0, width * scale, height * scale);
      const link = document.createElement("a");
      link.download = `schema_ninja_${new Date().getTime()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      URL.revokeObjectURL(url);
    };

    img.onerror = function () {
      alert("이미지 변환 중 오류가 발생했습니다.");
    };

    img.src = url;
  } catch (e) {
    console.error(e);
    alert(
      "내보내기 실패! 개발자 도구(F12) Console을 확인해주세요.\n에러: " +
        e.message
    );
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
    btn.textContent = "🌙 Dark Mode";
    mermaid.initialize({ theme: "default" });
  } else {
    body.setAttribute("data-theme", "dark");
    btn.textContent = "☀️ Light Mode";
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
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")");
  for (let i = 0; i < clean.length; i++) {
    let char = clean[i];
    if (char === "(") {
      parenDepth++;
      if (parenDepth === 1) formatted += " (\n    ";
      else formatted += "(";
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
  formatted = formatted.replace(/CREATE TABLE/gi, "\n\nCREATE TABLE");
  input.value = formatted.trim();
  updateHighlight(formatted.trim());
};

function parseDDLtoMermaidV6(ddl) {
  let mermaidText = "erDiagram\n";
  let relationships = [];
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
