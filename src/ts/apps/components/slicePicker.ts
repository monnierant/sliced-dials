import { addSlice, canAddSlice } from "../../slices";
import { getRuleset } from "../../registry";
import { Sign, Slice, Verdict } from "../../types";

const { DialogV2 } = (foundry as any).applications.api;

interface Option {
  sign: Sign;
  category: string;
  label: string;
  color: string;
  verdict: Verdict;
}

function escape(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Every slice the dial could take, playable or not. Refused ones are kept and
 * shown disabled with their reason: a button that quietly disappears teaches
 * nothing, and "why can't I play blues here" is the question a player actually
 * has.
 */
function optionsFor(dial: any): Option[] {
  const ruleset = getRuleset(dial.system.ruleset);
  const categories: string[] =
    dial.system.allowedCategories.length > 0
      ? dial.system.allowedCategories
      : Object.keys(ruleset?.categories ?? {});

  const userId = (game as any).user?.id ?? "";

  return (dial.system.allowedSigns as Sign[]).flatMap((sign) =>
    categories.map((category) => ({
      sign,
      category,
      label: ruleset?.categories[category]?.label ?? category,
      color: ruleset?.categories[category]?.color ?? "#7a7a7a",
      // The same predicate that refuses the write decides what is offered.
      verdict: canAddSlice(dial, {
        sign,
        category,
        userId,
        at: Date.now(),
      } as Slice),
    }))
  );
}

function content(options: Option[]): string {
  const buttons = options
    .map(
      (option) =>
        `<button type="button" class="sd-pick" ` +
        `data-sign="${option.sign}" data-category="${escape(option.category)}" ` +
        `style="border-color:${escape(option.color)}" ` +
        (option.verdict.ok
          ? ""
          : `disabled title="${escape(option.verdict.reason ?? "")}"`) +
        `><span class="sd-pick-sign">${option.sign}</span>` +
        `<span class="sd-pick-label">${escape(option.label)}</span></button>`
    )
    .join("");

  return `<div class="sd-picker">${buttons}</div>`;
}

/**
 * Asks which slice to place, then places it.
 *
 * Choosing is interaction, not economy, so it lives here. A system that wants
 * to spend its own resources instead handles the intent hook and never lets
 * this open.
 */
export async function openSlicePicker(dial: any): Promise<void> {
  const options = optionsFor(dial);

  if (options.length === 0) {
    ui.notifications?.warn(
      game.i18n?.localize("SLICEDDIALS.Picker.noCategories") ??
        "This dial has no category to place."
    );
    return;
  }

  const dialog = new DialogV2({
    window: { title: dial.name },
    classes: ["sliced-dials", "sd-picker-dialog"],
    content: content(options),
    buttons: [
      {
        action: "cancel",
        label: game.i18n?.localize("SLICEDDIALS.Picker.cancel") ?? "Cancel",
      },
    ],
  });

  await dialog.render({ force: true });

  // Wired after render rather than through DialogV2's own button list: the
  // buttons carry a colour and a disabled reason, and placing happens on the
  // click itself, so no result has to be handed back through the dialog.
  const buttons: HTMLButtonElement[] = Array.from(
    dialog.element?.querySelectorAll(".sd-pick") ?? []
  );

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const verdict = await addSlice(dial, {
        sign: button.dataset.sign as Sign,
        category: button.dataset.category!,
      });
      if (!verdict.ok) ui.notifications?.warn(verdict.reason ?? "Refused");
      dialog.close();
    });
  });
}
