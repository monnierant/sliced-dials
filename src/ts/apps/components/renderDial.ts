// Reads the registry directly rather than going through the API: the API
// exposes this component, so importing it back would close a cycle.
import { getRuleset } from "../../registry";
import { Category, Slice } from "../../types";
import { segments } from "./dialGeometry";

const categoryOf = (dial: any, key: string): Category | undefined =>
  getRuleset(dial?.system?.ruleset)?.categories[key];

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

export function renderDial(dial: any, options: { interactive?: boolean } = {}) {
  const system = dial.system;
  const total: number = system.size;
  const slices: Slice[] = system.slices;

  // Scoped to the document so several dials on one page cannot share - and
  // clobber - each other's pattern.
  const patternId = `sd-hatch-${dial.id}`;

  const wedges = segments(CENTRE, CENTRE, RADIUS, total)
    .map(({ index, d }) => {
      const slice = slices[index];

      if (!slice) {
        return (
          `<path class="sd-segment sd-segment--empty" d="${d}" ` +
          `fill="${EMPTY_FILL}" data-index="${index}"></path>`
        );
      }

      const colour =
        categoryOf(dial, slice.category)?.color ?? FALLBACK_FILL;
      const hatch =
        slice.sign === "-"
          ? `<path class="sd-segment-hatch" d="${d}" fill="url(#${patternId})"></path>`
          : "";

      return (
        `<path class="sd-segment sd-segment--filled" d="${d}" ` +
        `fill="${colour}" data-index="${index}">` +
        `<title>${sliceTitle(dial, slice)}</title></path>${hatch}`
      );
    })
    .join("");

  const classes = [
    "sd-dial",
    system.locked ? "sd-dial--locked" : "",
    options.interactive ? "sd-dial--interactive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    `<svg class="${classes}" viewBox="0 0 ${SIZE} ${SIZE}" ` +
    `role="img" aria-label="${escape(dial.name)} ${system.value}/${total}" ` +
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
