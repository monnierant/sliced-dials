import { dialType } from "../constants";
import {
  activateDialList,
  dialsOf,
  renderDialList,
} from "./components/dialList";
import { broadcast, onSocket } from "./sockets";
import { filterCombatDials } from "./combat/combatFilter";

const ApplicationV2 = (foundry as any).applications.api.ApplicationV2;

// The dials at full size, in a window you can move and close. The panel is for
// glancing at; this is for the moment everyone stops and looks - which is also
// why the GM can put it on everyone's screen at once.
export default class DialsPopup extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "sliced-dials-popup",
    classes: ["sliced-dials", "sliced-dials-popup"],
    position: { width: 480, height: "auto" as const },
    window: { title: "SLICEDDIALS.Sidebar.title", resizable: true },
  };

  static #instance: DialsPopup | null = null;

  static get instance(): DialsPopup {
    DialsPopup.#instance ??= new DialsPopup();
    return DialsPopup.#instance;
  }

  async _renderHTML(): Promise<string> {
    // Each client draws its own: the same window on two screens must not show
    // one person's dials to the other.
    const dials = filterCombatDials(dialsOf((game as any).items));

    const body =
      dials.length === 0
        ? `<p class="sd-popup-empty">${
        (game as any).i18n?.localize("SLICEDDIALS.Sidebar.empty") ?? ""
          }</p>`
        : `<div class="sd-popup-body">${renderDialList(dials, {
            controls: true,
          })}</div>`;

    return `<div class="sd-popup-shell">${body}</div>`;
  }

  _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
    activateDialList(content);
  }
}

/** Opens it here. */
export function openDialsPopup(): void {
  DialsPopup.instance.render(true);
}

/** Opens it here and on every other connected client. */
export function showDialsToAll(): void {
  openDialsPopup();
  broadcast({ action: "showDials" });
}

export function registerPopup(): void {
  onSocket((message) => {
    if (message.action !== "showDials") return;
    // A player with nothing to see gets no empty window pushed at them.
    if (filterCombatDials(dialsOf((game as any).items)).length === 0) return;
    openDialsPopup();
  });

  // An open window must not go stale while a dial fills behind it.
  const refresh = (document: any) => {
    if (document?.type !== dialType) return;
    if (DialsPopup.instance.rendered) DialsPopup.instance.render(false);
  };

  Hooks.on("createItem", refresh);
  Hooks.on("updateItem", refresh);
  Hooks.on("deleteItem", refresh);
}
