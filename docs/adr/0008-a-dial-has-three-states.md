# 0008 — A dial has three states, and they are not permissions

**Status:** accepted

## Context

[ADR 0004](0004-ownership-is-both-visibility-and-write-permission.md) made
ownership carry visibility. It carries it well for *how much* of a dial a player
gets — nothing, that something is ticking, the whole thing, the right to fill it
— but it answers a different question from the one the GM asks during prep.

Three things were being expressed with one lever:

- a dial written on Tuesday for Saturday's session, which should be nowhere near
  the table yet;
- a dial in play that the players are not meant to know about;
- a dial in play, on the table, everyone looking at it.

Doing the middle one with ownership means dropping every player to None and
restoring their exact levels afterwards, by hand, from memory.

## Decision

A dial carries a `state`: `inactive`, `hidden` or `active`.

- **inactive** — prepared. It appears in the Items tab and in the dials
  directory, and on no play surface.
- **hidden** — in play, in the tracker and the panel, for the GM alone.
- **active** — in play, for everyone their ownership allows.

The state decides **which surfaces** show a dial. Ownership decides **how much**
of it a viewer gets. A dial has to pass both.

**The two concealed states are enforced, not drawn.** Leaving `active` drops
every entry in the dial's ownership to None, so Foundry stops sending the
document to a player's client: there is nothing left there for the Items tab, a
macro or the console to show. A GM is unaffected, because Foundry lets them
through whatever ownership says — which is exactly what makes this a secret
rather than a lockout.

Ownership is therefore *moved by* the state, and the ownership the GM had
granted is kept aside in `system.revealedOwnership` so revealing puts back what
was there rather than a guess. Every path that changes a state goes through
`setState` — the eye, the sheet, completion — because a state written past it
would leave the two halves disagreeing.

Revealing a dial that has never been revealed has nothing to put back. It gets
`default: Observer`, so "in play" means somebody can see it — unless the GM has
already named individual players, in which case they have said who the dial is
for and it is left alone.

`active` is the schema's initial value so that an existing dial cannot vanish
when the module is upgraded. A newly created dial is set to the world's default
— `inactive` out of the box — and a new document is already unreadable by the
players, so preparing one costs no permission write at all.

## Consequences

- **Concealing is destructive to ownership, and the backup is the only copy.**
  A GM who edits permissions by hand while a dial is concealed will have that
  work overwritten on reveal — the saved map wins. The alternative, merging the
  two, would silently keep a grant the GM made *before* hiding the dial and then
  revoked while it was hidden, which is worse.
- A dial putting itself away on completion runs on the client that placed the
  last slice. This is the one client executing `addSlice`; it also lets a
  player-owned dial carry out the consequence the GM configured without making
  state changes generally available to players.
- The client-side filter stays, even though a player no longer has the document
  to filter. It is what draws the GM's own view, and a second lock on a door
  costs nothing.
- One filter, in `dialsOf`, gates every play surface at once. A surface that
  wants everything says so (`{ states: "all" }`), which is what the directory
  does — anything else would be a surface quietly disagreeing with the others.
- A completed dial can put itself away by moving to `hidden` or `inactive`. That
  is deliberately a *different* field from `onComplete`, which is about the
  slices: a dial can be both locked and put away, and one field could not say
  that.
