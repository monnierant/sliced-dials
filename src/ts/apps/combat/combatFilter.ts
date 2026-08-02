import { combatFilterHook } from "../../constants";

/** Every system gets a veto; no listener means the generic module shows all. */
export function filterCombatDials(dials: any[]): any[] {
  return dials.filter(
    (dial) => Hooks.call(combatFilterHook as any, dial) !== false
  );
}
