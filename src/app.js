(function bootWallpaperApp() {
  const Graph = window.UnitDistanceGraph;
  const presets = Graph.phonePresets();
  const generatedUrls = [];

  const refs = {
    form: document.getElementById("controlForm"),
    summary: document.getElementById("graphSummary"),
    canvas: document.getElementById("wallpaperCanvas"),
    radius: document.getElementById("radiusInput"),
    maxPoints: document.getElementById("maxPointsInput"),
    coefficientMin: document.getElementById("coefficientMinInput"),
    coefficientMax: document.getElementById("coefficientMaxInput"),
    rootOrder: document.getElementById("rootOrderInput"),
    rootExponent: document.getElementById("rootExponentInput"),
    constructionOutput: document.getElementById("constructionOutput"),
    pointColor: document.getElementById("pointColorInput"),
    lineColor: document.getElementById("lineColorInput"),
    backgroundColor: document.getElementById("backgroundColorInput"),
    pointSize: document.getElementById("pointSizeInput"),
    lineWidth: document.getElementById("lineWidthInput"),
    previewPreset: document.getElementById("previewPresetInput"),
    worldWidth: document.getElementById("worldWidthInput"),
    zoom: document.getElementById("zoomInput"),
    zoomOutput: document.getElementById("zoomOutput"),
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
    const worldWidth = numberValue(refs.worldWidth, 8.8);
    const zoom = Math.max(0.1, numberValue(refs.zoom, 1));

    return {
      radius: numberValue(refs.radius, 4),
      maxPoints: numberValue(refs.maxPoints, Graph.DEFAULTS.maxPoints),
      coefficientMin: numberValue(refs.coefficientMin, Graph.DEFAULTS.coefficientMin),
      coefficientMax: numberValue(refs.coefficientMax, Graph.DEFAULTS.coefficientMax),
      rootOrder: numberValue(refs.rootOrder, Graph.DEFAULTS.rootOrder),
      rootExponent: numberValue(refs.rootExponent, Graph.DEFAULTS.rootExponent),
      pointColor: refs.pointColor.value,
      lineColor: refs.lineColor.value,
      backgroundColor: refs.backgroundColor.value,
      pointRadius: numberValue(refs.pointSize, 3),
      lineWidth: numberValue(refs.lineWidth, 1.25),
      zoom,
      viewWidth: worldWidth / zoom,
    };
  }

  function graphKey(state) {
    return [
      state.radius,
      state.maxPoints,
      state.coefficientMin,
      state.coefficientMax,
      state.rootOrder,
      state.rootExponent,
    ]
      .map((value) => Number(value).toFixed(8))
      .join(":");
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

  function syncZoomOutput() {
    refs.zoomOutput.textContent = `${Number(refs.zoom.value).toFixed(1)}x`;
  }

  function syncConstructionOutput() {
    const rho = Graph.rootOfUnity(numberValue(refs.rootOrder, 6), numberValue(refs.rootExponent, 1));
    refs.constructionOutput.textContent = `${rho.label}, full ring ${rho.ringLabel}, rank ${rho.rank}, rho = ${rho.re.toFixed(6)} ${rho.im < 0 ? "-" : "+"} ${Math.abs(rho.im).toFixed(6)}i`;
  }

  function populateRootOrders() {
    for (const order of Graph.ROOT_ORDER_PRESETS) {
      const option = document.createElement("option");
      option.value = String(order);
      option.textContent = `zeta_${order}`;
      option.selected = order === Graph.DEFAULTS.rootOrder;
      refs.rootOrder.append(option);
    }
  }

  function populateRootExponents() {
    const order = numberValue(refs.rootOrder, Graph.DEFAULTS.rootOrder);
    const current = numberValue(refs.rootExponent, Graph.DEFAULTS.rootExponent);
    const exponents = Graph.primitiveExponents(order);
    refs.rootExponent.replaceChildren();

    for (const exponent of exponents) {
      const option = document.createElement("option");
      option.value = String(exponent);
      option.textContent = String(exponent);
      option.selected = exponent === current || (!exponents.includes(current) && exponent === exponents[0]);
      refs.rootExponent.append(option);
    }

    syncConstructionOutput();
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

    refs.summary.textContent = `${graph.points.length} points, ${graph.edges.length} unit edges, ${graph.construction.ringLabel}, rank ${graph.construction.rank}, coeffs ${graph.coefficientRange.minimum}..${graph.coefficientRange.maximum}`;
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

  populateRootOrders();
  populateRootExponents();
  populatePresets();
  syncConstructionOutput();
  syncZoomOutput();
  render();

  refs.rootOrder.addEventListener("change", () => {
    populateRootExponents();
    scheduleRender();
  });

  refs.rootExponent.addEventListener("change", () => {
    syncConstructionOutput();
    scheduleRender();
  });

  refs.form.addEventListener("input", scheduleRender);
  refs.zoom.addEventListener("input", syncZoomOutput);
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
