import { moduleId } from "../../constants";

export interface HudPosition {
  left: number;
  top: number;
}

export const SETTING_ENABLED = "hudEnabled";
export const SETTING_COLLAPSED = "hudCollapsed";
export const SETTING_POSITION = "hudPosition";

// Where the panel sits and whether it is folded are per-person preferences, not
// world state: two players at the same table want it in different corners.
export function registerHudSettings(): void {
  const settings = (game as any).settings;

  settings.register(moduleId, SETTING_ENABLED, {
    name: "SLICEDDIALS.Settings.hudEnabled.name",
    hint: "SLICEDDIALS.Settings.hudEnabled.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => (ui as any).slicedDialsHud?.render(true),
  });

  settings.register(moduleId, SETTING_COLLAPSED, {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });

  settings.register(moduleId, SETTING_POSITION, {
    scope: "client",
    config: false,
    type: Object,
    default: null,
  });
}

export const isHudEnabled = (): boolean =>
  (game as any).settings?.get(moduleId, SETTING_ENABLED) !== false;

export const isCollapsed = (): boolean =>
  (game as any).settings?.get(moduleId, SETTING_COLLAPSED) === true;

export const setCollapsed = (value: boolean): Promise<unknown> =>
  (game as any).settings.set(moduleId, SETTING_COLLAPSED, value);

export const getPosition = (): HudPosition | null =>
  (game as any).settings?.get(moduleId, SETTING_POSITION) ?? null;

export const setPosition = (position: HudPosition): Promise<unknown> =>
  (game as any).settings.set(moduleId, SETTING_POSITION, position);

/**
 * A saved position must never be able to lose the panel: a window resized
 * smaller, or a second screen unplugged, would otherwise leave it parked
 * outside the viewport with no way to drag it back.
 */
export function clampToViewport(
  position: HudPosition,
  width: number,
  height: number
): HudPosition {
  const margin = 32;
  return {
    left: Math.min(
      Math.max(position.left, 0),
      Math.max(0, window.innerWidth - Math.min(width, margin * 4))
    ),
    top: Math.min(
      Math.max(position.top, 0),
      Math.max(0, window.innerHeight - Math.min(height, margin))
    ),
  };
}
