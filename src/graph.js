(function attachGraphApi(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.UnitDistanceGraph = api;
})(typeof window !== "undefined" ? window : globalThis, function createGraphApi() {
  const DEFAULTS = {
    radius: 4,
    rootOrder: 6,
    rootExponent: 1,
    coefficientMin: -4,
    coefficientMax: 4,
    edgeTolerance: 1e-6,
    maxCandidates: 2000000,
    maxPoints: 2500,
  };

  const ROOT_ORDER_PRESETS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 20, 24, 30];
  const COEFFICIENT_LIMIT = 60;
  const DISK_EPSILON = 1e-9;
  const POINT_KEY_SCALE = 1e9;
  const COMMON_TRIG_VALUES = [
    -1,
    -Math.sqrt(3) / 2,
    -Math.SQRT1_2,
    -0.5,
    0,
    0.5,
    Math.SQRT1_2,
    Math.sqrt(3) / 2,
    1,
  ];

  function finiteNumber(value, fallback) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  function makePointKey(x, y) {
    return `${Math.round(x * POINT_KEY_SCALE)},${Math.round(y * POINT_KEY_SCALE)}`;
  }

  function gcd(left, right) {
    let a = Math.abs(Math.trunc(left));
    let b = Math.abs(Math.trunc(right));

    while (b !== 0) {
      const next = a % b;
      a = b;
      b = next;
    }

    return a;
  }

  function lcm(left, right) {
    return Math.abs(left * right) / gcd(left, right);
  }

  function eulerPhi(value) {
    let result = 0;

    for (let candidate = 1; candidate <= value; candidate += 1) {
      if (gcd(candidate, value) === 1) {
        result += 1;
      }
    }

    return result;
  }

  function unitsModulo(value) {
    const units = [];

    for (let candidate = 1; candidate <= value; candidate += 1) {
      if (gcd(candidate, value) === 1) {
        units.push(candidate);
      }
    }

    return units;
  }

  function primitiveExponents(order) {
    const safeOrder = Math.max(3, Math.round(finiteNumber(order, DEFAULTS.rootOrder)));
    const values = [];

    for (let exponent = 1; exponent < safeOrder; exponent += 1) {
      if (gcd(exponent, safeOrder) === 1) {
        values.push(exponent);
      }
    }

    return values;
  }

  function rootOfUnity(order, exponent) {
    const safeOrder = Math.max(3, Math.round(finiteNumber(order, DEFAULTS.rootOrder)));
    const primitiveValues = primitiveExponents(safeOrder);
    const requestedExponent = Math.round(finiteNumber(exponent, DEFAULTS.rootExponent));
    const safeExponent = primitiveValues.includes(requestedExponent)
      ? requestedExponent
      : primitiveValues[0];
    const angle = (2 * Math.PI * safeExponent) / safeOrder;
    const generatedOrder = lcm(4, safeOrder);
    const re = snapTrig(Math.cos(angle));
    const im = snapTrig(Math.sin(angle));
    const rank = eulerPhi(generatedOrder);
    const units = unitsModulo(generatedOrder);

    return {
      order: safeOrder,
      exponent: safeExponent,
      re,
      im,
      generatedOrder,
      rank,
      units,
      label: `rho = zeta_${safeOrder}^${safeExponent}`,
      ringLabel: `Z[zeta_${generatedOrder}]`,
    };
  }

  function snapTrig(value) {
    for (const candidate of COMMON_TRIG_VALUES) {
      if (Math.abs(value - candidate) < 1e-12) {
        return candidate;
      }
    }

    return value;
  }

  function inOpenDisk(point, radius) {
    return point.x * point.x + point.y * point.y < radius * radius - DISK_EPSILON;
  }

  function integerRangeAround(minimum, maximum, center) {
    const values = [];
    for (let value = minimum; value <= maximum; value += 1) {
      values.push(value);
    }

    values.sort((left, right) => {
      const leftDistance = Math.abs(left - center);
      const rightDistance = Math.abs(right - center);

      if (leftDistance === rightDistance) {
        return left - right;
      }

      return leftDistance - rightDistance;
    });

    return values;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function coefficientRange(options) {
    const rawMin = Math.round(finiteNumber(options && options.coefficientMin, DEFAULTS.coefficientMin));
    const rawMax = Math.round(finiteNumber(options && options.coefficientMax, DEFAULTS.coefficientMax));
    const warnings = [];
    let minimum = clamp(rawMin, -COEFFICIENT_LIMIT, COEFFICIENT_LIMIT);
    let maximum = clamp(rawMax, -COEFFICIENT_LIMIT, COEFFICIENT_LIMIT);

    if (minimum !== rawMin || maximum !== rawMax) {
      warnings.push(`Coefficient range is clamped to -${COEFFICIENT_LIMIT}..${COEFFICIENT_LIMIT}.`);
    }

    if (minimum > maximum) {
      const nextMinimum = maximum;
      maximum = minimum;
      minimum = nextMinimum;
      warnings.push("Coefficient min/max were swapped because min was greater than max.");
    }

    return {
      minimum,
      maximum,
      values: integerRangeAround(minimum, maximum, 0),
      warnings,
    };
  }

  function complexRoot(order, exponent) {
    const angle = (2 * Math.PI * exponent) / order;

    return {
      x: snapTrig(Math.cos(angle)),
      y: snapTrig(Math.sin(angle)),
    };
  }

  function precomputeEmbeddingPowers(construction) {
    return construction.units.map((embeddingExponent) => {
      const powers = [];

      for (let basisIndex = 0; basisIndex < construction.rank; basisIndex += 1) {
        powers.push(complexRoot(
          construction.generatedOrder,
          (embeddingExponent * basisIndex) % construction.generatedOrder,
        ));
      }

      return powers;
    });
  }

  function evaluateCoefficients(coefficients, construction, embeddingExponent) {
    const rootOrder = construction.generatedOrder;
    const exponent = embeddingExponent || 1;
    let x = 0;
    let y = 0;

    for (let index = 0; index < coefficients.length; index += 1) {
      const root = complexRoot(rootOrder, (exponent * index) % rootOrder);
      x += coefficients[index] * root.x;
      y += coefficients[index] * root.y;
    }

    return { x, y };
  }

  function generateGraph(options) {
    const radius = Math.max(0.001, finiteNumber(options && options.radius, DEFAULTS.radius));
    const construction = rootOfUnity(options && options.rootOrder, options && options.rootExponent);
    const coefficientBox = coefficientRange(options);
    const maxCandidates = Math.max(
      1,
      Math.floor(finiteNumber(options && options.maxCandidates, DEFAULTS.maxCandidates)),
    );
    const maxPoints = Math.max(1, Math.floor(finiteNumber(options && options.maxPoints, DEFAULTS.maxPoints)));
    const edgeTolerance = Math.max(
      1e-12,
      finiteNumber(options && options.edgeTolerance, DEFAULTS.edgeTolerance),
    );
    const warnings = [...coefficientBox.warnings];
    const totalCandidates = coefficientBox.values.length ** construction.rank;

    const points = [];
    const seen = new Map();
    const coefficientValues = coefficientBox.values;
    const embeddingPowers = precomputeEmbeddingPowers(construction);
    const embeddingValues = construction.units.map(() => ({ x: 0, y: 0 }));
    const coefficients = Array(construction.rank).fill(0);
    const projectionIndex = construction.units.indexOf(1);
    let candidateCount = 0;
    let duplicateCount = 0;
    let capped = false;
    let candidateCapped = false;

    function visitCoefficient(level) {
      if (capped || candidateCapped) {
        return;
      }

      if (level === construction.rank) {
        candidateCount += 1;

        if (candidateCount > maxCandidates) {
          candidateCapped = true;
          return;
        }

        for (const value of embeddingValues) {
          if (!inOpenDisk(value, radius)) {
            return;
          }
        }

        const projected = embeddingValues[projectionIndex];
        const key = makePointKey(projected.x, projected.y);
        if (seen.has(key)) {
          duplicateCount += 1;
          return;
        }

        const point = {
          id: points.length,
          x: projected.x,
          y: projected.y,
          coefficients: coefficients.slice(),
        };
        seen.set(key, point);
        points.push(point);

        if (points.length >= maxPoints) {
          capped = true;
        }
        return;
      }

      for (const coefficient of coefficientValues) {
        coefficients[level] = coefficient;

        for (let embeddingIndex = 0; embeddingIndex < embeddingValues.length; embeddingIndex += 1) {
          const power = embeddingPowers[embeddingIndex][level];
          embeddingValues[embeddingIndex].x += coefficient * power.x;
          embeddingValues[embeddingIndex].y += coefficient * power.y;
        }

        visitCoefficient(level + 1);

        for (let embeddingIndex = 0; embeddingIndex < embeddingValues.length; embeddingIndex += 1) {
          const power = embeddingPowers[embeddingIndex][level];
          embeddingValues[embeddingIndex].x -= coefficient * power.x;
          embeddingValues[embeddingIndex].y -= coefficient * power.y;
        }

        if (capped || candidateCapped) {
          return;
        }
      }
    }

    visitCoefficient(0);

    if (capped) {
      warnings.push(`Point limit reached at ${maxPoints}; edges only use the visible limited set.`);
    }

    if (candidateCapped) {
      warnings.push(
        `Search stopped after ${maxCandidates.toLocaleString()} candidates out of ${totalCandidates.toLocaleString()}; reduce the coefficient range for a complete render.`,
      );
    }

    const edges = findUnitEdges(points, edgeTolerance);

    return {
      points,
      edges,
      construction,
      coefficientRange: {
        minimum: coefficientBox.minimum,
        maximum: coefficientBox.maximum,
      },
      candidateCount,
      totalCandidates,
      radius,
      maxCandidates,
      maxPoints,
      warnings,
      duplicateCount,
      capped,
      candidateCapped,
    };
  }

  function bucketKey(x, y) {
    return `${x}:${y}`;
  }

  function findUnitEdges(points, tolerance) {
    const unitTolerance = Math.max(1e-12, finiteNumber(tolerance, DEFAULTS.edgeTolerance));
    const buckets = new Map();
    const cellSize = 1;
    const edges = [];

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      const bx = Math.floor(point.x / cellSize);
      const by = Math.floor(point.y / cellSize);
      const key = bucketKey(bx, by);

      if (!buckets.has(key)) {
        buckets.set(key, []);
      }

      buckets.get(key).push(i);
    }

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      const bx = Math.floor(point.x / cellSize);
      const by = Math.floor(point.y / cellSize);

      for (let oy = -2; oy <= 2; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          const neighbors = buckets.get(bucketKey(bx + ox, by + oy));
          if (!neighbors) {
            continue;
          }

          for (const j of neighbors) {
            if (j <= i) {
              continue;
            }

            const other = points[j];
            const dx = other.x - point.x;
            const dy = other.y - point.y;
            const distanceSquared = dx * dx + dy * dy;

            if (Math.abs(distanceSquared - 1) <= unitTolerance) {
              edges.push({ from: i, to: j });
            }
          }
        }
      }
    }

    return edges;
  }

  function renderGraph(canvas, graph, options) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const viewWidth = Math.max(0.1, finiteNumber(options && options.viewWidth, 8.8));
    const scale = width / viewWidth;

    ctx.save();
    ctx.fillStyle = (options && options.backgroundColor) || "#101820";
    ctx.fillRect(0, 0, width, height);

    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, -scale);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = (options && options.lineColor) || "#2dd4bf";
    ctx.lineWidth = Math.max(0.05, finiteNumber(options && options.lineWidth, 1.25)) / scale;

    ctx.beginPath();
    for (const edge of graph.edges) {
      const start = graph.points[edge.from];
      const end = graph.points[edge.to];
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    }
    ctx.stroke();

    ctx.fillStyle = (options && options.pointColor) || "#f4f7fb";
    const pointRadius = Math.max(0.05, finiteNumber(options && options.pointRadius, 3)) / scale;
    for (const point of graph.points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function phonePresets() {
    return [
      { id: "iphone-pro", label: "iPhone Pro", width: 1179, height: 2556, checked: false },
      { id: "iphone-pro-max", label: "iPhone Pro Max", width: 1290, height: 2796, checked: false },
      { id: "iphone-x", label: "iPhone X / 11 Pro", width: 1125, height: 2436, checked: false },
      { id: "android-fhd", label: "Android FHD+", width: 1080, height: 2400, checked: false },
      { id: "android-qhd", label: "Android QHD+", width: 1440, height: 3200, checked: false },
      { id: "pixel-pro", label: "Pixel Pro", width: 1344, height: 2992, checked: false },
      { id: "custom", label: "Custom", width: 1080, height: 2400, checked: false, custom: true },
    ];
  }

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function downloadName(preset) {
    return `unit-distance-${slugify(preset.label)}-${preset.width}x${preset.height}.png`;
  }

  return {
    DEFAULTS,
    ROOT_ORDER_PRESETS,
    COEFFICIENT_LIMIT,
    coefficientRange,
    eulerPhi,
    evaluateCoefficients,
    primitiveExponents,
    rootOfUnity,
    generateGraph,
    findUnitEdges,
    renderGraph,
    phonePresets,
    downloadName,
  };
});
