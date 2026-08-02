import { moduleId } from "../../constants";
import { listRulesets } from "../../registry";
import { SIZES } from "../schemas/dialSchema";

// A table creates the same shape of dial over and over - Cowboy Bebop's are
// almost all six-segment objective dials on the one ruleset. These settings are
// what a new dial starts as, so the common case costs no clicks.
//
// World scope: this is how *this* table's dials are shaped, not a per-person
// preference.

const SETTINGS = {
  size: "defaultSize",
  ruleset: "defaultRuleset",
  state: "defaultState",
  onComplete: "defaultOnComplete",
  celebration: "defaultCelebration",
} as const;

export interface DialDefaults {
  size: number;
  ruleset: string;
  state: string;
  onComplete: string;
  celebration: string;
}

const choicesOf = (values: readonly string[], prefix: string) =>
  Object.fromEntries(values.map((value) => [value, `${prefix}${value}`]));

/**
 * Registered at `setup` rather than at `init`, which is the unusual part: the
 * ruleset list is only complete once the register hook has fired, and offering
 * a dropdown of rulesets is the whole point of doing this here.
 */
export function registerDialDefaults(): void {
  const settings = (game as any).settings;

  settings.register(moduleId, SETTINGS.size, {
    name: "SLICEDDIALS.Settings.defaultSize.name",
    hint: "SLICEDDIALS.Settings.defaultSize.hint",
    scope: "world",
    config: true,
    type: Number,
    choices: Object.fromEntries(SIZES.map((size) => [size, String(size)])),
    default: 4,
  });

  const rulesets = listRulesets();
  settings.register(moduleId, SETTINGS.ruleset, {
    name: "SLICEDDIALS.Settings.defaultRuleset.name",
    hint: "SLICEDDIALS.Settings.defaultRuleset.hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "": "—",
      ...Object.fromEntries(rulesets.map((entry) => [entry.id, entry.id])),
    },
    // One ruleset and no ambiguity: choosing it for the GM is not a guess.
    default: rulesets.length === 1 ? rulesets[0].id : "",
  });

  settings.register(moduleId, SETTINGS.state, {
    name: "SLICEDDIALS.Settings.defaultState.name",
    hint: "SLICEDDIALS.Settings.defaultState.hint",
    scope: "world",
    config: true,
    type: String,
    choices: choicesOf(
      ["inactive", "hidden", "active"],
      "SLICEDDIALS.Sheet.state_"
    ),
    // A new dial is prepared, not played: the GM brings it into play when they
    // mean to, rather than discovering it already on the table.
    default: "inactive",
  });

  settings.register(moduleId, SETTINGS.onComplete, {
    name: "SLICEDDIALS.Settings.defaultOnComplete.name",
    hint: "SLICEDDIALS.Settings.defaultOnComplete.hint",
    scope: "world",
    config: true,
    type: String,
    choices: choicesOf(
      ["lock", "reset", "none"],
      "SLICEDDIALS.Sheet.onComplete_"
    ),
    default: "lock",
  });

  settings.register(moduleId, SETTINGS.celebration, {
    name: "SLICEDDIALS.Settings.defaultCelebration.name",
    hint: "SLICEDDIALS.Settings.defaultCelebration.hint",
    scope: "world",
    config: true,
    type: String,
    choices: choicesOf(
      ["discreet", "modal", "none"],
      "SLICEDDIALS.Sheet.celebration_"
    ),
    default: "discreet",
  });
}

const read = (key: string, fallback: any): any => {
  const value = (game as any).settings?.get(moduleId, key);
  return value === undefined || value === null ? fallback : value;
};

export function dialDefaults(): DialDefaults {
  return {
    size: Number(read(SETTINGS.size, 4)),
    ruleset: read(SETTINGS.ruleset, ""),
    state: read(SETTINGS.state, "inactive"),
    onComplete: read(SETTINGS.onComplete, "lock"),
    celebration: read(SETTINGS.celebration, "discreet"),
  };
}
