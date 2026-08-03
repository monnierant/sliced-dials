# 0010 — A ruleset may opt into counter semantics

**Status:** accepted

## Context

The original dial is made of signed, categorised slices. Both signs occupy a
segment and the final composition matters. That remains the mechanic required
by Cowboy Bebop, but it does not cover the generic single-colour clock used by
many tables, where plus advances and minus genuinely moves backwards.

## Decision

A ruleset may declare `mode: "counter"`. A positive action appends one progress
slice and a negative action removes the most recent one. Receding from zero is
refused. A missing mode means `"slices"`, preserving every ruleset registered
before this option existed.

The module registers two generic rulesets:

- `generic-counter`, with one per-dial configurable colour;
- `generic-slices`, with a reusable palette of coloured categories.

## Consequences

- Cowboy Bebop does not need a migration or code change. Its omitted mode keeps
  negative slices occupying segments and carrying hatching.
- Counter decrements are actions, not stored negative slices. The remaining
  ordered list is the current progress and still supports exact GM correction.
- Completion and locking remain dial-level choices. A counter configured to
  lock when full must be unlocked before it can recede.
