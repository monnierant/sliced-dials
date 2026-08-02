// Pure geometry for a dial: no Foundry, no DOM, no module state. Kept separate
// precisely so it can be checked on its own - it is the only part of this
// module that can be verified without a running world.

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  index: number;
  /** SVG path data for the wedge. */
  d: string;
}

/** Rounded to keep the emitted markup readable and diffable. */
const round = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Angles are measured clockwise from twelve o'clock, which is where a dial is
 * read from. SVG's own zero is at three o'clock, hence the -90 offset.
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDegrees: number
): Point {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: round(cx + radius * Math.cos(radians)),
    y: round(cy + radius * Math.sin(radians)),
  };
}

/**
 * One wedge of a dial cut into `total` equal segments.
 *
 * Every segment is the same size: a slice is always worth exactly one segment,
 * so what the dial draws is always exactly what was placed.
 */
export function segmentPath(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  total: number
): string {
  const sweep = 360 / total;
  const start = index * sweep;
  const end = start + sweep;

  const from = polarToCartesian(cx, cy, radius, start);
  const to = polarToCartesian(cx, cy, radius, end);

  // A single-segment dial is a full circle, which no single arc can express:
  // two half arcs are needed, otherwise start and end coincide and nothing is
  // drawn at all.
  if (total === 1) {
    const half = polarToCartesian(cx, cy, radius, 180);
    return (
      `M ${from.x} ${from.y} ` +
      `A ${radius} ${radius} 0 1 1 ${half.x} ${half.y} ` +
      `A ${radius} ${radius} 0 1 1 ${from.x} ${from.y} Z`
    );
  }

  const largeArc = sweep > 180 ? 1 : 0;

  return (
    `M ${cx} ${cy} ` +
    `L ${from.x} ${from.y} ` +
    `A ${radius} ${radius} 0 ${largeArc} 1 ${to.x} ${to.y} Z`
  );
}

/**
 * The same wedge, pulled in by `inset` on all four sides: both radial edges,
 * the arc, and the point at the centre. Used to draw a marker *inside* a
 * segment without touching the segment itself, so the wedge underneath keeps
 * saying what it says.
 *
 * The angular pull-in is computed per radius rather than once: a fixed angle
 * would leave a hairline gap near the centre and a wide one at the rim, which
 * is the same wedge drawn crooked.
 */
export function insetSegmentPath(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  total: number,
  inset: number
): string {
  const outer = radius - inset;

  // The blunt tip. A true point cannot be inset - it has no width to take it
  // from - and a thick stroke would collapse into a blob there anyway.
  const innerRadius = Math.max(inset * 2, radius * 0.22);

  // A single segment has no radial edges to pull away from: it is a ring, and
  // pulling it in is simply a smaller circle.
  if (total === 1) {
    const top = polarToCartesian(cx, cy, outer, 0);
    const bottom = polarToCartesian(cx, cy, outer, 180);
    return (
      `M ${top.x} ${top.y} ` +
      `A ${outer} ${outer} 0 1 1 ${bottom.x} ${bottom.y} ` +
      `A ${outer} ${outer} 0 1 1 ${top.x} ${top.y} Z`
    );
  }

  const sweep = 360 / total;
  const start = index * sweep;
  const end = start + sweep;

  // Arc length over radius, in degrees: the angle that puts a point `inset`
  // away from the edge at that radius.
  const angleFor = (r: number): number =>
    Math.min((inset / r) * (180 / Math.PI), sweep * 0.4);

  const outerAngle = angleFor(outer);
  const innerAngle = angleFor(innerRadius);

  const a = polarToCartesian(cx, cy, innerRadius, start + innerAngle);
  const b = polarToCartesian(cx, cy, outer, start + outerAngle);
  const c = polarToCartesian(cx, cy, outer, end - outerAngle);
  const d = polarToCartesian(cx, cy, innerRadius, end - innerAngle);

  const largeOuter = sweep - 2 * outerAngle > 180 ? 1 : 0;
  const largeInner = sweep - 2 * innerAngle > 180 ? 1 : 0;

  return (
    `M ${a.x} ${a.y} ` +
    `L ${b.x} ${b.y} ` +
    `A ${round(outer)} ${round(outer)} 0 ${largeOuter} 1 ${c.x} ${c.y} ` +
    `L ${d.x} ${d.y} ` +
    // Back along the inner arc, hence the reversed sweep flag.
    `A ${round(innerRadius)} ${round(innerRadius)} 0 ${largeInner} 0 ` +
    `${a.x} ${a.y} Z`
  );
}

export function segments(
  cx: number,
  cy: number,
  radius: number,
  total: number
): Segment[] {
  return Array.from({ length: total }, (_, index) => ({
    index,
    d: segmentPath(cx, cy, radius, index, total),
  }));
}
