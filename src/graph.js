(function attachGraphApi(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.UnitDistanceGraph = api;
})(typeof window !== "undefined" ? window : globalThis, function createGraphApi() {
  const DEFAULTS = {
    radius: 4,
    pRe: 0.8090169943749475,
    pIm: 0.5877852522924731,
    edgeTolerance: 1e-6,
    maxPoints: 2500,
  };

  const MAX_COEFFICIENT_LIMIT = 140;
  const POINT_KEY_SCALE = 1e9;

  function finiteNumber(value, fallback) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  function makePointKey(x, y) {
    return `${Math.round(x * POINT_KEY_SCALE)},${Math.round(y * POINT_KEY_SCALE)}`;
  }

  function pointFromCoefficients(a, b, c, d, p) {
    return {
      x: a + c * p.re - d * p.im,
      y: b + c * p.im + d * p.re,
    };
  }

  function alternatePointFromCoefficients(a, b, c, d, p) {
    return {
      x: a + c * p.re + d * p.im,
      y: -b + c * p.im - d * p.re,
    };
  }

  function inOpenDisk(point, radius) {
    return Math.hypot(point.x, point.y) < radius;
  }

  function centeredIntegers(limit) {
    const values = [0];
    for (let value = 1; value <= limit; value += 1) {
      values.push(value, -value);
    }
    return values;
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

  function generateGraph(options) {
    const radius = Math.max(0.001, finiteNumber(options && options.radius, DEFAULTS.radius));
    const maxPoints = Math.max(1, Math.floor(finiteNumber(options && options.maxPoints, DEFAULTS.maxPoints)));
    const p = {
      re: finiteNumber(options && options.pRe, DEFAULTS.pRe),
      im: finiteNumber(options && options.pIm, DEFAULTS.pIm),
    };
    const edgeTolerance = Math.max(
      1e-12,
      finiteNumber(options && options.edgeTolerance, DEFAULTS.edgeTolerance),
    );
    const warnings = [];

    if (Math.abs(p.im) < 1e-8) {
      return {
        points: [],
        edges: [],
        p,
        radius,
        maxPoints,
        warnings: ["Im(p) must be nonzero for this finite cut-and-project window."],
        duplicateCount: 0,
        capped: false,
      };
    }

    const coefficientLimit = Math.ceil(radius / Math.abs(p.im)) + 2;
    if (coefficientLimit > MAX_COEFFICIENT_LIMIT) {
      return {
        points: [],
        edges: [],
        p,
        radius,
        maxPoints,
        warnings: [
          `Im(p) is too close to zero for browser rendering; coefficient limit would be ${coefficientLimit}.`,
        ],
        duplicateCount: 0,
        capped: false,
      };
    }

    const points = [];
    const seen = new Map();
    const coefficientValues = centeredIntegers(coefficientLimit);
    let duplicateCount = 0;
    let capped = false;

    coefficientLoop: for (const c of coefficientValues) {
      const aMin = Math.ceil(-radius - c * p.re);
      const aMax = Math.floor(radius - c * p.re);

      for (const d of coefficientValues) {
        const bMin = Math.ceil(-radius - d * p.re);
        const bMax = Math.floor(radius - d * p.re);
        const aValues = integerRangeAround(aMin, aMax, -c * p.re + d * p.im);
        const bValues = integerRangeAround(bMin, bMax, -c * p.im - d * p.re);

        for (const a of aValues) {
          for (const b of bValues) {
            const z = pointFromCoefficients(a, b, c, d, p);
            const alternate = alternatePointFromCoefficients(a, b, c, d, p);

            if (!inOpenDisk(z, radius) || !inOpenDisk(alternate, radius)) {
              continue;
            }

            const key = makePointKey(z.x, z.y);
            if (seen.has(key)) {
              duplicateCount += 1;
              continue;
            }

            const point = {
              id: points.length,
              x: z.x,
              y: z.y,
              alternateX: alternate.x,
              alternateY: alternate.y,
              a,
              b,
              c,
              d,
            };
            seen.set(key, point);
            points.push(point);

            if (points.length >= maxPoints) {
              capped = true;
              break coefficientLoop;
            }
          }
        }
      }
    }

    if (capped) {
      warnings.push(`Point limit reached at ${maxPoints}; edges only use the visible limited set.`);
    }

    const edges = findUnitEdges(points, edgeTolerance);

    return {
      points,
      edges,
      p,
      radius,
      maxPoints,
      warnings,
      duplicateCount,
      capped,
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
      { id: "iphone-pro", label: "iPhone Pro", width: 1179, height: 2556, checked: true },
      { id: "iphone-pro-max", label: "iPhone Pro Max", width: 1290, height: 2796, checked: true },
      { id: "iphone-x", label: "iPhone X / 11 Pro", width: 1125, height: 2436, checked: false },
      { id: "android-fhd", label: "Android FHD+", width: 1080, height: 2400, checked: true },
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
    generateGraph,
    findUnitEdges,
    renderGraph,
    phonePresets,
    downloadName,
    pointFromCoefficients,
    alternatePointFromCoefficients,
  };
});
