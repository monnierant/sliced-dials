import { addSlice, canAddSlice } from "../../api";
import { dialType, intentHook, moduleId } from "../../constants";
import { getRuleset } from "../../registry";
import { Sign, Slice } from "../../types";
import { renderDial } from "../components/renderDial";

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

  /** Segment awaiting a choice of slice, if the picker is open. */
  #pending: { dialId: string; index: number } | null = null;

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
    const dials = this.#visibleDials();

    if (dials.length === 0) return "";

    const body = dials
      .map((dial: any) => {
        // LIMITED means "something is ticking, but not what": the most tense
        // state available, and the one that must never leak a name.
        const anonymous = !dial.testUserPermission(user, "OBSERVER");
        const label = anonymous
          ? "&mdash;"
          : `${dial.name} ${dial.system.value}/${dial.system.size}`;

        const interactive = dial.isOwner && !dial.system.locked && !anonymous;

        return (
          `<li class="sd-hud-dial" data-dial-id="${dial.id}">` +
          `<div class="sd-hud-label">${label}</div>` +
          renderDial(dial, { interactive }) +
          this.#renderPicker(dial) +
          `</li>`
        );
      })
      .join("");

    return `<ul class="sd-hud-list">${body}</ul>`;
  }

  #renderPicker(dial: any): string {
    if (this.#pending?.dialId !== dial.id) return "";

    const ruleset = getRuleset(dial.system.ruleset);
    const allowed: string[] =
      dial.system.allowedCategories.length > 0
        ? dial.system.allowedCategories
        : Object.keys(ruleset?.categories ?? {});

    if (allowed.length === 0) return "";

    const signs: Sign[] = dial.system.allowedSigns;

    const buttons = signs
      .flatMap((sign) =>
        allowed.map((category) => {
          const label = ruleset?.categories[category]?.label ?? category;
          const colour = ruleset?.categories[category]?.color ?? "#7a7a7a";
          // The same predicate that refuses the write decides what is offered,
          // so nothing can be offered and then rejected.
          const verdict = canAddSlice(dial, {
            sign,
            category,
            userId: (game as any).user?.id ?? "",
            at: Date.now(),
          } as Slice);

          return (
            `<button type="button" class="sd-pick" data-sign="${sign}" ` +
            `data-category="${category}" style="border-color:${colour}" ` +
            `${verdict.ok ? "" : `disabled title="${verdict.reason ?? ""}"`}>` +
            `${sign}${label}</button>`
          );
        })
      )
      .join("");

    return `<div class="sd-hud-picker">${buttons}</div>`;
  }

  _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
    content.classList.toggle("sd-hud-empty", result === "");
    this.#activate(content);
  }

  #activate(root: HTMLElement): void {
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

        this.#pending = { dialId: dial.id, index };
        this.render();
      });
    });

    root.querySelectorAll<HTMLButtonElement>(".sd-pick").forEach((button) => {
      button.addEventListener("click", async () => {
        const host = button.closest<HTMLElement>(".sd-hud-dial");
        const dial = (game as any).items?.get(host?.dataset.dialId);
        if (!dial) return;

        const verdict = await addSlice(dial, {
          sign: button.dataset.sign as Sign,
          category: button.dataset.category!,
        });
        if (!verdict.ok) ui.notifications?.warn(verdict.reason ?? "Refused");

        this.#pending = null;
        this.render();
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
  const refresh = (document: any) => {
    if (document?.type === dialType) DialsHud.instance.render(true);
  };

  Hooks.on("createItem", refresh);
  Hooks.on("updateItem", refresh);
  Hooks.on("deleteItem", refresh);

  Hooks.once("ready", () => {
    DialsHud.instance.render(true);
    console.log(`${moduleId} | HUD ready`);
  });
}
