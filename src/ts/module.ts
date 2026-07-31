// Do not remove this import. If you do Vite will think your styles are dead
// code and not include them in the build output.
import "../styles/style.scss";

import { moduleId, registerHook } from "./constants";
import { range } from "./handlebarsHelpers/range";
import { concat } from "./handlebarsHelpers/concat";
import { ternary } from "./handlebarsHelpers/ternary";
import { partial } from "./handlebarsHelpers/partial";

// The public API handed to systems. It is intentionally empty for now: every
// entry added here becomes a contract that Cowboy Bebop and Ghost in the Shell
// depend on.
export interface SlicedDialsApi {}

// `HookConfig` is module-scoped in foundry-vtt-types, not global, so a custom
// hook name is declared by augmenting that module. Without this, Hooks.callAll
// rejects the name outright - which is the behaviour we want to keep.
// The empty type-only import is required: without it TypeScript silently
// declares a brand new ambient module instead of merging into the real one.
import type {} from "@league-of-foundry-developers/foundry-vtt-types/configuration";

declare module "@league-of-foundry-developers/foundry-vtt-types/configuration" {
  namespace Hooks {
    interface HookConfig {
      "slicedDials.register": (api: SlicedDialsApi) => void;
    }
  }
}

Hooks.once("init", () => {
  console.log(`Initializing ${moduleId}`);

  Handlebars.registerHelper("partial", partial);
  Handlebars.registerHelper("range", range);
  Handlebars.registerHelper("concat", concat);
  Handlebars.registerHelper("ternary", ternary);

  // The API is published on the module entry as well as handed to the register
  // hook: the hook is what systems should use, the property is what macros and
  // the console need.
  const api: SlicedDialsApi = {};
  const self = (game as any).modules?.get(moduleId);
  if (self) self.api = api;

  Hooks.callAll(registerHook, api);
});
