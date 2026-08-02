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

  // Category-major order keeps the positive and negative versions together.
  // Sign-major order would draw every + first and every - afterwards, so a
  // responsive grid could never guarantee that a pair stayed side by side.
  return categories.flatMap((category) =>
    (dial.system.allowedSigns as Sign[]).map((sign) => ({
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
  const categories = new Map<string, Option[]>();
  options.forEach((option) => {
    const pair = categories.get(option.category) ?? [];
    pair.push(option);
    categories.set(option.category, pair);
  });

  const pairs = [...categories.values()]
    .map((pair) => {
      const buttons = pair
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

      return (
        `<div class="sd-pick-pair" role="group" ` +
        `aria-label="${escape(pair[0].label)}">${buttons}</div>`
      );
    })
    .join("");

  return `<div class="sd-picker">${pairs}</div>`;
}

/**
 * Asks which slice to place, then places it - and stays open for the next one.
 *
 * Filling a dial is rarely one slice: closing after each pick made the common
 * case four clicks through a reopened window. The picker is redrawn from the
 * dial after every placement instead, so what a slice just made impossible -
 * a full dial, a reserved last segment - shows up as a disabled button rather
 * than as a refusal on the click after.
 *
 * Choosing is interaction, not economy, so it lives here. A system that wants
 * to spend its own resources instead handles the intent hook and never lets
 * this open.
 */
export async function openSlicePicker(dial: any): Promise<void> {
  if (optionsFor(dial).length === 0) {
    ui.notifications?.warn(
      game.i18n?.localize("SLICEDDIALS.Picker.noCategories") ??
        "This dial has no category to place."
    );
    return;
  }

  const dialog = new DialogV2({
    window: { title: dial.name },
    position: { width: 520 },
    classes: ["sliced-dials", "sd-picker-dialog"],
    content: `<div class="sd-picker-body"></div>`,
    buttons: [
      {
        action: "close",
        label: game.i18n?.localize("SLICEDDIALS.Picker.close") ?? "Close",
      },
    ],
  });

  await dialog.render({ force: true });

  const body = dialog.element?.querySelector(
    ".sd-picker-body"
  ) as HTMLElement | null;
  if (!body) return;

  // Redrawn from the dial rather than patched: the options are cheap to build,
  // and a partial update is how a picker starts disagreeing with the dial it
  // is meant to be showing.
  const paint = (): void => {
    body.innerHTML = content(optionsFor(dial));

    // Wired after each paint rather than through DialogV2's own button list:
    // the buttons carry a colour and a disabled reason, and placing happens on
    // the click itself, so no result has to be handed back through the dialog.
    body.querySelectorAll<HTMLButtonElement>(".sd-pick").forEach((button) => {
      button.addEventListener("click", async () => {
        const verdict = await addSlice(dial, {
          sign: button.dataset.sign as Sign,
          category: button.dataset.category!,
        });
        if (!verdict.ok) ui.notifications?.warn(verdict.reason ?? "Refused");
        paint();
      });
    });
  };

  paint();
}
