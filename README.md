# Sliced Dials

A Foundry VTT module for progress dials whose segments are individual **slices**.

Existing clock modules track a single number going up. Here every segment is a
thing in its own right: it carries a **sign** (positive or negative), a
**category** defined by the game system, and the **user who placed it**. A dial
always fills to the end - what changes is the composition it ends up with, and
that composition is what the table reads at completion.

The module is system agnostic. It knows nothing about any particular category:
game systems register their own, with labels, colours, icons and a validator.

## Boundary

This is the line the whole design hangs off:

- **The module owns** the dials (data, permissions, rendering) and the placement
  interaction. It emits an *intent* when a user wants to place a slice.
- **The system owns** the economy: where slices come from, what they cost, who
  may spend them. It arbitrates the intent and calls back into the API.

Nothing about resources, currencies or dice lives in this module.

## Permissions

Dials are Foundry documents, so ownership does the work:

- **None** - the dial does not exist for that player. This is the default for a
  new dial: the GM reveals deliberately.
- **Limited** - the player sees that something is ticking, not what.
- **Observer** - the player sees the dial but cannot act on it.
- **Owner** - the player may place slices on it.

Foundry has no level between "may write" and "may delete", so a player who may
fill a dial can also rename or delete it. Granting ownership dial by dial is
what keeps that contained.

Correcting a dial - undoing the last slice, emptying it, locking it - is the
GM's alone, whoever owns the dial.

## Status

Working, and driving Cowboy Bebop's objective and threat dials. Dials, the
ruleset API, the SVG component, the anchored panel, the dial sheet, the sidebar
tab, completion handling and the integration surface are all in.

See **[docs/ROADMAP.md](docs/ROADMAP.md)** for what is left and what has not
been verified, and **[docs/adr/](docs/adr/)** for the decisions this is built
on — most were taken against an alternative that still looks reasonable, so
read them before changing anything load-bearing.

## For system authors

Listen for the register hook rather than reaching for the module directly - it
fires regardless of whether your system or this module loads first:

```js
Hooks.on("slicedDials.register", (api) => {
  // api.registerRuleset({ ... })
});
```

`game.modules.get("sliced-dials").api` exposes the same object, for macros and
for the console.

### Dials on your own sheets

A dial embedded on a document belongs on that document's sheet, and the module
draws it for you. One call, from wherever your sheet finishes rendering:

```js
const api = game.modules.get("sliced-dials").api;
api.mountDials(container, this.actor);
```

`container` is any element of yours; `mountDials` fills it and wires the whole
interaction. Pass `{ interactive: false }` for a read-only display.

If your sheet wants to place the pieces itself, the same thing comes apart:
`api.dialsOf(document)`, `api.renderDialList(dials)`, `api.activateDialList(root)`,
and `api.renderDial(dial)` for a single one.

### Spending your own resources

Clicking a segment fires `slicedDials.sliceIntent`. Return `false` to take over
— the module then does nothing, and it is up to you to debit whatever a slice
costs in your system and call the API:

```js
Hooks.on("slicedDials.sliceIntent", (dial, index) => {
  if (!mySystemHandles(dial)) return;      // let the module ask
  spendFromMyEconomy(dial);
  api.addSlice(dial, { sign: "+", category: "rock" });
  return false;                            // handled
});
```

Ask `api.canAddSlice(dial, slice)` before offering a choice: it is the same
predicate the module uses to grey out what cannot be played, so your interface
and the write path cannot disagree.

## Requirements

Foundry VTT v13 or later.

## Build

```sh
npm install
npm run build     # writes dist/
npm run watch
```

Set `FOUNDRY_PATH` to have the build deploy itself into `Data/modules/sliced-dials`.

## Checks

```sh
npm test
```

Two suites, both running outside Foundry:

- `test:pure` compiles the dial geometry and the size rules on their own and
  checks them. They are arithmetic with no Foundry, DOM or module state, which
  is exactly why they are kept separate.
- `test:harness` runs the **built bundle** against a minimal stand-in for
  Foundry and exercises registration, validation, the write path, permissions,
  completion and the SVG output.

The stand-in is not Foundry. Document persistence, the real DataModel
machinery, multi-client sync and anything visual are outside what these can
tell you - those need a world and a pair of eyes.

Releases are cut by `semantic-release` on push to `main`; conventional commit
messages drive the version number.
