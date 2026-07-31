import { completedHook } from "./constants";
import { getRuleset, listRulesets, registerRuleset } from "./registry";
import { Category, Ruleset, Sign, Slice, Verdict } from "./types";

// A dial is an Item whose subtype this module declares. The typings for
// module-provided subtypes are not expressible here, so the document is taken
// loosely and the schema does the real validation.
type Dial = any;

const ok: Verdict = { ok: true };
const no = (reason: string): Verdict => ({ ok: false, reason });

/**
 * The single answer to "may this slice go on this dial?".
 *
 * Used by the interface to grey out what cannot be played AND by the write
 * path to refuse it. Deliberately one function: two would drift, and a player
 * would be offered a slice that is then rejected.
 */
export function canAddSlice(dial: Dial, slice: Slice): Verdict {
  const system = dial?.system;
  if (!system) return no("This document is not a dial.");
  if (system.locked) return no("This dial is locked.");
  if (system.isComplete) return no("This dial is already full.");

  if (!system.allowedSigns.includes(slice.sign)) {
    return no(`This dial does not accept ${slice.sign} slices.`);
  }

  // An empty allow-list means "any category", which is what a dial with no
  // ruleset needs.
  if (
    system.allowedCategories.length > 0 &&
    !system.allowedCategories.includes(slice.category)
  ) {
    return no(`This dial does not accept the category "${slice.category}".`);
  }

  const ruleset = getRuleset(system.ruleset);
  if (ruleset) {
    if (slice.category && !ruleset.categories[slice.category]) {
      return no(
        `"${slice.category}" is not a category of ruleset "${ruleset.id}".`
      );
    }
    if (ruleset.validate) return ruleset.validate(dial, slice);
  }

  return ok;
}

/**
 * Places one slice on one segment, then applies the dial's declared completion
 * behaviour if that filled it.
 *
 * This module never touches any resource: debiting whatever the slice cost is
 * the system's business, and the system is what calls this once it has done so.
 */
export async function addSlice(
  dial: Dial,
  slice: Partial<Slice> & { sign: Sign; category: string }
): Promise<Verdict> {
  const complete: Slice = {
    sign: slice.sign,
    category: slice.category,
    userId: slice.userId ?? (game as any).user?.id ?? "",
    at: slice.at ?? Date.now(),
  };

  const verdict = canAddSlice(dial, complete);
  if (!verdict.ok) return verdict;

  await dial.update({
    "system.slices": [...dial.system.slices, complete],
  });

  if (dial.system.isComplete) await onDialComplete(dial);

  return ok;
}

/**
 * Removes the most recently placed slice. Misclicks in combat are frequent, and
 * the ordered slice list makes the undo exact rather than approximate.
 */
export async function removeLastSlice(dial: Dial): Promise<Verdict> {
  if (!dial?.system) return no("This document is not a dial.");
  if (dial.system.locked) return no("This dial is locked.");
  if (dial.system.slices.length === 0) return no("This dial is empty.");

  await dial.update({
    "system.slices": dial.system.slices.slice(0, -1),
  });
  return ok;
}

/** Empties the dial without unlocking it. */
export async function resetDial(dial: Dial): Promise<Verdict> {
  if (!dial?.system) return no("This document is not a dial.");
  await dial.update({ "system.slices": [] });
  return ok;
}

export async function setLocked(dial: Dial, locked: boolean): Promise<Verdict> {
  if (!dial?.system) return no("This document is not a dial.");
  await dial.update({ "system.locked": locked });
  return ok;
}

/** Resolves a category definition, for rendering. */
export function getCategory(
  dial: Dial,
  category: string
): Category | undefined {
  return getRuleset(dial?.system?.ruleset)?.categories[category];
}

async function onDialComplete(dial: Dial): Promise<void> {
  const composition = dial.system.composition;

  Hooks.callAll(completedHook, dial, composition);

  await postCompletionMessage(dial, composition);

  // The consequence in the fiction belongs to the system or the GM. All the
  // module decides is the state the dial is left in.
  switch (dial.system.onComplete) {
    case "lock":
      await dial.update({ "system.locked": true });
      break;
    case "reset":
      await dial.update({ "system.slices": [] });
      break;
    case "none":
      break;
  }
}

async function postCompletionMessage(
  dial: Dial,
  composition: { positive: number; negative: number }
): Promise<void> {
  const completed =
    game.i18n?.localize("SLICEDDIALS.Dial.completed") ?? "is complete.";

  const content =
    `<p><strong>${dial.name}</strong> ${completed}</p>` +
    `<p>${composition.positive} + / ${composition.negative} -</p>`;

  await ChatMessage.create({ content } as any);
}

export interface SlicedDialsApi {
  registerRuleset: (ruleset: Ruleset) => void;
  listRulesets: () => Ruleset[];
  canAddSlice: typeof canAddSlice;
  addSlice: typeof addSlice;
  removeLastSlice: typeof removeLastSlice;
  resetDial: typeof resetDial;
  setLocked: typeof setLocked;
  getCategory: typeof getCategory;
}

export const api: SlicedDialsApi = {
  registerRuleset,
  listRulesets,
  canAddSlice,
  addSlice,
  removeLastSlice,
  resetDial,
  setLocked,
  getCategory,
};
