import { dialType, moduleId } from "../../constants";
import {
  activateDialList,
  dialsOf,
  renderDialList,
} from "../components/dialList";
import {
  clampToViewport,
  getPosition,
  isCollapsed,
  isHudEnabled,
  registerHudSettings,
  setCollapsed,
  setHudEnabled,
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

  async _renderHTML(): Promise<string> {
    if (!isHudEnabled()) return "";

    const dials = dialsOf((game as any).items);
    if (dials.length === 0) return "";

    // Folding leaves the grip bar behind rather than everything: a panel that
    // can vanish with no handle left is a panel you cannot get back. The cross
    // beside it is the deliberate version of that - it does make the panel
    // vanish, and its tooltip says where to find it again.
    const collapsed = isCollapsed();
    const label = (key: string) =>
      (game as any).i18n?.localize(`SLICEDDIALS.Hud.${key}`) ?? key;

    const header =
      `<div class="sd-hud-header">` +
      `<i class="sd-hud-grip fa-solid fa-grip-lines" ` +
      `title="${label("drag")}"></i>` +
      `<span class="sd-hud-count">${dials.length}</span>` +
      `<button type="button" class="sd-hud-fold" title="${label("fold")}" ` +
      `aria-label="${label("fold")}">` +
      `<i class="fa-solid fa-chevron-${collapsed ? "down" : "up"}"></i>` +
      `</button>` +
      `<button type="button" class="sd-hud-close" title="${label("close")}" ` +
      `aria-label="${label("close")}">` +
      `<i class="fa-solid fa-xmark"></i>` +
      `</button></div>`;

    if (collapsed) return header;

    return header + renderDialList(dials, { controls: true });
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

    // The setting's own onChange does the redraw, so this only has to flip it.
    root
      .querySelector<HTMLButtonElement>(".sd-hud-close")
      ?.addEventListener("click", () => void setHudEnabled(false));

    activateDialList(root);
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
