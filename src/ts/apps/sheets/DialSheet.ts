import { packagePath } from "../../constants";
import { listRulesets, getRuleset } from "../../registry";
import { SIZES } from "../schemas/dialSchema";
import { renderDial } from "../components/renderDial";
import { Sign } from "../../types";

const { HandlebarsApplicationMixin } = (foundry as any).applications.api;
const { ItemSheetV2 } = (foundry as any).applications.sheets;

// The three sign policies, expressed as one choice rather than two checkboxes:
// "neither" is not a state a dial can usefully be in, and a pair of checkboxes
// would let a GM reach it.
const SIGN_CHOICES: Record<string, Sign[]> = {
  both: ["+", "-"],
  positive: ["+"],
  negative: ["-"],
};

const signChoiceOf = (signs: Sign[]): string => {
  if (signs.length >= 2) return "both";
  return signs[0] === "-" ? "negative" : "positive";
};

export default class DialSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["sliced-dials", "dial-sheet"],
    position: { width: 420, height: "auto" },
    form: {
      handler: DialSheet.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false,
    },
    window: { contentClasses: ["standard-form"] },
  };

  static PARTS = {
    body: { template: `${packagePath}/templates/sheets/dial.hbs` },
  };

  async _prepareContext(): Promise<any> {
    const dial = (this as any).document;
    const system = dial.system;
    const ruleset = getRuleset(system.ruleset);

    return {
      dial,
      system,
      isGM: (game as any).user?.isGM === true,
      editable: (this as any).isEditable,
      preview: renderDial(dial, { interactive: false }),
      sizes: SIZES.map((size) => ({
        value: size,
        selected: size === system.size,
        // Shrinking below what is already placed loses slices, so say so
        // before the click rather than after.
        lossy: size < system.slices.length,
      })),
      rulesets: listRulesets().map((entry) => ({
        id: entry.id,
        selected: entry.id === system.ruleset,
      })),
      // Without a ruleset a dial accepts nothing, which is the single most
      // likely reason a freshly created dial appears inert.
      missingRuleset: !ruleset,
      categories: Object.entries(ruleset?.categories ?? {}).map(
        ([key, category]) => ({
          key,
          label: category.label,
          color: category.color,
          // An empty allow-list means "all", so that is what the boxes show.
          checked:
            system.allowedCategories.length === 0 ||
            system.allowedCategories.includes(key),
        })
      ),
      signChoice: signChoiceOf(system.allowedSigns),
      onCompleteChoices: ["lock", "reset", "none"].map((value) => ({
        value,
        selected: value === system.onComplete,
      })),
    };
  }

  static async #onSubmit(
    this: any,
    _event: Event,
    _form: HTMLFormElement,
    formData: any
  ): Promise<void> {
    const data = formData.object;
    const dial = this.document;

    // Checkbox groups are read back explicitly rather than trusting the form
    // parser to produce an array: it does not, reliably, for a single box.
    const checked = Object.keys(data)
      .filter((key) => key.startsWith("cat.") && data[key])
      .map((key) => key.slice(4));

    const available = Object.keys(
      getRuleset(data.ruleset)?.categories ?? {}
    ).length;

    await dial.update({
      name: data.name,
      "system.size": Number(data.size),
      "system.ruleset": data.ruleset ?? "",
      "system.onComplete": data.onComplete,
      "system.locked": Boolean(data.locked),
      "system.gmNote": data.gmNote ?? dial.system.gmNote,
      "system.allowedSigns": SIGN_CHOICES[data.signChoice] ?? ["+", "-"],
      // All boxes ticked is stored as "no restriction", so adding a category to
      // the ruleset later does not silently exclude it from existing dials.
      "system.allowedCategories": checked.length === available ? [] : checked,
    });
  }
}
