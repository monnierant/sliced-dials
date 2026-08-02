import { dialType, intentHook } from "../../constants";
import { DialState } from "../../types";
import { removeLastSlice, setState } from "../../slices";
import { renderDial } from "./renderDial";
import { openSlicePicker } from "./slicePicker";

// The list of dials, drawn once and mounted wherever it is needed: the panel,
// the sidebar, and any system sheet embedding its own. Three lookalike
// implementations would drift, and the anonymising rule below is exactly the
// kind of thing that must not.

export interface DialListOptions {
  /** Allow placing slices. A read-only list still shows everything. */
  interactive?: boolean;
  /** Draw the GM's per-dial controls - currently the reveal eye. */
  controls?: boolean;
  /** Which states to include. See `DialsOfOptions`; defaults to `play`. */
  states?: "play" | "all";
  /**
   * Run after every draw, including the redraws that follow a dial changing.
   * A caller with something of its own to say about the list - an empty-state
   * message, a decoration - has to say it again each time, and this is where.
   */
  onRender?: (container: HTMLElement) => void;
}

export interface DialsOfOptions {
  /**
   * `play` - the surfaces a dial is *in play* on: the tracker, the panel, a
   * system's own sheet. Prepared dials are left out and hidden ones are the
   * GM's alone.
   *
   * `all` - everything the viewer may know about, whatever its state. The
   * directory uses this, because preparing a dial is what it is for.
   */
  states?: "play" | "all";
}

const isGM = (): boolean => (game as any).user?.isGM === true;

/**
 * The state gate. Ownership is the other one, and both have to pass: a state
 * says whether a dial is on a surface at all, ownership says how much of it the
 * viewer gets once it is.
 */
function inPlay(dial: any): boolean {
  switch (dial.system?.state ?? "active") {
    case "active":
      return true;
    case "hidden":
      return isGM();
    default:
      return false;
  }
}

function escape(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Dials a user may know about at all, from any collection. */
export function dialsOf(source: any, options: DialsOfOptions = {}): any[] {
  const user = (game as any).user;
  const items = source?.items ?? source ?? [];
  const everything = options.states === "all";

  return [...items]
    .filter(
      (item: any) =>
        item.type === dialType &&
        item.testUserPermission(user, "LIMITED") &&
        (everything || inPlay(item))
    )
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

/**
 * The GM's one-click switch between a dial the table can see and one only they
 * can. Bringing a prepared dial into play is a rarer, more deliberate act and
 * stays on the sheet.
 */
function eye(hidden: boolean): string {
  const key = hidden ? "reveal" : "conceal";
  const title = escape(
    (game as any).i18n?.localize(`SLICEDDIALS.Sidebar.${key}`) ?? key
  );

  return (
    `<button type="button" class="sd-eye" title="${title}" ` +
    `aria-label="${title}" data-next="${hidden ? "active" : "hidden"}">` +
    `<i class="fa-solid fa-eye${hidden ? "-slash" : ""}"></i></button>`
  );
}

function undo(disabled: boolean): string {
  const title = escape(
    (game as any).i18n?.localize("SLICEDDIALS.Sheet.removeLastSlice") ??
      "Remove last slice"
  );

  return (
    `<button type="button" class="sd-undo" title="${title}" ` +
    `aria-label="${title}"${disabled ? " disabled" : ""}>` +
    `<i class="fa-solid fa-rotate-left"></i></button>`
  );
}

/**
 * The sheet is otherwise only reachable by right-click, which is a gesture
 * nothing on screen advertises. The GM edits dials often enough to deserve a
 * button next to the two that are already there.
 */
function edit(): string {
  const title = escape(
    (game as any).i18n?.localize("SLICEDDIALS.Sidebar.edit") ?? "Edit dial"
  );

  return (
    `<button type="button" class="sd-edit" title="${title}" ` +
    `aria-label="${title}"><i class="fa-solid fa-pencil"></i></button>`
  );
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

      const hidden = dial.system?.state === "hidden";
      const controls =
        options.controls && isGM()
          ? `<div class="sd-dial-controls">${eye(hidden)}${undo(
              dial.system.slices.length === 0
            )}${edit()}</div>`
          : "";

      return (
        `<li class="sd-hud-dial${hidden ? " sd-dial-hidden" : ""}" ` +
        `data-dial-id="${dial.id}">` +
        controls +
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
  const find = (host: HTMLElement | null): any => {
    const id = host?.dataset.dialId;
    if (!id) return undefined;
    // Embedded dials live on their parent, not in the world collection, so
    // the caller's source is tried first.
    return source?.items?.get(id) ?? (game as any).items?.get(id);
  };

  root.querySelectorAll<HTMLElement>(".sd-eye").forEach((button) => {
    button.addEventListener("click", (event) => {
      // The eye sits on top of the dial; without this the click would fall
      // through and try to place a slice.
      event.stopPropagation();
      const dial = find(button.closest<HTMLElement>(".sd-hud-dial"));
      if (dial) void setState(dial, button.dataset.next as DialState);
    });
  });

  root.querySelectorAll<HTMLButtonElement>(".sd-undo").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const dial = find(button.closest<HTMLElement>(".sd-hud-dial"));
      if (dial) void removeLastSlice(dial);
    });
  });

  root.querySelectorAll<HTMLElement>(".sd-edit").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const dial = find(button.closest<HTMLElement>(".sd-hud-dial"));
      if (dial?.isOwner) dial.sheet?.render(true);
    });
  });

  root.querySelectorAll<SVGPathElement>(".sd-segment").forEach((segment) => {
    segment.addEventListener("click", () => {
      const dial = find(segment.closest<HTMLElement>(".sd-hud-dial"));
      if (!dial?.isOwner || dial.system.locked) return;

      const index = Number(segment.dataset.index);
      if (Hooks.call(intentHook, dial, index) === false) return;

      void openSlicePicker(dial);
    });
  });
}

// The Foundry hooks a mounted container is listening on. Keyed by the node, so
// a second mount into the same container replaces its subscription instead of
// adding one - and so a container that is garbage collected takes its entry
// with it.
const watchers = new WeakMap<HTMLElement, Array<[string, number]>>();

function unwatch(container: HTMLElement): void {
  (watchers.get(container) ?? []).forEach(([hook, id]) =>
    Hooks.off(hook as any, id)
  );
  watchers.delete(container);
}

/**
 * Keeps a mounted list truthful. A system's sheet embeds dials that are world
 * documents rather than its own, so Foundry re-renders nothing there when one
 * of them changes: the sheet would go on showing whatever the dials were when
 * it was drawn. Every other surface in this module subscribes for exactly this
 * reason, and a system embedding the list should not have to discover that.
 */
function watch(container: HTMLElement, redraw: () => void): void {
  unwatch(container);

  const refresh = (document: any): void => {
    // The sheet was closed, or re-rendered into a fresh node and this one was
    // thrown away. Nothing left to refresh, and the subscription goes with it.
    if (!container.isConnected) {
      unwatch(container);
      return;
    }

    if (document?.type === dialType) redraw();
  };

  watchers.set(
    container,
    ["createItem", "updateItem", "deleteItem"].map(
      (hook) => [hook, Hooks.on(hook as any, refresh)] as [string, number]
    )
  );
}

/**
 * One call for a system embedding dials in its own sheet: renders whatever the
 * document holds, wires it, and keeps it up to date on its own. Re-entrant, so
 * it can be called on every sheet render without piling listeners onto stale
 * nodes.
 */
export function mountDials(
  container: HTMLElement,
  source: any,
  options: DialListOptions = {}
): void {
  const draw = (): void => {
    container.innerHTML = renderDialList(
      dialsOf(source, { states: options.states }),
      options
    );
    if (options.interactive !== false) activateDialList(container, source);
    options.onRender?.(container);
  };

  watch(container, draw);
  draw();
}
