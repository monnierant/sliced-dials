// Reads the registry directly rather than going through the API: the API
// exposes this component, so importing it back would close a cycle.
import { getRuleset } from "../../registry";
import { Category, Slice } from "../../types";
import { insetSegmentPath, segments } from "./dialGeometry";

const categoryOf = (dial: any, key: string): Category | undefined =>
  getRuleset(dial?.system?.ruleset)?.categories[key];

const colourOf = (dial: any, key: string): string => {
  const ruleset = getRuleset(dial?.system?.ruleset);
  if (ruleset?.mode === "counter" && dial?.system?.color) {
    return dial.system.color;
  }
  return ruleset?.categories[key]?.color ?? FALLBACK_FILL;
};

// One component, instantiated everywhere a dial is drawn - HUD, sheet partial,
// sidebar. Three lookalike templates would drift; this one cannot.

const SIZE = 100;
const CENTRE = SIZE / 2;
const RADIUS = CENTRE - 1;

// A mid grey rather than a translucent black or white: the same dial is drawn
// on a dark HUD and on a light sheet, and either extreme disappears against one
// of them.
const EMPTY_FILL = "rgba(105, 105, 105, 0.6)";
const FALLBACK_FILL = "#7a7a7a";

// How far the reserved marker sits inside its wedge. Enough that the grey slot
// is still read as the slot, and that the marker's own thick outline has room
// to be seen as an outline rather than as a fill.
const INSET = 5;

// Dial names and category labels are user input and land in markup.
function escape(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sliceTitle(dial: any, slice: Slice): string {
  const label = categoryOf(dial, slice.category)?.label ?? slice.category;
  const who = (game as any).users?.get(slice.userId)?.name ?? "";
  return escape([`${slice.sign}1 ${label}`, who].filter(Boolean).join(" - "));
}

/**
 * Names the category a dial has to be closed with. Falls back to the raw key
 * exactly as `sliceTitle` does: a category the ruleset does not define is drawn
 * and named the same way whether it has been placed or is merely awaited.
 */
function closingTitle(dial: any, category: string): string {
  const label = categoryOf(dial, category)?.label ?? category;
  const i18n = (game as any).i18n;

  return (
    i18n?.format?.("SLICEDDIALS.Dial.closedBy", { category: label }) ??
    `Closed by ${label}`
  );
}

/**
 * What the dial *is* - an objective, a threat, or neither. Its own field, and
 * not read off `allowedSigns`: that one says what may be placed, which is a
 * different question. A threat can perfectly well accept positive slices.
 */
function toneOf(dial: any): string {
  return dial?.system?.tone ?? "neutral";
}

function toneLabel(tone: string): string {
  const i18n = (game as any).i18n;
  const key = `SLICEDDIALS.Dial.tone_${tone}`;
  const text = i18n?.localize?.(key);
  return text && text !== key ? text : "";
}

/**
 * Negative slices must not be told apart by colour alone: categories are
 * already colour-coded, and colour-blind players would lose the distinction
 * entirely. They carry hatching on top of their category colour.
 */
function hatchDefs(patternId: string): string {
  return (
    `<defs><pattern id="${patternId}" width="6" height="6" ` +
    `patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.55)" ` +
    `stroke-width="3"/></pattern></defs>`
  );
}

export interface RenderDialOptions {
  interactive?: boolean;
  /**
   * Accessible name for the drawing. Deliberately NOT defaulted to the dial's
   * own name: a dial the viewer only holds at LIMITED must not put that name in
   * the accessibility tree, where it is invisible on screen and read aloud by a
   * screen reader. Callers that know the viewer may see it pass it in.
   */
  label?: string;
  /**
   * Suppresses the per-slice tooltips. They name the category and the player
   * who placed it, which is the same leak as the label by another route.
   */
  anonymous?: boolean;
}

export function renderDial(dial: any, options: RenderDialOptions = {}) {
  const system = dial.system;
  const total: number = system.size;
  const slices: Slice[] = system.slices;

  // Scoped to the document so several dials on one page cannot share - and
  // clobber - each other's pattern.
  const patternId = `sd-hatch-${dial.id}`;

  // A dial that must be closed with one category says so from its first slice
  // on: knowing how a threat ends changes what you spend on it long before the
  // rule starts refusing anything. Drawn on the segment the rule is about -
  // always the wedge left of twelve - rather than on the rim, which would say
  // that the dial is constrained without saying where.
  const closing: string = system.closingCategory ?? "";
  const reserved = closing ? total - 1 : -1;
  const closingText = closing ? closingTitle(dial, closing) : "";

  const wedges = segments(CENTRE, CENTRE, RADIUS, total)
    .map(({ index, d }) => {
      const slice = slices[index];

      if (!slice) {
        if (index !== reserved) {
          return (
            `<path class="sd-segment sd-segment--empty" d="${d}" ` +
            `fill="${EMPTY_FILL}" data-index="${index}"></path>`
          );
        }

        // Clicking any empty wedge places the next slice, not the one clicked.
        // Everywhere else that is harmless; here a wedge singled out by colour
        // invites the click that would place the wrong slice, so it stops
        // answering until it really is the next one. The hover feedback goes
        // with it: a dead wedge that lights up is a lying button.
        const inert = (system.free ?? 1) > 1 ? " sd-segment--inert" : "";
        const tint = colourOf(dial, closing);

        return (
          `<path class="sd-segment sd-segment--empty sd-segment--reserved` +
          `${inert}" d="${d}" fill="${EMPTY_FILL}" data-index="${index}">` +
          (options.anonymous ? "" : `<title>${escape(closingText)}</title>`) +
          `</path>` +
          // A wedge drawn inside the wedge, not a wash over it: the grey slot
          // underneath keeps saying "nothing here yet", and the shape sitting
          // in it - outlined, dashed, barely filled - says what is expected
          // rather than what is there.
          `<path class="sd-segment-reserved-mark" ` +
          `d="${insetSegmentPath(CENTRE, CENTRE, RADIUS, index, total, INSET)}" ` +
          `fill="${tint}" stroke="${tint}"></path>`
        );
      }

      const colour = colourOf(dial, slice.category);
      const hatch =
        slice.sign === "-"
          ? `<path class="sd-segment-hatch" d="${d}" fill="url(#${patternId})"></path>`
          : "";

      const title = options.anonymous
        ? ""
        : `<title>${sliceTitle(dial, slice)}</title>`;

      return (
        `<path class="sd-segment sd-segment--filled" d="${d}" ` +
        `fill="${colour}" data-index="${index}">` +
        `${title}</path>${hatch}`
      );
    })
    .join("");

  const tone = toneOf(dial);

  const classes = [
    "sd-dial",
    `sd-dial--${tone}`,
    system.locked ? "sd-dial--locked" : "",
    options.interactive ? "sd-dial--interactive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ariaLabel = [
    options.label,
    `${system.value}/${total}`,
    // The rim carries the tone in colour, which is exactly what a screen reader
    // cannot pass on. Said unconditionally: it is a property of the dial's
    // shape, like its size, and names neither a category nor a player.
    toneLabel(tone),
    // The tint is the only thing that carries this on screen, and colour is
    // exactly what a screen reader cannot pass on. Withheld under the same
    // rule as the slice tooltips.
    options.anonymous ? "" : closingText,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    `<svg class="${classes}" viewBox="0 0 ${SIZE} ${SIZE}" ` +
    `role="img" aria-label="${escape(ariaLabel)}" ` +
    `data-dial-id="${dial.id}">` +
    hatchDefs(patternId) +
    wedges +
    // Drawn last so it rides over every wedge edge: without it, an empty dial
    // has no outline at all and reads as a smudge rather than as a dial.
    `<circle class="sd-dial-rim" cx="${CENTRE}" cy="${CENTRE}" r="${RADIUS}" ` +
    `fill="none"></circle>` +
    `</svg>`
  );
}

/**
 * Binds clicks on segments. The caller decides what a click means - this
 * component never writes anything itself.
 */
export function activateDialListeners(
  root: HTMLElement,
  onSegmentClick: (index: number) => void
): void {
  root.querySelectorAll<SVGPathElement>(".sd-segment").forEach((segment) => {
    segment.addEventListener("click", () => {
      const index = Number(segment.dataset.index);
      if (!Number.isNaN(index)) onSegmentClick(index);
    });
  });
}
