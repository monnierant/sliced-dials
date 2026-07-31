// Do not remove this import. If you do Vite will think your styles are dead
// code and not include them in the build output.
import "../styles/style.scss";

// The empty type-only import is required by the module augmentation below:
// without it TypeScript silently declares a brand new ambient module instead of
// merging into the real one, and the augmentation does nothing.
import type {} from "@league-of-foundry-developers/foundry-vtt-types/configuration";

import { dialType, moduleId, registerHook } from "./constants";
import { api, SlicedDialsApi } from "./api";
import { freezeRegistry } from "./registry";
import DialDataModel from "./apps/datamodels/DialDataModel";
import { Composition } from "./apps/datamodels/DialDataModel";
import { range } from "./handlebarsHelpers/range";
import { concat } from "./handlebarsHelpers/concat";
import { ternary } from "./handlebarsHelpers/ternary";
import { partial } from "./handlebarsHelpers/partial";
import { debugApi, registerDemoRuleset } from "./debug";
import { registerHudHooks } from "./apps/hud/DialsHud";
import DialSheet from "./apps/sheets/DialSheet";
import { trimToSize } from "./apps/schemas/dialSchema";

// `HookConfig` is module-scoped in foundry-vtt-types, not global, and reached
// through the `Hooks` namespace re-exported by `configuration`. Declaring the
// hooks here keeps an unknown hook name a compile error rather than a typo that
// silently never fires.
declare module "@league-of-foundry-developers/foundry-vtt-types/configuration" {
  namespace Hooks {
    interface HookConfig {
      "slicedDials.register": (api: SlicedDialsApi) => void;
      "slicedDials.completed": (dial: any, composition: Composition) => void;
      "slicedDials.sliceIntent": (dial: any, index: number) => boolean | void;
    }
  }
}

Hooks.once("init", () => {
  console.log(`Initializing ${moduleId}`);

  Handlebars.registerHelper("partial", partial);
  Handlebars.registerHelper("range", range);
  Handlebars.registerHelper("concat", concat);
  Handlebars.registerHelper("ternary", ternary);

  // Foundry namespaces subtypes provided by a module, so the key is
  // `sliced-dials.dial` rather than the bare word.
  (CONFIG.Item.dataModels as any)[dialType] = DialDataModel;

  // The API is published on the module entry as well as handed to the register
  // hook: the hook is what systems should use because it is immune to load
  // order, the property is what macros and the console need.
  // One object, published in both places. Handing the hook a different object
  // from the one on `module.api` would be two APIs that drift apart.
  const published = Object.assign(api, { debug: debugApi });

  const self = (game as any).modules?.get(moduleId);
  if (self) self.api = published;

  // TEMPORARY: without a ruleset nothing can be placed, and no system provides
  // one yet. See debug.ts.
  registerDemoRuleset();

  registerHudHooks();
  registerDialSheet();

  Hooks.callAll(registerHook, published);
});

// Shrinking a dial that already holds slices would leave some placed beyond its
// edge: stored, undrawable, and still counted. Trimming here catches every
// path - the sheet, the API, a macro - rather than only the sheet.
Hooks.on("preUpdateItem", (item: any, changes: any) => {
  if (item.type !== dialType) return;

  const size = changes?.system?.size;
  if (size === undefined) return;

  const slices = changes?.system?.slices ?? item.system.slices;
  const trimmed = trimToSize(slices, size);
  if (trimmed !== slices) {
    changes.system ??= {};
    changes.system.slices = trimmed;
  }
});

function registerDialSheet(): void {
  const collections = (foundry as any).documents?.collections;
  const items = collections?.Items ?? (globalThis as any).Items;

  items?.registerSheet?.(moduleId, DialSheet, {
    types: [dialType],
    makeDefault: true,
    label: "Sliced Dials",
  });
}

Hooks.once("setup", () => {
  // Past this point a rendered dial can no longer find its category definitions
  // gone, so nothing has to be invalidated mid-session.
  freezeRegistry();
});
