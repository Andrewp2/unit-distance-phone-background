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
    edgeTolerance: 1e-6,
    maxPoints: 2500,
  };

  const ROOT_ORDER_PRESETS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 20, 24, 30];
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

    return {
      order: safeOrder,
      exponent: safeExponent,
      re,
      im,
      generatedOrder,
      label: `rho = zeta_${safeOrder}^${safeExponent}`,
      ringLabel: `Z[i, rho] = Z[zeta_${generatedOrder}]`,
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

  function pointFromCoefficients(a, b, c, d, rho) {
    const value = rho || rootOfUnity(DEFAULTS.rootOrder, DEFAULTS.rootExponent);

    return {
      x: a + c * value.re - d * value.im,
      y: b + c * value.im + d * value.re,
    };
  }

  function alternatePointFromCoefficients(a, b, c, d, rho) {
    const value = rho || rootOfUnity(DEFAULTS.rootOrder, DEFAULTS.rootExponent);

    return {
      x: a + c * value.re + d * value.im,
      y: -b + c * value.im - d * value.re,
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

  function integerRangeInside(lower, upper, center) {
    return integerRangeAround(Math.floor(lower) + 1, Math.ceil(upper) - 1, center);
  }

  function coefficientLimitForRadius(radius, rho) {
    return Math.ceil(radius / Math.abs(rho.im)) + 2;
  }

  function generateGraph(options) {
    const radius = Math.max(0.001, finiteNumber(options && options.radius, DEFAULTS.radius));
    const rho = rootOfUnity(options && options.rootOrder, options && options.rootExponent);
    const maxPoints = Math.max(1, Math.floor(finiteNumber(options && options.maxPoints, DEFAULTS.maxPoints)));
    const edgeTolerance = Math.max(
      1e-12,
      finiteNumber(options && options.edgeTolerance, DEFAULTS.edgeTolerance),
    );
    const warnings = [];
    if (Math.abs(rho.im) < 1e-8) {
      warnings.push("rho must be non-real for this finite four-coefficient search.");
      return {
        points: [],
        edges: [],
        construction: rho,
        radius,
        maxPoints,
        warnings,
        duplicateCount: 0,
        capped: false,
      };
    }

    if (rho.generatedOrder > 12) {
      warnings.push(
        "For generated orders above 12 this is the same four-coefficient slice, not the full ring of integers.",
      );
    }

    const coefficientLimit = coefficientLimitForRadius(radius, rho);

    const points = [];
    const seen = new Map();
    const coefficientValues = centeredIntegers(coefficientLimit);
    let duplicateCount = 0;
    let capped = false;

    coefficientLoop: for (const c of coefficientValues) {
      for (const d of coefficientValues) {
        const aLower = Math.max(
          -radius - c * rho.re + d * rho.im,
          -radius - c * rho.re - d * rho.im,
        );
        const aUpper = Math.min(
          radius - c * rho.re + d * rho.im,
          radius - c * rho.re - d * rho.im,
        );
        const bLower = Math.max(
          -radius - c * rho.im - d * rho.re,
          c * rho.im - d * rho.re - radius,
        );
        const bUpper = Math.min(
          radius - c * rho.im - d * rho.re,
          c * rho.im - d * rho.re + radius,
        );
        const aValues = integerRangeInside(aLower, aUpper, -c * rho.re);
        const bValues = integerRangeInside(bLower, bUpper, -d * rho.re);

        for (const a of aValues) {
          for (const b of bValues) {
            const z = pointFromCoefficients(a, b, c, d, rho);
            const alternate = alternatePointFromCoefficients(a, b, c, d, rho);

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
      construction: rho,
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
    ROOT_ORDER_PRESETS,
    primitiveExponents,
    rootOfUnity,
    generateGraph,
    findUnitEdges,
    renderGraph,
    phonePresets,
    downloadName,
    pointFromCoefficients,
    alternatePointFromCoefficients,
  };
});
