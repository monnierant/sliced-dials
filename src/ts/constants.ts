export const moduleId: string = __PACKAGE_ID__;

// `systems/<id>` or `modules/<id>`: the root every template, style and asset
// path hangs off. Always build Foundry paths from this, never by hand.
export const packagePath: string = `${__PACKAGE_KIND__}s/${__PACKAGE_ID__}`;

// The Item subtype this module declares in its manifest. Foundry namespaces
// module-provided subtypes, so the stored type is `sliced-dials.dial` and never
// the bare word.
export const dialType: string = `${moduleId}.dial`;

// Hook fired at init with the public API as its argument. Systems listen for it
// to register their rulesets, which keeps registration independent of whether
// the system or the module loads first. `as const` keeps the literal type, which
// is what Foundry's typings need to accept it as a hook name.
export const registerHook = "slicedDials.register" as const;

// Fired the moment a dial fills up, before its declared completion behaviour is
// applied. This is how a system reacts to "the threat landed" without this
// module ever knowing what that means.
export const completedHook = "slicedDials.completed" as const;
