# 0004 — Foundry ownership carries both visibility and the right to write

**Status:** accepted, with a known compromise

## Context

A dial has four useful dramatic states, and Foundry's four ownership levels
happen to match them:

| Level | Meaning |
| --- | --- |
| None | The dial does not exist for that player |
| Limited | Something is ticking, but not what |
| Observer | Sees everything, cannot act |
| Owner | May place slices |

Separately, players must be able to fill dials, and Foundry only lets the
**owner** of a document write to it. A GM relay over sockets was built and then
removed as too complicated for what it bought.

## Decision

Use native ownership. New dials default to **None**: the GM reveals
deliberately. The GM raises a dial to Owner for players who may fill it.

Correcting a dial — undoing, emptying, locking — is the GM's alone, whatever
the ownership.

## Consequences

- Foundry has no level between "may write" and "may delete", so a player who may
  fill a dial can also rename or delete it. Granting ownership dial by dial is
  what keeps that contained. This is a real compromise, accepted knowingly.
- Defaulting to None costs the GM a click per dial and makes the failure mode
  "the players cannot see it" rather than "the secret dial was revealed".
- **Limited must not leak.** The name is the obvious leak; the accessibility
  tree and per-slice tooltips are the non-obvious ones. `renderDial` therefore
  carries **no name at all** unless one is handed to it, so a caller cannot leak
  one by forgetting to think about it. This was a real bug, found by testing the
  rule rather than by reading the code.
