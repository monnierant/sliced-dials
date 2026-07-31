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
