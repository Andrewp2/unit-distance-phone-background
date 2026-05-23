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
  discriminant: 5,
});

assert.equal(graph.warnings.length, 0);
assert.ok(graph.points.length > 100, "default construction should produce a visible point set");
assert.ok(graph.edges.length > graph.points.length, "default construction should produce many unit edges");

for (const point of graph.points) {
  const z = Graph.pointFromCoefficients(point.a, point.b, point.c, point.d, graph.field.omega);
  const alternate = Graph.pointFromCoefficients(
    point.a,
    point.b,
    point.c,
    point.d,
    graph.field.omegaConjugate,
  );
  assert.ok(Math.hypot(z.x, z.y) < graph.radius);
  assert.ok(Math.hypot(alternate.x, alternate.y) < graph.radius);
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

const invalid = Graph.generateGraph({ radius: 4, discriminant: 12 });
assert.ok(invalid.warnings.length > 0);

const capped = Graph.generateGraph({
  radius: 4,
  discriminant: 5,
  maxPoints: 100,
});

assert.equal(capped.points.length, 100);
assert.equal(capped.capped, true);
assert.ok(capped.warnings.some((warning) => warning.includes("Point limit")));
