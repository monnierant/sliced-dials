// Small console convenience for trying the module without creating a dial by
// hand. It uses the generic coloured-slice ruleset shipped by the module.

import { dialType } from "./constants";
import { GENERIC_SLICES_RULESET } from "./genericRulesets";

/** Creates a world dial to play with. It shows up in the HUD by itself. */
export async function debugCreateDial(size = 6): Promise<any> {
  return (Item as any).create({
    name: "Demo dial",
    type: dialType,
    system: { size, ruleset: GENERIC_SLICES_RULESET },
  });
}

export const debugApi = {
  createDial: debugCreateDial,
};
