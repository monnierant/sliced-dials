// The public surface, and nothing else.
//
// Kept apart from the operations it exposes so the import graph stays a tree:
// the picker and the list need the operations, and if those lived here the
// graph would close a cycle that only works by accident of hoisting.

import { Ruleset } from "./types";
import { listRulesets, registerRuleset } from "./registry";
import {
  addSlice,
  canAddSlice,
  getCategory,
  removeLastSlice,
  resetDial,
  setLocked,
  setState,
} from "./slices";
import {
  activateDialListeners,
  renderDial,
} from "./apps/components/renderDial";
import {
  activateDialList,
  dialsOf,
  mountDials,
  renderDialList,
} from "./apps/components/dialList";
import { openSlicePicker } from "./apps/components/slicePicker";

export interface SlicedDialsApi {
  registerRuleset: (ruleset: Ruleset) => void;
  listRulesets: () => Ruleset[];

  // Reading and writing dials. `canAddSlice` is the same predicate the module
  // uses to grey out what cannot be played: ask it rather than guessing.
  canAddSlice: typeof canAddSlice;
  addSlice: typeof addSlice;
  removeLastSlice: typeof removeLastSlice;
  resetDial: typeof resetDial;
  setLocked: typeof setLocked;
  setState: typeof setState;
  getCategory: typeof getCategory;

  // The integration surface. `mountDials` is the one call a system needs to
  // put a document's dials into its own sheet, fully wired; the rest is the
  // same thing taken apart, for a sheet that wants to place the pieces itself.
  mountDials: typeof mountDials;
  dialsOf: typeof dialsOf;
  renderDialList: typeof renderDialList;
  activateDialList: typeof activateDialList;
  renderDial: typeof renderDial;
  activateDialListeners: typeof activateDialListeners;
  openSlicePicker: typeof openSlicePicker;
}

export const api: SlicedDialsApi = {
  registerRuleset,
  listRulesets,
  canAddSlice,
  addSlice,
  removeLastSlice,
  resetDial,
  setLocked,
  setState,
  getCategory,
  mountDials,
  dialsOf,
  renderDialList,
  activateDialList,
  renderDial,
  activateDialListeners,
  openSlicePicker,
};
