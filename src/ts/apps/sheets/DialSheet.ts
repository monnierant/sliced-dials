import { packagePath } from "../../constants";
import { listRulesets, getRuleset } from "../../registry";
import { SIZES } from "../schemas/dialSchema";
import { renderDial } from "../components/renderDial";
import { Sign } from "../../types";
import { removeLastSlice, setState } from "../../slices";

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
    // Wide enough for the fields to sit in two columns rather than one tall
    // stack - there are ten of them now. Resizable because a GM note is worth
    // dragging out room for.
    position: { width: 760, height: "auto" },
    form: {
      handler: DialSheet.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actions: {
      undo: DialSheet.#onUndo,
    },
    window: { contentClasses: ["standard-form"], resizable: true },
  };

  static PARTS = {
    body: { template: `${packagePath}/templates/sheets/dial.hbs` },
  };

  async _prepareContext(): Promise<any> {
    const dial = (this as any).document;
    const system = dial.system;
    const ruleset = getRuleset(system.ruleset);

    const categories = Object.entries(ruleset?.categories ?? {}).map(
      ([key, category]) => ({
        key,
        label: category.label,
        color: category.color,
        // An empty allow-list means "all", so that is what the boxes show.
        checked:
          system.allowedCategories.length === 0 ||
          system.allowedCategories.includes(key),
      })
    );

    return {
      dial,
      system,
      isGM: (game as any).user?.isGM === true,
      canUndo:
        (game as any).user?.isGM === true && system.slices.length > 0,
      editable: (this as any).isEditable,
      // The sheet only opens to someone allowed to read the dial, so the name
      // is safe to expose here.
      preview: renderDial(dial, { interactive: false, label: dial.name }),
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
      categories,
      // Only a category the dial accepts can be the one that closes it -
      // offering the others would build a dial that can never be finished.
      closingChoices: categories
        .filter((category) => category.checked)
        .map((category) => ({
          ...category,
          selected: category.key === system.closingCategory,
        })),
      signChoice: signChoiceOf(system.allowedSigns),
      toneChoices: ["neutral", "positive", "negative"].map((value) => ({
        value,
        selected: value === (system.tone ?? "neutral"),
      })),
      stateChoices: ["inactive", "hidden", "active"].map((value) => ({
        value,
        selected: value === system.state,
      })),
      onCompleteChoices: ["lock", "reset", "none"].map((value) => ({
        value,
        selected: value === system.onComplete,
      })),
      onCompleteStateChoices: ["keep", "hidden", "inactive"].map((value) => ({
        value,
        selected: value === system.onCompleteState,
      })),
      celebrationChoices: ["discreet", "modal", "none"].map((value) => ({
        value,
        selected: value === system.celebration,
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

    // Unticking the category a dial was to be closed with would leave it
    // unfinishable, so the requirement goes rather than the dial.
    const closing =
      checked.length === 0 || checked.includes(data.closingCategory)
        ? (data.closingCategory ?? "")
        : "";

    await dial.update({
      name: data.name,
      "system.closingCategory": closing,
      "system.size": Number(data.size),
      "system.tone": data.tone ?? dial.system.tone,
      "system.ruleset": data.ruleset ?? "",
      "system.onComplete": data.onComplete,
      "system.onCompleteState": data.onCompleteState ?? dial.system.onCompleteState,
      "system.celebration": data.celebration ?? dial.system.celebration,
      "system.locked": Boolean(data.locked),
      "system.gmNote": data.gmNote ?? dial.system.gmNote,
      "system.allowedSigns": SIGN_CHOICES[data.signChoice] ?? ["+", "-"],
      // All boxes ticked is stored as "no restriction", so adding a category to
      // the ruleset later does not silently exclude it from existing dials.
      "system.allowedCategories": checked.length === available ? [] : checked,
    });

    // The state moves ownership with it, which is `setState`'s job and not a
    // field to be written past it. Only the GM has the control at all, so
    // anyone else's submission simply leaves the state where it was.
    if (data.state && data.state !== dial.system.state) {
      await setState(dial, data.state);
    }
  }

  static async #onUndo(this: any): Promise<void> {
    const result = await removeLastSlice(this.document);
    if (result.ok) this.render(false);
  }
}
