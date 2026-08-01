import { moduleId } from "../../constants";

export const SETTING_SIDEBAR_TAB = "sidebarTabEnabled";

// Whether dials get a root sidebar tab of their own. The combat tracker holds
// them during a fight; a table whose dials are all combat-scoped has no use for
// a second home and would rather have the sidebar space back.
export function registerSidebarSettings(): void {
  (game as any).settings.register(moduleId, SETTING_SIDEBAR_TAB, {
    name: "SLICEDDIALS.Settings.sidebarTab.name",
    hint: "SLICEDDIALS.Settings.sidebarTab.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    // The tab is claimed at init, before any setting can be read again: there
    // is no way to add or remove one on a running client.
    requiresReload: true,
  });
}

export const isSidebarTabEnabled = (): boolean =>
  (game as any).settings?.get(moduleId, SETTING_SIDEBAR_TAB) !== false;
