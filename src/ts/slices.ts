import { celebrationMs, completedHook, placedHook } from "./constants";
import { getRuleset } from "./registry";
// The component, not a second drawing: a chat card showing a dial that differs
// from the dial on screen would be the drift this module keeps refusing.
import { renderDial } from "./apps/components/renderDial";
import { Category, DialState, Sign, Slice, Verdict } from "./types";

// A dial is an Item whose subtype this module declares. The typings for
// module-provided subtypes are not expressible here, so the document is taken
// loosely and the schema does the real validation.
type Dial = any;

const ok: Verdict = { ok: true };
const no = (reason: string): Verdict => ({ ok: false, reason });

// Placing a slice is a player action; correcting a dial is not. Anyone may fill
// a dial they own, but undoing, emptying and locking stay with the GM.
const isGM = (): boolean => (game as any).user?.isGM === true;

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

  const ruleset = getRuleset(system.ruleset);
  const receding = ruleset?.mode === "counter" && slice.sign === "-";
  if (system.isComplete && !receding) return no("This dial is already full.");
  if (receding && system.value === 0) return no("This dial is already empty.");

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

  // The last segment can be reserved: a dial that must be closed with one
  // category makes the final slice the interesting one instead of a formality.
  // Checked before the ruleset's own validator so the dial's own declaration
  // always wins.
  if (
    !receding &&
    system.closingCategory &&
    system.free === 1 &&
    slice.category !== system.closingCategory
  ) {
    return no(`This dial must be closed with "${system.closingCategory}".`);
  }

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

  // Foundry only lets the owner of a document write to it, and it has no level
  // between "can write" and "can delete". A player who may place slices on a
  // dial is therefore its owner, which the GM grants dial by dial.
  if (!dial.isOwner) return no("You do not have permission on this dial.");

  const ruleset = getRuleset(dial.system.ruleset);
  if (ruleset?.mode === "counter" && complete.sign === "-") {
    await dial.update({
      "system.slices": dial.system.slices.slice(0, -1),
    });
    await postPlacementMessage(dial, complete);
    return ok;
  }

  await dial.update({
    "system.slices": [...dial.system.slices, complete],
  });

  Hooks.callAll(placedHook, dial, complete);

  await postPlacementMessage(dial, complete);

  if (dial.system.isComplete) await onDialComplete(dial);

  return ok;
}

/**
 * Removes the most recently placed slice. Misclicks in combat are frequent, and
 * the ordered slice list makes the undo exact rather than approximate.
 */
export async function removeLastSlice(dial: Dial): Promise<Verdict> {
  if (!dial?.system) return no("This document is not a dial.");
  if (!isGM()) return no("Only the GM can correct a dial.");
  if (dial.system.slices.length === 0) return no("This dial is empty.");

  // Correction deliberately bypasses the lock. A mistaken last slice often
  // completes and auto-locks the dial; requiring an unlock before undo would
  // make the common error needlessly awkward. The dial stays locked, so this
  // does not silently reopen it for placement.
  await dial.update({
    "system.slices": dial.system.slices.slice(0, -1),
  });
  return ok;
}

/** Empties the dial without unlocking it. */
export async function resetDial(dial: Dial): Promise<Verdict> {
  if (!dial?.system) return no("This document is not a dial.");
  if (!isGM()) return no("Only the GM can correct a dial.");
  await dial.update({ "system.slices": [] });
  return ok;
}

const NONE = 0;
const OBSERVER = 2;

type Ownership = Record<string, number>;

/**
 * The same map with nothing readable left in it. Every entry is set to None
 * rather than removed, because a document update merges: a deleted key would
 * keep its old value.
 *
 * GMs are unaffected - Foundry lets them through whatever ownership says -
 * which is exactly what makes this usable as a secret rather than a lockout.
 */
function concealed(ownership: Ownership): Ownership {
  const stripped: Ownership = {};
  for (const key of Object.keys(ownership ?? {})) stripped[key] = NONE;
  stripped.default = NONE;
  return stripped;
}

const isConcealed = (ownership: Ownership): boolean =>
  Object.values(ownership ?? {}).every((level) => level === NONE);

/** What the dial's ownership should be once it is back in play. */
function revealed(dial: Dial): Ownership {
  const saved: Ownership = dial.system.revealedOwnership ?? {};
  const cleared = concealed(dial.ownership);

  // Put back exactly what was granted, and nothing that has been granted since
  // while the dial was concealed.
  if (Object.keys(saved).length > 0) return { ...cleared, ...saved };

  // Never revealed before. "In play" has to mean somebody can see it, so the
  // table gets Observer - unless the GM has already named individual players,
  // in which case they have said who this dial is for and we leave it alone.
  const named = Object.entries((dial.ownership ?? {}) as Ownership).some(
    ([key, level]) => key !== "default" && level > NONE
  );

  return named ? { ...(dial.ownership as Ownership) } : { default: OBSERVER };
}

/**
 * Moves a dial between prepared, secret and in play - and moves its ownership
 * with it.
 *
 * A concealed dial is not merely undrawn: every player's permission is dropped,
 * so Foundry stops sending them the document at all. There is nothing left in
 * their client for the Items tab, a macro or the console to show. The ownership
 * the GM had granted is kept aside and put back on reveal.
 */
async function applyState(dial: Dial, state: DialState): Promise<void> {
  const changes: Record<string, unknown> = { "system.state": state };
  const ownership: Ownership = dial.ownership ?? {};

  if (state === "active") {
    changes.ownership = revealed(dial);
    changes["system.revealedOwnership"] = {};
  } else {
    // Saved once. Going from hidden to prepared must not overwrite the backup
    // with the already-stripped map it would read.
    const saved: Ownership = dial.system.revealedOwnership ?? {};
    if (Object.keys(saved).length === 0 && !isConcealed(ownership)) {
      changes["system.revealedOwnership"] = { ...ownership };
    }
    changes.ownership = concealed(ownership);
  }

  await dial.update(changes);
}

export async function setState(dial: Dial, state: DialState): Promise<Verdict> {
  if (!dial?.system) return no("This document is not a dial.");
  if (!isGM()) return no("Only the GM can change a dial's state.");

  await applyState(dial, state);
  return ok;
}

export async function setLocked(dial: Dial, locked: boolean): Promise<Verdict> {
  if (!dial?.system) return no("This document is not a dial.");
  if (!isGM()) return no("Only the GM can lock a dial.");
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

  // Where the dial goes is a separate question from what happens to its
  // slices, so a dial can be both locked and put away. Delayed on purpose:
  // taking it off the screen the instant it fills would cut off the
  // celebration the completion hook just started.
  // `addSlice` runs only on the client that placed the last slice. The declared
  // consequence therefore runs there too, including when that owner is a
  // player. The public `setState` remains GM-only: this private path is not a
  // player choosing a state, but the dial carrying out the state its GM chose
  // beforehand.
  const state = dial.system.onCompleteState;
  if (state && state !== "keep") {
    setTimeout(() => void applyState(dial, state), celebrationMs);
  }
}

/**
 * The card every announcement is built from: the dial as it stands, drawn
 * small, with one line of text beside it.
 *
 * The drawing is the point. A line reading "3/6" says how far along a dial is;
 * the dial itself says that and which categories carried it, in the log, weeks
 * later, without anyone having to remember.
 */
function card(dial: Dial, line: string, detail: string): string {
  return (
    `<div class="sd-chat-card">` +
    // Baked as it is now, on purpose: the message is a record of a moment, not
    // a live view of a dial that will have moved on by the time it is read.
    renderDial(dial, { label: dial.name }) +
    `<div class="sd-chat-lines">` +
    `<div class="sd-chat-line">${line}</div>` +
    `<div class="sd-chat-detail">${detail}</div>` +
    `</div></div>`
  );
}

// Every placement is announced, so the table sees a dial move without anyone
// having to watch it. The category label comes from the ruleset when there is
// one; otherwise the raw key is shown rather than nothing.
async function postPlacementMessage(dial: Dial, slice: Slice): Promise<void> {
  const label = getCategory(dial, slice.category)?.label ?? slice.category;

  const content = card(
    dial,
    `<strong>${dial.name}</strong> ${slice.sign}1 ${label}`,
    `${dial.system.value}/${dial.system.size}`
  );

  await ChatMessage.create({ content } as any);
}

async function postCompletionMessage(
  dial: Dial,
  composition: { positive: number; negative: number }
): Promise<void> {
  const completed =
    game.i18n?.localize("SLICEDDIALS.Dial.completed") ?? "is complete.";

  const content = card(
    dial,
    `<strong>${dial.name}</strong> ${completed}`,
    `${composition.positive} + / ${composition.negative} -`
  );

  await ChatMessage.create({ content } as any);
}
