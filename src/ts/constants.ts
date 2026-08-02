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

// Fired after a slice has actually landed. This is where a system settles up -
// spending whatever the slice cost - having already refused it through its
// validator if the cost could not be met.
export const placedHook = "slicedDials.slicePlaced" as const;

// How long a completion is celebrated for. Shared, because putting a finished
// dial away has to wait for the celebration it would otherwise cut off.
export const celebrationMs = 2400;

// Fired when a user asks to place a slice on a segment. A system that handles
// it returns false - the Foundry convention for "I am taking over" - debits its
// own economy and calls addSlice itself. Left unhandled, the module asks which
// slice to place, which is interaction rather than economy.
export const intentHook = "slicedDials.sliceIntent" as const;

// Systems may veto a dial on combat surfaces without changing its document
// state or hiding it from the module's other homes. Returning false excludes
// it from the tracker and the window opened from that tracker.
export const combatFilterHook = "slicedDials.filterCombatDial" as const;
