(function bootWallpaperApp() {
  const Graph = window.UnitDistanceGraph;
  const presets = Graph.phonePresets();
  const generatedUrls = [];

  const refs = {
    form: document.getElementById("controlForm"),
    summary: document.getElementById("graphSummary"),
    canvas: document.getElementById("wallpaperCanvas"),
    radius: document.getElementById("radiusInput"),
    angle: document.getElementById("angleInput"),
    angleOutput: document.getElementById("angleOutput"),
    pRe: document.getElementById("pReInput"),
    pIm: document.getElementById("pImInput"),
    pointColor: document.getElementById("pointColorInput"),
    lineColor: document.getElementById("lineColorInput"),
    backgroundColor: document.getElementById("backgroundColorInput"),
    pointSize: document.getElementById("pointSizeInput"),
    lineWidth: document.getElementById("lineWidthInput"),
    previewPreset: document.getElementById("previewPresetInput"),
    worldWidth: document.getElementById("worldWidthInput"),
    customWidth: document.getElementById("customWidthInput"),
    customHeight: document.getElementById("customHeightInput"),
    exportPresetList: document.getElementById("exportPresetList"),
    previewName: document.getElementById("previewName"),
    previewSize: document.getElementById("previewSize"),
    warning: document.getElementById("warningText"),
    exportPreview: document.getElementById("exportPreviewButton"),
    exportSelected: document.getElementById("exportSelectedButton"),
    clearExports: document.getElementById("clearExportsButton"),
    exportOutput: document.getElementById("exportOutput"),
  };

  let graph = null;
  let queued = false;
  let lastGraphKey = "";

  function numberValue(input, fallback) {
    const next = Number(input.value);
    return Number.isFinite(next) ? next : fallback;
  }

  function currentState() {
    return {
      radius: numberValue(refs.radius, 4),
      pRe: numberValue(refs.pRe, Graph.DEFAULTS.pRe),
      pIm: numberValue(refs.pIm, Graph.DEFAULTS.pIm),
      pointColor: refs.pointColor.value,
      lineColor: refs.lineColor.value,
      backgroundColor: refs.backgroundColor.value,
      pointRadius: numberValue(refs.pointSize, 3),
      lineWidth: numberValue(refs.lineWidth, 1.25),
      viewWidth: numberValue(refs.worldWidth, 8.8),
    };
  }

  function graphKey(state) {
    return [state.radius, state.pRe, state.pIm].map((value) => Number(value).toFixed(8)).join(":");
  }

  function presetWithCustomSize(preset) {
    if (!preset.custom) {
      return { ...preset };
    }

    return {
      ...preset,
      width: Math.round(numberValue(refs.customWidth, preset.width)),
      height: Math.round(numberValue(refs.customHeight, preset.height)),
    };
  }

  function selectedPreviewPreset() {
    const preset = presets.find((item) => item.id === refs.previewPreset.value) || presets[0];
    return presetWithCustomSize(preset);
  }

  function selectedExportPresets() {
    return Array.from(refs.exportPresetList.querySelectorAll("input[type='checkbox']:checked"))
      .map((input) => presets.find((preset) => preset.id === input.value))
      .filter(Boolean)
      .map(presetWithCustomSize);
  }

  function syncAngleOutput() {
    refs.angleOutput.textContent = `${Number(refs.angle.value).toFixed(1)} deg`;
  }

  function setPFromAngle() {
    const angle = (Number(refs.angle.value) * Math.PI) / 180;
    refs.pRe.value = Math.cos(angle).toFixed(6);
    refs.pIm.value = Math.sin(angle).toFixed(6);
    syncAngleOutput();
  }

  function setAngleFromP() {
    const angle = (Math.atan2(numberValue(refs.pIm, 0), numberValue(refs.pRe, 1)) * 180) / Math.PI;
    if (Number.isFinite(angle)) {
      const clamped = Math.max(Number(refs.angle.min), Math.min(Number(refs.angle.max), angle));
      refs.angle.value = String(clamped);
      syncAngleOutput();
    }
  }

  function populatePresets() {
    for (const preset of presets) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = `${preset.label} (${preset.width} x ${preset.height})`;
      refs.previewPreset.append(option);

      const label = document.createElement("label");
      label.className = "preset-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = preset.id;
      checkbox.checked = preset.checked;

      const text = document.createElement("span");
      text.textContent = preset.label;

      const size = document.createElement("small");
      size.textContent = `${preset.width} x ${preset.height}`;
      text.append(size);

      label.append(checkbox, text);
      refs.exportPresetList.append(label);
    }
  }

  function updateCustomLabels() {
    const custom = presets.find((preset) => preset.custom);
    if (!custom) {
      return;
    }

    custom.width = Math.round(numberValue(refs.customWidth, custom.width));
    custom.height = Math.round(numberValue(refs.customHeight, custom.height));

    const customOption = Array.from(refs.previewPreset.options).find((option) => option.value === custom.id);
    if (customOption) {
      customOption.textContent = `${custom.label} (${custom.width} x ${custom.height})`;
    }

    const customCheckbox = refs.exportPresetList.querySelector(`input[value="${custom.id}"]`);
    if (customCheckbox) {
      const size = customCheckbox.parentElement.querySelector("small");
      size.textContent = `${custom.width} x ${custom.height}`;
    }
  }

  function render() {
    queued = false;
    updateCustomLabels();

    const state = currentState();
    const nextGraphKey = graphKey(state);
    if (!graph || nextGraphKey !== lastGraphKey) {
      graph = Graph.generateGraph(state);
      lastGraphKey = nextGraphKey;
    }

    const preset = selectedPreviewPreset();
    refs.canvas.width = preset.width;
    refs.canvas.height = preset.height;
    refs.previewName.textContent = preset.label;
    refs.previewSize.textContent = `${preset.width} x ${preset.height}`;

    Graph.renderGraph(refs.canvas, graph, state);

    const pLabel = `${state.pRe.toFixed(4)} ${state.pIm < 0 ? "-" : "+"} ${Math.abs(state.pIm).toFixed(4)}i`;
    refs.summary.textContent = `${graph.points.length} points, ${graph.edges.length} unit edges, p = ${pLabel}`;
    refs.warning.textContent = graph.warnings.join(" ");
  }

  function scheduleRender() {
    if (queued) {
      return;
    }

    queued = true;
    window.requestAnimationFrame(render);
  }

  function appendDownloadLink(url, preset) {
    const link = document.createElement("a");
    link.className = "export-link";
    link.href = url;
    link.download = Graph.downloadName(preset);
    link.textContent = preset.label;

    const size = document.createElement("small");
    size.textContent = `${preset.width} x ${preset.height} PNG`;
    link.append(size);

    refs.exportOutput.prepend(link);
  }

  function renderPresetToBlob(preset) {
    return new Promise((resolve) => {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = preset.width;
      exportCanvas.height = preset.height;
      Graph.renderGraph(exportCanvas, graph, currentState());
      exportCanvas.toBlob(resolve, "image/png");
    });
  }

  async function buildExports(presetsToRender) {
    refs.exportPreview.disabled = true;
    refs.exportSelected.disabled = true;

    try {
      if (!graph) {
        render();
      }

      for (const preset of presetsToRender) {
        const blob = await renderPresetToBlob(preset);
        if (!blob) {
          continue;
        }

        const url = URL.createObjectURL(blob);
        generatedUrls.push(url);
        appendDownloadLink(url, preset);
      }
    } finally {
      refs.exportPreview.disabled = false;
      refs.exportSelected.disabled = false;
    }
  }

  function clearExports() {
    for (const url of generatedUrls.splice(0)) {
      URL.revokeObjectURL(url);
    }
    refs.exportOutput.replaceChildren();
  }

  populatePresets();
  setPFromAngle();
  render();

  refs.angle.addEventListener("input", () => {
    setPFromAngle();
    scheduleRender();
  });

  refs.pRe.addEventListener("input", () => {
    setAngleFromP();
    scheduleRender();
  });

  refs.pIm.addEventListener("input", () => {
    setAngleFromP();
    scheduleRender();
  });

  refs.form.addEventListener("input", scheduleRender);
  refs.previewPreset.addEventListener("change", scheduleRender);

  refs.exportPreview.addEventListener("click", () => {
    buildExports([selectedPreviewPreset()]);
  });

  refs.exportSelected.addEventListener("click", () => {
    const batch = selectedExportPresets();
    if (batch.length > 0) {
      buildExports(batch);
    }
  });

  refs.clearExports.addEventListener("click", clearExports);

  window.addEventListener("beforeunload", clearExports);
})();
