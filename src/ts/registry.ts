import { Ruleset } from "./types";

// Rulesets are registered during `init`, through the register hook, and frozen
// once `setup` has run. A frozen registry means a rendered dial can never find
// its category definition gone mid-session, which would otherwise force every
// open dial to be invalidated and re-rendered.
const rulesets = new Map<string, Ruleset>();
let frozen = false;

export function registerRuleset(ruleset: Ruleset): void {
  if (frozen) {
    throw new Error(
      `sliced-dials: ruleset "${ruleset.id}" was registered too late. ` +
        `Register from the slicedDials.register hook, which fires during init.`
    );
  }
  if (!ruleset?.id) {
    throw new Error("sliced-dials: a ruleset must have an id.");
  }
  if (rulesets.has(ruleset.id)) {
    throw new Error(
      `sliced-dials: ruleset "${ruleset.id}" is already registered.`
    );
  }
  rulesets.set(ruleset.id, ruleset);
}

export function getRuleset(id: string): Ruleset | undefined {
  return rulesets.get(id);
}

export function listRulesets(): Ruleset[] {
  return [...rulesets.values()];
}

export function freezeRegistry(): void {
  frozen = true;
}
