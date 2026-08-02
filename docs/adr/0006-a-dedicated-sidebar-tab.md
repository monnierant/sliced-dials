# 0006 — Three display surfaces, once including a dedicated sidebar tab

**Status:** superseded in part by
[ADR 0007](0007-dials-live-in-the-combat-tracker.md); the dedicated root tab
was subsequently removed rather than keeping two sidebar entries for dials

## Context

A dial only creates tension if it is seen without effort. A dial sitting at 5/6
behind a window nobody opens changes nothing at the table.

Dials being Items ([ADR 0001](0001-dials-are-item-subtypes.md)), they already
appear in the Items tab with folders, search and compendiums, for free.

## Decision

Three surfaces:

1. An **anchored panel**, always on screen, draggable, foldable, and removable
   through a client setting.
2. A **dedicated sidebar tab**, later removed when the combat tracker became
   the main home.
3. A **mount function** systems call to put a document's dials on their own
   sheets, for dials embedded on an actor.

## Consequences

- Three surfaces on the same data is three render paths. They are held together
  by the shared list component from
  [ADR 0005](0005-one-svg-component-drawn-per-segment.md) — never three
  lookalike templates.
- The panel hides itself entirely when there is nothing to show, so it never
  becomes an invisible click-blocker over the canvas. Folding leaves the grip
  bar behind: a panel that can vanish with no handle left is one you cannot get
  back. A saved position is clamped to the viewport on every render, so a
  resized window cannot park it out of reach.
- Registering a sidebar tab was not a documented Foundry extension point and
  claimed another icon beside the Combat tab that now contains the same dials.
  Removing it leaves the Items tab for preparation and the combat tracker for
  play.
