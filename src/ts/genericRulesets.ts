import { registerRuleset } from "./registry";

export const GENERIC_COUNTER_RULESET = "generic-counter";
export const GENERIC_SLICES_RULESET = "generic-slices";

const localize = (key: string, fallback: string): string => {
  const translated = (game as any).i18n?.localize(key);
  return translated && translated !== key ? translated : fallback;
};

/** Rulesets useful in every game system, registered before systems add theirs. */
export function registerGenericRulesets(): void {
  registerRuleset({
    id: GENERIC_COUNTER_RULESET,
    label: localize("SLICEDDIALS.Rulesets.counter", "Monochrome counter"),
    mode: "counter",
    categories: {
      progress: {
        label: localize("SLICEDDIALS.Categories.progress", "Progress"),
        color: "#3b82f6",
      },
    },
  });

  registerRuleset({
    id: GENERIC_SLICES_RULESET,
    label: localize("SLICEDDIALS.Rulesets.slices", "Coloured slices"),
    mode: "slices",
    categories: {
      blue: { label: localize("SLICEDDIALS.Colours.blue", "Blue"), color: "#3b82f6" },
      green: { label: localize("SLICEDDIALS.Colours.green", "Green"), color: "#22c55e" },
      yellow: { label: localize("SLICEDDIALS.Colours.yellow", "Yellow"), color: "#eab308" },
      orange: { label: localize("SLICEDDIALS.Colours.orange", "Orange"), color: "#f97316" },
      red: { label: localize("SLICEDDIALS.Colours.red", "Red"), color: "#ef4444" },
      purple: { label: localize("SLICEDDIALS.Colours.purple", "Purple"), color: "#a855f7" },
    },
  });
}
