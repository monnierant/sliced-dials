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

// `HookConfig` is module-scoped in foundry-vtt-types, not global, and reached
// through the `Hooks` namespace re-exported by `configuration`. Declaring the
// hooks here keeps an unknown hook name a compile error rather than a typo that
// silently never fires.
declare module "@league-of-foundry-developers/foundry-vtt-types/configuration" {
  namespace Hooks {
    interface HookConfig {
      "slicedDials.register": (api: SlicedDialsApi) => void;
      "slicedDials.completed": (dial: any, composition: Composition) => void;
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
  const self = (game as any).modules?.get(moduleId);
  if (self) self.api = { ...api, debug: debugApi };

  // TEMPORARY: without a ruleset nothing can be placed, and no system provides
  // one yet. Removed when the HUD lands. See debug.ts.
  registerDemoRuleset();

  Hooks.callAll(registerHook, api);
});

Hooks.once("setup", () => {
  // Past this point a rendered dial can no longer find its category definitions
  // gone, so nothing has to be invalidated mid-session.
  freezeRegistry();
});
