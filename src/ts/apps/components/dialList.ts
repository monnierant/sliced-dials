import { dialType, intentHook } from "../../constants";
import { renderDial } from "./renderDial";
import { openSlicePicker } from "./slicePicker";

// The list of dials, drawn once and mounted wherever it is needed: the panel,
// the sidebar, and any system sheet embedding its own. Three lookalike
// implementations would drift, and the anonymising rule below is exactly the
// kind of thing that must not.

export interface DialListOptions {
  /** Allow placing slices. A read-only list still shows everything. */
  interactive?: boolean;
}

function escape(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Dials a user may know about at all, from any collection. */
export function dialsOf(source: any): any[] {
  const user = (game as any).user;
  const items = source?.items ?? source ?? [];

  return [...items]
    .filter(
      (item: any) =>
        item.type === dialType && item.testUserPermission(user, "LIMITED")
    )
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export function renderDialList(
  dials: any[],
  options: DialListOptions = {}
): string {
  const user = (game as any).user;

  const entries = dials
    .map((dial: any) => {
      // LIMITED means "something is ticking, but not what": the most tense
      // state available, and the one that must never leak a name.
      const anonymous = !dial.testUserPermission(user, "OBSERVER");
      const label = anonymous ? "&mdash;" : escape(dial.name);

      const interactive =
        options.interactive !== false &&
        dial.isOwner &&
        !dial.system.locked &&
        !anonymous;

      return (
        `<li class="sd-hud-dial" data-dial-id="${dial.id}">` +
        renderDial(dial, {
          interactive,
          anonymous,
          // Only handed over when the viewer is allowed the name; otherwise it
          // would sit in the accessibility tree, unseen and read aloud.
          label: anonymous ? undefined : dial.name,
        }) +
        `<div class="sd-hud-label">${label}</div>` +
        `</li>`
      );
    })
    .join("");

  return `<ul class="sd-hud-list">${entries}</ul>`;
}

/**
 * Wires segment clicks. A system that handles the intent hook returns false -
 * the Foundry convention for taking over - debits its own economy and calls
 * addSlice itself; otherwise the module asks which slice to place.
 */
export function activateDialList(root: HTMLElement, source?: any): void {
  root.querySelectorAll<SVGPathElement>(".sd-segment").forEach((segment) => {
    segment.addEventListener("click", () => {
      const host = segment.closest<HTMLElement>(".sd-hud-dial");
      const id = host?.dataset.dialId;
      if (!id) return;

      // Embedded dials live on their parent, not in the world collection, so
      // the caller's source is tried first.
      const dial = source?.items?.get(id) ?? (game as any).items?.get(id);
      if (!dial?.isOwner || dial.system.locked) return;

      const index = Number(segment.dataset.index);
      if (Hooks.call(intentHook, dial, index) === false) return;

      void openSlicePicker(dial);
    });
  });
}

/**
 * One call for a system embedding dials in its own sheet: renders whatever the
 * document holds and wires it. Re-entrant, so it can be called on every sheet
 * render without piling listeners onto stale nodes.
 */
export function mountDials(
  container: HTMLElement,
  source: any,
  options: DialListOptions = {}
): void {
  container.innerHTML = renderDialList(dialsOf(source), options);
  if (options.interactive !== false) activateDialList(container, source);
}
