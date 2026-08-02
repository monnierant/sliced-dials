# 0009 — One socket, and it only ever asks a client to *show* something

**Status:** accepted

## Context

Two things wanted a client to do something it did not ask for:

- the GM putting the dials on everyone's screen — the same gesture as Foundry's
  own "show to players" on a journal or an image;
- a completion landing at the same moment for the whole table, rather than
  quietly on the screen of whoever happened to click.

Dials are documents, so their *data* already syncs. What does not sync is
attention.

## Decision

One socket, `module.sliced-dials`, carrying two messages: `showDials` and
`celebrate`.

Nothing crossing it is a write. No client is ever told to change a dial: the
sender has already done that through Foundry, and the message says only "look at
this now".

Every message is treated as a **suggestion**. The receiving client re-checks,
against its own user, everything it would have checked had it drawn the thing
itself: ownership, the dial's state, whether there is anything to show at all.
A player with nothing to see gets no empty window pushed at them, and a player
who may not know a dial exists is not told by a celebration.

## Consequences

- The trust model is unchanged. A socket message from a compromised or
  mischievous client can, at worst, make someone's own dials pop up on their own
  screen. It cannot reveal anything they could not already see and cannot move a
  slice.
- The celebration hangs off the **completion hook**, not off the write path.
  It is a consumer of that hook exactly like a game system is, which keeps the
  write path unaware of anything visual and keeps the import graph a tree
  ([ADR 0003](0003-the-system-owns-the-economy.md) draws the same line for a
  different reason).
- A dial that puts itself away on completion ([ADR 0008](0008-a-dial-has-three-states.md))
  has to wait for the celebration it would otherwise cut off. That wait is a
  shared constant rather than two numbers that would drift apart.
- Sockets need `game.socket`, which does not exist before `ready`. Handlers are
  collected at `init` and the wire is plugged in at `ready`, so nothing depends
  on module load order.
- Two clients completing two dials at the same instant will show two modals. Not
  worth solving until it happens at a table.
