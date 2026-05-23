const assert = require("node:assert/strict");
const Graph = require("../src/graph.js");

function edgeKey(edge) {
  return `${Math.min(edge.from, edge.to)}:${Math.max(edge.from, edge.to)}`;
}

function bruteForceEdges(points, tolerance) {
  const edges = [];

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      const distanceSquared = dx * dx + dy * dy;

      if (Math.abs(distanceSquared - 1) <= tolerance) {
        edges.push({ from: i, to: j });
      }
    }
  }

  return edges;
}

const graph = Graph.generateGraph({
  radius: 4,
  rootOrder: 6,
  rootExponent: 1,
  coefficientMin: -4,
  coefficientMax: 4,
});

assert.equal(graph.warnings.length, 0);
assert.equal(graph.points.length, 865);
assert.equal(graph.edges.length, 3588);
assert.equal(graph.construction.generatedOrder, 12);
assert.equal(graph.construction.rank, 4);
assert.equal(graph.totalCandidates, 6561);
assert.equal(graph.totalPointCount, 865);
assert.equal(graph.omittedPointCount, 0);

for (const point of graph.points) {
  assert.equal(point.coefficients.length, graph.construction.rank);

  for (const coefficient of point.coefficients) {
    assert.ok(coefficient >= -4 && coefficient <= 4);
  }

  for (const embeddingExponent of graph.construction.units) {
    const value = Graph.evaluateCoefficients(point.coefficients, graph.construction, embeddingExponent);
    assert.ok(Math.hypot(value.x, value.y) < graph.radius);
  }
}

for (const edge of graph.edges) {
  const start = graph.points[edge.from];
  const end = graph.points[edge.to];
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  assert.ok(Math.abs(distance - 1) < 1e-6, "edge endpoints must be one unit apart");
}

const sparsePoints = graph.points.filter((_, index) => index % 5 === 0);
const indexedSparsePoints = sparsePoints.map((point, index) => ({ ...point, id: index }));
const hashedEdges = Graph.findUnitEdges(indexedSparsePoints, 1e-6).map(edgeKey).sort();
const expectedEdges = bruteForceEdges(indexedSparsePoints, 1e-6).map(edgeKey).sort();
assert.deepEqual(hashedEdges, expectedEdges, "spatial hash must match brute-force edge search");

const capped = Graph.generateGraph({
  radius: 4,
  rootOrder: 6,
  rootExponent: 1,
  coefficientMin: -4,
  coefficientMax: 4,
  maxPoints: 100,
});

assert.equal(capped.points.length, 100);
assert.equal(capped.totalPointCount, 865);
assert.equal(capped.omittedPointCount, 765);
assert.equal(capped.omittedPointCountIsLowerBound, false);
assert.equal(capped.capped, true);
assert.ok(capped.warnings.some((warning) => warning.includes("omitted 765 additional points")));

const smallerBox = Graph.generateGraph({
  radius: 4,
  rootOrder: 6,
  rootExponent: 1,
  coefficientMin: -2,
  coefficientMax: 2,
});

assert.equal(smallerBox.points.length, 461);
assert.equal(smallerBox.edges.length, 1992);

assert.deepEqual(Graph.primitiveExponents(8), [1, 3, 5, 7]);

assert.deepEqual(Graph.recommendedCoefficientRange(6, 1), {
  minimum: -4,
  maximum: 4,
  rank: 4,
  totalCandidates: 6561,
});

assert.deepEqual(Graph.recommendedCoefficientRange(5, 1), {
  minimum: -1,
  maximum: 1,
  rank: 8,
  totalCandidates: 6561,
});

const zeta8 = Graph.generateGraph({
  radius: 4,
  rootOrder: 8,
  rootExponent: 1,
});

assert.equal(zeta8.construction.ringLabel, "Z[zeta_8]");
assert.equal(zeta8.construction.rank, 4);
assert.ok(zeta8.points.length > 0);
assert.ok(zeta8.edges.length > 0);

const zeta5 = Graph.generateGraph({
  radius: 4,
  rootOrder: 5,
  rootExponent: 1,
  coefficientMin: -1,
  coefficientMax: 1,
});

assert.equal(zeta5.construction.ringLabel, "Z[zeta_20]");
assert.equal(zeta5.construction.rank, 8);
assert.equal(zeta5.totalCandidates, 6561);
assert.ok(zeta5.points.length > 0);

assert.ok(Graph.phonePresets().every((preset) => preset.checked === false));
