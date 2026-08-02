import * as g from "./.out/components/dialGeometry.js";
import { SIZES, trimToSize } from "./.out/schemas/dialSize.js";

let failures = 0;
const check = (label, actual, expected) => {
  const okay = JSON.stringify(actual) === JSON.stringify(expected);
  if (!okay) {
    failures += 1;
    console.log(`FAIL ${label}\n  got      ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`);
  } else {
    console.log(`ok   ${label}`);
  }
};

// Twelve o'clock on a circle of radius 50 centred at (50,50).
check("0deg is top", g.polarToCartesian(50, 50, 50, 0), { x: 50, y: 0 });
check("90deg is right", g.polarToCartesian(50, 50, 50, 90), { x: 100, y: 50 });
check("180deg is bottom", g.polarToCartesian(50, 50, 50, 180), { x: 50, y: 100 });
check("270deg is left", g.polarToCartesian(50, 50, 50, 270), { x: 0, y: 50 });

// A quartered dial: first wedge runs from top to right, no large-arc flag.
check(
  "4 segments, first wedge",
  g.segmentPath(50, 50, 50, 0, 4),
  "M 50 50 L 50 0 A 50 50 0 0 1 100 50 Z"
);

// Two segments: each is exactly a half, which must NOT set the large-arc flag.
check(
  "2 segments, no large arc",
  g.segmentPath(50, 50, 50, 0, 2).includes("A 50 50 0 0 1"),
  true
);

// Three segments: each sweeps 120deg, still under a half turn.
check(
  "3 segments, no large arc",
  g.segmentPath(50, 50, 50, 0, 3).includes("A 50 50 0 0 1"),
  true
);

// Counts and uniqueness: every segment must be a distinct wedge.
const twelve = g.segments(50, 50, 50, 12);
check("12 segments produced", twelve.length, 12);
check("12 segments all distinct", new Set(twelve.map((s) => s.d)).size, 12);

// Closure: the last segment must end where the first one starts.
const six = g.segments(50, 50, 50, 6);
const firstStart = six[0].d.match(/L ([\d.-]+) ([\d.-]+)/);
const lastEnd = six[5].d.match(/1 ([\d.-]+) ([\d.-]+) Z/);
check("ring closes on itself", [lastEnd[1], lastEnd[2]], [firstStart[1], firstStart[2]]);

// A single segment is a full circle and cannot be one arc.
const whole = g.segmentPath(50, 50, 50, 0, 1);
check("1 segment uses two arcs", (whole.match(/A /g) || []).length, 2);

// --- the reserved marker, inset inside its wedge --------------------------
// Endpoints only: the two numbers after M and L, and the last two of an arc.
// The arc's leading radii are not points and must not be measured as such.
const points = (d) => [
  ...[...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)],
  ...[...d.matchAll(/A [\d.]+ [\d.]+ 0 [01] [01] (-?[\d.]+) (-?[\d.]+)/g)],
].map(([, x, y]) => [+x, +y]);

const inset = g.insetSegmentPath(50, 50, 49, 0, 6, 5);

// Every point of the marker must sit inside the dial's own radius, and none
// of them on the centre: a marker touching either edge is not inset.
const radii = points(inset).map(([x, y]) => Math.hypot(x - 50, y - 50));
check("marker stays inside the rim", radii.every((r) => r <= 44.01), true);
check("marker keeps off the centre", radii.every((r) => r >= 10), true);

// The wedge it belongs to runs 0-60deg; the marker must sit strictly within
// those bounds, or it would bleed into the neighbouring segment.
const angles = points(inset).map(([x, y]) => {
  const deg = (Math.atan2(y - 50, x - 50) * 180) / Math.PI + 90;
  return (deg + 360) % 360;
});
check("marker stays within its wedge", angles.every((a) => a > 0 && a < 60), true);

// A single-segment dial is a ring: there are no radial edges to pull away
// from, so the marker is simply a smaller circle.
const ring = g.insetSegmentPath(50, 50, 49, 0, 1, 5);
check("a whole-circle marker uses two arcs", (ring.match(/A /g) || []).length, 2);

// --- sizes and trimming ---------------------------------------------------
check("offered sizes", [...SIZES], [4, 6, 8, 10, 12]);

const five = ["a", "b", "c", "d", "e"];
check("trim drops the overflow", trimToSize(five, 4), ["a", "b", "c", "d"]);
check("trim keeps the earliest slices", trimToSize(five, 2), ["a", "b"]);
check("a fitting dial is untouched", trimToSize(five, 6) === five, true);
check("an exact fit is untouched", trimToSize(five, 5) === five, true);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
