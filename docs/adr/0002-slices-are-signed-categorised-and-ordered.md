# 0002 — A slice carries a sign, a category and its author, and the list is ordered

**Status:** accepted

## Context

Existing clock modules track a single number going up. That is not worth
rebuilding. What justifies this module is that a segment is a thing in its own
right: it was placed by someone, it counts for or against, and it belongs to a
category the game system defines.

Four mechanics were considered: signed segments where the dial always fills and
the final composition decides; a tug-of-war cursor; negative slices erasing
positive ones; and two racing dials.

## Decision

A dial stores an **ordered list** of slices. Each slice is
`{ sign, category, userId, at }` and occupies **exactly one segment**. The dial
always fills; the composition at completion is what the table reads.

Sizes are 4, 6, 8, 10 or 12 — no other value.

## Consequences

- The tug-of-war was rejected because it can oscillate forever: nothing forces
  the fiction to move. A dial that always fills is a clock, not a scoreboard.
- "This counts double" is expressed as two slices, not as a weight. What the
  dial draws is therefore always exactly what was placed, with no special case
  in the model or in the geometry.
- `value`, `isComplete` and `composition` are **derived** from the list. A
  stored counter alongside it would be a second source of truth that drifts.
- Ordering plus authorship gives undo and history for free — the last element
  is what an undo removes. (No interface reaches that yet: see the roadmap.)
- Shrinking a dial has to trim the overflow, or slices sit beyond the edge:
  stored, undrawable, and still counted.
- Sign and category are orthogonal. A dial declares `allowedSigns`, so a
  single-signed dial (Cowboy Bebop's objective and threat dials) and a mixed
  dial where composition decides are the same model with one field differing.
