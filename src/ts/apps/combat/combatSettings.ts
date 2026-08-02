import { moduleId } from "../../constants";

export const SETTING_TRACKER_MODE = "trackerMode";

// Some tables never roll initiative - Cowboy Bebop is one - and for them the
// encounter half of the tracker is dead weight in front of the dials. World
// scope: this is how the table plays, not a per-person preference.
export function registerCombatSettings(): void {
  (game as any).settings.register(moduleId, SETTING_TRACKER_MODE, {
    name: "SLICEDDIALS.Settings.trackerMode.name",
    hint: "SLICEDDIALS.Settings.trackerMode.hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      tabs: "SLICEDDIALS.Settings.trackerMode_tabs",
      dialsOnly: "SLICEDDIALS.Settings.trackerMode_dialsOnly",
    },
    default: "tabs",
    onChange: () => (ui as any).combat?.render(false),
  });
}

export const isDialsOnly = (): boolean =>
  (game as any).settings?.get(moduleId, SETTING_TRACKER_MODE) === "dialsOnly";
