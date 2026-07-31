import { dialType, intentHook, moduleId } from "../../constants";
import { renderDial } from "../components/renderDial";
import { openSlicePicker } from "../components/slicePicker";
import {
  clampToViewport,
  getPosition,
  isCollapsed,
  isHudEnabled,
  registerHudSettings,
  setCollapsed,
  setPosition,
} from "./hudSettings";

const ApplicationV2 = (foundry as any).applications.api.ApplicationV2;

// A dial only creates tension if it is seen without effort. Behind a window
// nobody opens, "the reinforcements" sitting at 5/6 changes nothing at the
// table - hence an anchored panel rather than an application you summon.
export default class DialsHud extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "sliced-dials-hud",
    classes: ["sliced-dials-hud"],
    window: { frame: false, positioned: false },
    actions: {},
  };

  #observing = false;

  static #instance: DialsHud | null = null;

  static get instance(): DialsHud {
    DialsHud.#instance ??= new DialsHud();
    return DialsHud.#instance;
  }

  /** World dials this user is allowed to know about at all. */
  #visibleDials(): any[] {
    const user = (game as any).user;
    return ((game as any).items ?? [])
      .filter(
        (item: any) =>
          item.type === dialType && item.testUserPermission(user, "LIMITED")
      )
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }

  async _renderHTML(): Promise<string> {
    const user = (game as any).user;
    if (!isHudEnabled()) return "";

    const dials = this.#visibleDials();
    if (dials.length === 0) return "";

    // Folding leaves the grip bar behind rather than everything: a panel that
    // can vanish with no handle left is a panel you cannot get back.
    const collapsed = isCollapsed();
    const header =
      `<div class="sd-hud-header">` +
      `<i class="sd-hud-grip fa-solid fa-grip-lines" title="Drag"></i>` +
      `<span class="sd-hud-count">${dials.length}</span>` +
      `<button type="button" class="sd-hud-fold" title="Fold">` +
      `<i class="fa-solid fa-chevron-${collapsed ? "down" : "up"}"></i>` +
      `</button></div>`;

    if (collapsed) return header;

    const body = dials
      .map((dial: any) => {
        // LIMITED means "something is ticking, but not what": the most tense
        // state available, and the one that must never leak a name.
        const anonymous = !dial.testUserPermission(user, "OBSERVER");
        const label = anonymous ? "&mdash;" : dial.name;

        const interactive = dial.isOwner && !dial.system.locked && !anonymous;

        // The name sits under the dial: the dial is what the eye goes to, and
        // a caption reads as a caption. No count - the drawing already says
        // how full it is, and a number next to it is just noise.
        return (
          `<li class="sd-hud-dial" data-dial-id="${dial.id}">` +
          renderDial(dial, { interactive }) +
          `<div class="sd-hud-label">${label}</div>` +
          `</li>`
        );
      })
      .join("");

    return `${header}<ul class="sd-hud-list">${body}</ul>`;
  }

  _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
    content.classList.toggle("sd-hud-empty", result === "");
    this.#applyPosition(content);
    this.#activate(content);
  }

  #applyPosition(root: HTMLElement): void {
    const saved = getPosition();
    if (!saved) return;

    const { left, top, width } = clampToViewport(
      saved,
      root.offsetWidth,
      root.offsetHeight
    );

    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    // The default anchoring is right-hand; once dragged, left wins.
    root.style.right = "auto";
    if (width) root.style.width = `${width}px`;
  }

  /**
   * The panel is resized by the browser's own handle, so the width has to be
   * read back afterwards rather than driven by us. Debounced because a resize
   * fires continuously and each save is a settings write.
   */
  #watchResize(root: HTMLElement): void {
    let timer = 0;

    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const box = root.getBoundingClientRect();
        void setPosition(
          clampToViewport(
            { left: box.left, top: box.top, width: box.width },
            root.offsetWidth,
            root.offsetHeight
          )
        );
      }, 400);
    });

    observer.observe(root);
  }

  #activateDrag(root: HTMLElement): void {
    const grip = root.querySelector<HTMLElement>(".sd-hud-grip");
    if (!grip) return;

    grip.addEventListener("pointerdown", (start: PointerEvent) => {
      start.preventDefault();
      const box = root.getBoundingClientRect();
      const offsetX = start.clientX - box.left;
      const offsetY = start.clientY - box.top;

      // Pointer capture keeps the drag alive when the cursor outruns the panel
      // or crosses the canvas, which a plain mousemove listener would not.
      grip.setPointerCapture(start.pointerId);

      const move = (event: PointerEvent) => {
        root.style.left = `${event.clientX - offsetX}px`;
        root.style.top = `${event.clientY - offsetY}px`;
        root.style.right = "auto";
      };

      const stop = async () => {
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", stop);
        grip.releasePointerCapture(start.pointerId);

        const box = root.getBoundingClientRect();
        await setPosition(
          clampToViewport(
            { left: box.left, top: box.top },
            root.offsetWidth,
            root.offsetHeight
          )
        );
      };

      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", stop);
    });
  }

  #activate(root: HTMLElement): void {
    this.#activateDrag(root);

    // Observed once: _replaceHTML runs on every redraw, and a new observer each
    // time would multiply the settings writes.
    if (!this.#observing) {
      this.#observing = true;
      this.#watchResize(root);
    }

    root
      .querySelector<HTMLButtonElement>(".sd-hud-fold")
      ?.addEventListener("click", async () => {
        await setCollapsed(!isCollapsed());
        this.render(true);
      });

    root.querySelectorAll<SVGPathElement>(".sd-segment").forEach((segment) => {
      segment.addEventListener("click", () => {
        const host = segment.closest<HTMLElement>(".sd-hud-dial");
        const dial = (game as any).items?.get(host?.dataset.dialId);
        if (!dial?.isOwner || dial.system.locked) return;

        const index = Number(segment.dataset.index);

        // A system that handles the intent returns false, the Foundry
        // convention for "I am taking over": it debits its own economy and
        // calls addSlice itself. Otherwise the module asks which slice to place
        // - choosing is interaction, not economy.
        const proceed = Hooks.call(intentHook, dial, index);
        if (proceed === false) return;

        void openSlicePicker(dial);
      });
    });
  }
}

/**
 * Keeps the panel truthful. Dials change from many places - another player, the
 * GM, a system calling the API - and a HUD that only redraws on its own actions
 * would quietly go stale.
 */
export function registerHudHooks(): void {
  registerHudSettings();

  const refresh = (document: any) => {
    if (document?.type === dialType) DialsHud.instance.render(true);
  };

  Hooks.on("createItem", refresh);
  Hooks.on("updateItem", refresh);
  Hooks.on("deleteItem", refresh);

  Hooks.once("ready", () => {
    // Published so the enable/disable setting can redraw it without reaching
    // into module internals.
    (ui as any).slicedDialsHud = DialsHud.instance;
    DialsHud.instance.render(true);
    console.log(`${moduleId} | HUD ready`);
  });
}
