import { dialType, moduleId, packagePath } from "../../constants";
import { renderDial } from "../components/renderDial";

const { HandlebarsApplicationMixin } = (foundry as any).applications.api;
const sidebar = (foundry as any).applications?.sidebar;
const AbstractSidebarTab = sidebar?.AbstractSidebarTab;

export const TAB_NAME = "sliced-dials";

// A dedicated tab rather than a filter over the Items tab: dials are the GM's
// working set during a fight, and having them mixed in with the system's gear
// defeats the point of pinning them somewhere.
export default class DialsDirectory extends HandlebarsApplicationMixin(
  AbstractSidebarTab ?? class {}
) {
  static tabName = TAB_NAME;

  static DEFAULT_OPTIONS = {
    id: "sliced-dials-directory",
    classes: ["sliced-dials", "sliced-dials-directory"],
    window: { title: "SLICEDDIALS.Sidebar.title" },
    actions: {
      create: DialsDirectory.#onCreate,
      open: DialsDirectory.#onOpen,
    },
  };

  static PARTS = {
    body: { template: `${packagePath}/templates/sidebar/dials.hbs` },
  };

  async _prepareContext(): Promise<any> {
    const user = (game as any).user;

    const dials = ((game as any).items ?? [])
      .filter(
        (item: any) =>
          item.type === dialType && item.testUserPermission(user, "LIMITED")
      )
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return {
      isGM: user?.isGM === true,
      empty: dials.length === 0,
      dials: dials.map((dial: any) => {
        // Same anonymising rule as the HUD: LIMITED must never leak a name.
        const anonymous = !dial.testUserPermission(user, "OBSERVER");
        return {
          id: dial.id,
          name: anonymous ? "—" : dial.name,
          anonymous,
          count: `${dial.system.value}/${dial.system.size}`,
          locked: dial.system.locked,
          svg: renderDial(dial, { interactive: false }),
        };
      }),
    };
  }

  static async #onCreate(): Promise<void> {
    const dial = await (Item as any).create({
      name: (game as any).i18n?.localize("SLICEDDIALS.Sidebar.newDial") ?? "Dial",
      type: dialType,
    });
    dial?.sheet?.render(true);
  }

  static #onOpen(_event: Event, target: HTMLElement): void {
    const dial = (game as any).items?.get(target.dataset.dialId);
    dial?.sheet?.render(true);
  }
}

export function registerSidebarTab(): void {
  const Sidebar = sidebar?.Sidebar;

  // Registering a sidebar tab is not a documented extension point, so this
  // fails loudly-but-harmlessly rather than taking the module down with it.
  if (!AbstractSidebarTab || !Sidebar?.TABS) {
    console.warn(
      `${moduleId} | this Foundry version exposes no sidebar tab registry; ` +
        `dials remain available in the Items tab and in the panel.`
    );
    return;
  }

  Sidebar.TABS[TAB_NAME] = {
    tooltip: "SLICEDDIALS.Sidebar.title",
    icon: "fa-solid fa-chart-pie",
  };
  (CONFIG as any).ui[TAB_NAME] = DialsDirectory;

  const refresh = (document: any) => {
    if (document?.type === dialType) (ui as any)[TAB_NAME]?.render(false);
  };

  Hooks.on("createItem", refresh);
  Hooks.on("updateItem", refresh);
  Hooks.on("deleteItem", refresh);
}
