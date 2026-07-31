import * as g from "./.out/dialGeometry.js";

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

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
