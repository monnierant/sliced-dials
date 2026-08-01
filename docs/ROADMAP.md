# What is left to do

Ordered by what would hurt most at a table. Everything here is known and
deliberate — nothing in this file is a surprise waiting to be discovered.

## Gaps in what already exists

### Undo has no interface

`removeLastSlice` and `resetDial` exist in the API and are reachable only from a
macro or the console. Ordered slices were chosen partly *because* they make undo
exact ([ADR 0002](adr/0002-slices-are-signed-categorised-and-ordered.md)), and a
misclick in combat is frequent. The panel and the sheet both need GM controls:
undo, empty, lock.

### Refusal reasons are hardcoded English

`canAddSlice` returns strings like `"This dial is locked."` written into
`slices.ts`. They surface in tooltips and notifications, so a French table sees
English. They need to become localisation keys.

Rulesets supply their own reasons and are the system's business, but the module
should probably let a system return a key rather than a sentence.

### The demo ruleset is still shipped

`debug.ts` registers a `demo` ruleset at init, added when no system provided one.
Cowboy Bebop now registers its own, so this can go — but it is genuinely useful
for trying the module without any system, so consider keeping it behind a
setting rather than deleting it outright.

### No dial templates

Compendiums of ready-made dials were part of why dials are documents at all. None
are shipped, and there is no example for a system author to copy.

### Slice history is not shown anywhere

Every slice records who placed it and when. Tooltips show it one at a time; the
sheet shows nothing. A short list on the sheet would make "who filled this"
answerable.

## Unverified

These work as far as anything outside a browser can tell, and have not been
exercised at a table:

- `onComplete: "reset"` — the recurring-dial path. Only `lock` has been seen.
- Multi-client sync: two players, one dial, simultaneous placement.
- The sidebar tab against anything other than the currently installed Foundry
  version — see [ADR 0006](adr/0006-a-dedicated-sidebar-tab.md).
- Dials embedded on an actor, through `mountDials`, in a real system sheet.

`npm test` covers the geometry, the sizes and trimming, registration,
validation, the write path, permissions, completion and the SVG output — against
the built bundle. It cannot cover document persistence, the real DataModel
machinery, sync, or anything visual.

## Not started

- **Second filling method.** Cards were the original idea and turned out to be
  tokens, but the intent hook makes other sources cheap: a roll result posting a
  "place this" button into chat, for instance.
- **Combat-scoped dials.** Dials are world-level or actor-embedded. A dial that
  belongs to the current combat and is cleaned up with it was discussed and
  deferred.
- **Publishing.** The release pipeline works and cuts GitHub releases. Publishing
  to the Foundry registry needs `FVTT_PUBLISH_TOKEN` set on the repository.
- **Ghost in the Shell.** The second consumer, and the real test of whether the
  ruleset API is general or merely Cowboy-Bebop-shaped.
