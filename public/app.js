(function () {
  const defaultDocument = {
    version: 1,
    latex: "x = \\sin \\left( \\frac{\\pi}{2} \\right)",
    options: {
      autoUpdate: true,
      colorMode: "default",
      customColor: "#1d4ed8",
      scaleMode: "default",
      manualExPx: 8,
      fontFamily: "Arial",
      fontSizePx: 16,
      displayMode: true
    }
  };

  const els = {
    status: document.getElementById("status"),
    latexInput: document.getElementById("latexInput"),
    autoUpdate: document.getElementById("autoUpdate"),
    customColor: document.getElementById("customColor"),
    manualExPx: document.getElementById("manualExPx"),
    fontFamily: document.getElementById("fontFamily"),
    fontSizePx: document.getElementById("fontSizePx"),
    renderButton: document.getElementById("renderButton"),
    copySvgButton: document.getElementById("copySvgButton"),
    downloadSvgButton: document.getElementById("downloadSvgButton"),
    downloadJsonButton: document.getElementById("downloadJsonButton"),
    svgSource: document.getElementById("svgSource"),
    preview: document.getElementById("preview"),
    previewContent: document.getElementById("previewContent"),
    svgSize: document.getElementById("svgSize"),
    projectDirectory: document.getElementById("projectDirectory"),
    projectFilename: document.getElementById("projectFilename"),
    saveProjectButton: document.getElementById("saveProjectButton"),
    loadProjectButton: document.getElementById("loadProjectButton"),
    listProjectButton: document.getElementById("listProjectButton"),
    projectList: document.getElementById("projectList"),
    jsonFileInput: document.getElementById("jsonFileInput"),
    measureHost: document.getElementById("measureHost")
  };

  let latestSvg = "";
  let renderToken = 0;
  let renderTimer = null;

  function setStatus(message, type) {
    els.status.textContent = message;
    els.status.className = `status${type ? ` ${type}` : ""}`;
  }

  function selectedValue(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : "";
  }

  function setSelectedValue(name, value) {
    const target = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (target) {
      target.checked = true;
    }
  }

  function getOptions() {
    return {
      autoUpdate: els.autoUpdate.checked,
      colorMode: selectedValue("colorMode") || "default",
      customColor: els.customColor.value.trim() || "#000000",
      scaleMode: selectedValue("scaleMode") || "default",
      manualExPx: Number(els.manualExPx.value) || 8,
      fontFamily: els.fontFamily.value.trim() || "Arial",
      fontSizePx: Number(els.fontSizePx.value) || 16,
      displayMode: selectedValue("displayMode") !== "false"
    };
  }

  function getDocument() {
    return {
      version: 1,
      latex: els.latexInput.value,
      options: getOptions()
    };
  }

  function applyDocument(documentValue) {
    const doc = {
      ...defaultDocument,
      ...documentValue,
      options: {
        ...defaultDocument.options,
        ...(documentValue && documentValue.options ? documentValue.options : {})
      }
    };

    els.latexInput.value = doc.latex || "";
    els.autoUpdate.checked = Boolean(doc.options.autoUpdate);
    els.customColor.value = doc.options.customColor || "#1d4ed8";
    els.manualExPx.value = doc.options.manualExPx || 8;
    els.fontFamily.value = doc.options.fontFamily || "Arial";
    els.fontSizePx.value = doc.options.fontSizePx || 16;
    setSelectedValue("colorMode", doc.options.colorMode || "default");
    setSelectedValue("scaleMode", doc.options.scaleMode || "default");
    setSelectedValue("displayMode", String(doc.options.displayMode !== false));
    scheduleRender(true);
  }

  function parseEx(value) {
    const match = String(value || "").match(/^([\d.]+)ex$/);
    return match ? Number(match[1]) : null;
  }

  function fontExPx(options) {
    els.measureHost.textContent = "";
    const probe = document.createElement("span");
    probe.textContent = "";
    probe.style.display = "inline-block";
    probe.style.width = "1ex";
    probe.style.height = "1ex";
    probe.style.fontFamily = options.fontFamily;
    probe.style.fontSize = `${options.fontSizePx}px`;
    els.measureHost.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    return rect.width || rect.height || 8;
  }

  function scalePxPerEx(options) {
    if (options.scaleMode === "manual") {
      return Math.max(1, options.manualExPx || 8);
    }
    if (options.scaleMode === "font") {
      return Math.max(1, fontExPx(options));
    }
    return 8;
  }

  function colorForOptions(options) {
    if (options.colorMode === "black") {
      return "#000000";
    }
    if (options.colorMode === "custom") {
      return options.customColor || "#000000";
    }
    return "";
  }

  function prepareSvg(svg, options) {
    const clone = svg.cloneNode(true);
    const pxPerEx = scalePxPerEx(options);
    const widthEx = parseEx(clone.getAttribute("width"));
    const heightEx = parseEx(clone.getAttribute("height"));
    const color = colorForOptions(options);

    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.removeAttribute("aria-hidden");
    clone.removeAttribute("focusable");

    if (widthEx && heightEx) {
      clone.setAttribute("width", `${formatNumber(widthEx * pxPerEx)}px`);
      clone.setAttribute("height", `${formatNumber(heightEx * pxPerEx)}px`);
    }

    clone.style.color = color;
    clone.style.verticalAlign = "";
    clone.setAttribute("data-piceq-scale", `1ex=${formatNumber(pxPerEx)}px`);

    return clone;
  }

  function formatNumber(value) {
    return Number(value.toFixed(3)).toString();
  }

  function serializeSvg(svg) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  }

  async function renderEquation() {
    const token = ++renderToken;
    const latex = els.latexInput.value.trim();
    const options = getOptions();

    if (!latex) {
      els.previewContent.textContent = "";
      els.svgSource.value = "";
      els.svgSize.textContent = "-";
      latestSvg = "";
      setStatus("请输入 LaTeX。");
      return "";
    }

    try {
      setStatus("正在渲染...");
      await window.MathJax.startup.promise;
      const wrapper = await window.MathJax.tex2svgPromise(latex, { display: options.displayMode });
      if (token !== renderToken) {
        return;
      }

      const sourceSvg = wrapper.querySelector("svg");
      const svg = prepareSvg(sourceSvg, options);
      latestSvg = serializeSvg(svg);
      els.svgSource.value = latestSvg;
      els.previewContent.replaceChildren(svg.cloneNode(true));
      els.svgSize.textContent = `${svg.getAttribute("width") || "auto"} × ${svg.getAttribute("height") || "auto"}`;
      setStatus("已渲染。", "ok");
      return latestSvg;
    } catch (error) {
      latestSvg = "";
      els.previewContent.textContent = "渲染失败";
      els.svgSource.value = "";
      els.svgSize.textContent = "-";
      setStatus(error.message || "渲染失败。", "error");
      return "";
    }
  }

  function scheduleRender(immediate) {
    clearTimeout(renderTimer);
    if (!els.autoUpdate.checked && !immediate) {
      return;
    }
    renderTimer = setTimeout(renderEquation, immediate ? 0 : 250);
  }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function apiPost(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "请求失败。");
    }
    return data;
  }

  function svgCacheFilename() {
    const projectName = (els.projectFilename.value.trim() || "equation").replace(/\.json$/i, "");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${projectName}-${timestamp}.svg`;
  }

  async function copySvg() {
    const svg = await renderEquation();
    if (!svg) {
      throw new Error("没有可复制的 SVG。");
    }

    const data = await apiPost("/api/svg/cache", {
      filename: svgCacheFilename(),
      svg,
      copyToClipboard: true
    });

    if (!data.clipboardCopied) {
      throw new Error(`SVG 已缓存：${data.filePath}，但复制文件失败：${data.clipboardError || "未知错误"}`);
    }

    setStatus(`已复制 SVG 文件，可粘贴到 PPT：${data.filePath}`, "ok");
  }

  function projectInput() {
    return {
      directory: els.projectDirectory.value.trim(),
      filename: els.projectFilename.value.trim()
    };
  }

  async function saveProject() {
    const input = projectInput();
    const data = await apiPost("/api/projects/save", {
      ...input,
      document: getDocument()
    });
    setStatus(`已保存：${data.filePath}`, "ok");
  }

  async function loadProject() {
    const data = await apiPost("/api/projects/load", projectInput());
    applyDocument(data.document);
    setStatus(`已导入：${data.filePath}`, "ok");
  }

  async function listProjects() {
    const data = await apiPost("/api/projects/list", {
      directory: els.projectDirectory.value.trim()
    });
    els.projectList.textContent = "";

    if (!data.files.length) {
      els.projectList.textContent = "目录中没有 JSON 项目。";
      return;
    }

    data.files.forEach((file) => {
      const item = document.createElement("div");
      const name = document.createElement("span");
      const button = document.createElement("button");
      item.className = "project-item";
      name.textContent = file.name;
      name.title = file.filePath;
      button.type = "button";
      button.textContent = "导入";
      button.addEventListener("click", async () => {
        const loaded = await apiPost("/api/projects/load", { filePath: file.filePath });
        els.projectFilename.value = file.name;
        applyDocument(loaded.document);
        setStatus(`已导入：${loaded.filePath}`, "ok");
      });
      item.append(name, button);
      els.projectList.appendChild(item);
    });
  }

  function wireEvents() {
    const autoInputs = [
      els.latexInput,
      els.customColor,
      els.manualExPx,
      els.fontFamily,
      els.fontSizePx
    ];

    autoInputs.forEach((input) => {
      input.addEventListener("input", () => scheduleRender(false));
    });

    document.querySelectorAll('input[type="radio"], #autoUpdate').forEach((input) => {
      input.addEventListener("change", () => scheduleRender(input.id === "autoUpdate" ? false : true));
    });

    els.renderButton.addEventListener("click", renderEquation);
    els.copySvgButton.addEventListener("click", () => copySvg().catch((error) => setStatus(error.message, "error")));
    els.downloadSvgButton.addEventListener("click", () => {
      if (!latestSvg) {
        renderEquation();
        return;
      }
      downloadText("equation.svg", latestSvg, "image/svg+xml;charset=utf-8");
    });
    els.downloadJsonButton.addEventListener("click", () => {
      const filename = els.projectFilename.value.trim() || "equation.json";
      downloadText(
        filename.toLowerCase().endsWith(".json") ? filename : `${filename}.json`,
        `${JSON.stringify(getDocument(), null, 2)}\n`,
        "application/json;charset=utf-8"
      );
    });
    els.saveProjectButton.addEventListener("click", () => saveProject().catch((error) => setStatus(error.message, "error")));
    els.loadProjectButton.addEventListener("click", () => loadProject().catch((error) => setStatus(error.message, "error")));
    els.listProjectButton.addEventListener("click", () => listProjects().catch((error) => setStatus(error.message, "error")));
    els.jsonFileInput.addEventListener("change", async () => {
      const file = els.jsonFileInput.files[0];
      if (!file) {
        return;
      }
      try {
        applyDocument(JSON.parse(await file.text()));
        els.projectFilename.value = file.name;
        setStatus(`已从浏览器导入：${file.name}`, "ok");
      } catch (error) {
        setStatus(error.message || "JSON 导入失败。", "error");
      } finally {
        els.jsonFileInput.value = "";
      }
    });
  }

  window.addEventListener("load", async () => {
    wireEvents();
    try {
      await window.MathJax.startup.promise;
      setStatus("MathJax 已加载。", "ok");
      applyDocument(defaultDocument);
    } catch (error) {
      setStatus("MathJax 加载失败，请检查网络连接。", "error");
    }
  });
})();
