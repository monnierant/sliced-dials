# 0005 — One SVG component, one path per segment

**Status:** accepted

## Context

Dials are drawn in at least four places: the anchored panel, the sidebar tab,
the dial sheet, and any system sheet embedding its own. The previous Cowboy
Bebop implementation used a CSS `conic-gradient` with a single stop plus rotated
`div`s for the dividers.

## Decision

One component, instantiated everywhere. Each segment is a real SVG `<path>`.
Geometry lives in its own module with no Foundry, DOM or module state.

## Consequences

- A `conic-gradient` can still produce the image, but gives no purchase for
  interaction: clickable zones would have to be computed separately, leaving two
  geometries that must agree. That is the duplication that eventually diverges.
- Per-segment DOM buys colour per category, a click target, a tooltip naming the
  category and the placer, and hover feedback — none of which a gradient gives.
- Negative slices carry **hatching** on top of their colour. Categories are
  already colour-coded, so colour alone would be lost on a colour-blind player.
- The geometry being Foundry-free is the whole point: it is the one part of the
  module that can be verified without a running world, and it is
  (`npm run test:pure`). The two traps it covers are the large-arc flag on two-
  and three-segment dials, and a single-segment dial that no lone arc can draw.
- The same reasoning applies one level up: the panel, the sidebar and the system
  integration share **one list implementation**, because they each carry the
  anonymising rule from [ADR 0004](0004-ownership-is-both-visibility-and-write-permission.md)
  and three copies of that rule is how it goes wrong quietly.
