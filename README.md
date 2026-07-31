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

Skeleton. The manifest declares the `sliced-dials.dial` Item subtype and the
module publishes an (empty) API through the `slicedDials.register` hook.

Planned, in order: dial data model and API, SVG dial component, anchored HUD,
sheet partial for systems, completion handling, sidebar tab.

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

## Requirements

Foundry VTT v13 or later.

## Build

```sh
npm install
npm run build     # writes dist/
npm run watch
```

Set `FOUNDRY_PATH` to have the build deploy itself into `Data/modules/sliced-dials`.

Releases are cut by `semantic-release` on push to `main`; conventional commit
messages drive the version number.
