# 0003 — The module owns the dials and the interaction; the system owns the economy

**Status:** accepted

## Context

Slices come from somewhere. In Cowboy Bebop a successful roll yields tokens and
false notes; another system will have something else entirely. The question is
whether the module holds that resource or merely consumes it.

Holding it would make the module self-contained and the debit atomic with the
placement. Not holding it avoids duplicating a resource the system already
tracks and displays on its own sheets.

## Decision

The system owns the resource. The module never reads or writes it.

The module owns the dials, their drawing, and the **placement interaction**:
clicking a segment, choosing which slice, seeing what is refused and why.

## Consequences

- Clicking a segment fires `slicedDials.sliceIntent`. A system returning `false`
  takes over, spends from its own economy and calls `addSlice` itself.
  Unhandled, the module asks which slice to place: *choosing* is interaction,
  not economy, so it belongs here — and it is what lets the module work with no
  system at all.
- A system gates placement through the `validate` function on its ruleset, and
  settles up on `slicedDials.slicePlaced` once the slice has landed.
- **The debit is not atomic with the write.** The validator has already refused
  anything the resource could not pay for, so a pool cannot go negative, but a
  failure between the two leaves them disagreeing. This is the accepted cost of
  the system owning the resource.
- `canAddSlice` is deliberately **one** function, used both to grey out what
  cannot be played and to refuse the write. Two would drift and offer a player
  something that is then rejected.
- Rulesets register through a hook the module fires, not by reaching for the
  module during their own `init`: load order between a system and a module is
  not something to bet on. The registry is frozen at `setup`, so a rendered
  dial can never find its categories gone mid-session.
