// TEMPORARY SCAFFOLDING.
//
// The registry is frozen at `setup` by design, so a ruleset cannot be
// registered from the console - and no consuming system exists yet. Without a
// ruleset nothing can be placed on a dial at all. Delete this file once Cowboy
// Bebop registers its own.

import { dialType } from "./constants";
import { registerRuleset } from "./registry";

export const DEMO_RULESET = "demo";

export function registerDemoRuleset(): void {
  registerRuleset({
    id: DEMO_RULESET,
    categories: {
      rock: { label: "Rock", color: "#f44336" },
      blues: { label: "Blues", color: "#2196f3" },
      jazz: { label: "Jazz", color: "#ff9800" },
    },
  });
}

/** Creates a world dial to play with. It shows up in the HUD by itself. */
export async function debugCreateDial(size = 6): Promise<any> {
  return (Item as any).create({
    name: "Demo dial",
    type: dialType,
    system: { size, ruleset: DEMO_RULESET },
  });
}

export const debugApi = {
  createDial: debugCreateDial,
};
