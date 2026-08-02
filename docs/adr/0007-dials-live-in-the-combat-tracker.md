# 0007 — Dials live in the combat tracker, grafted not subclassed

**Status:** accepted, supersedes part of
[ADR 0006](0006-a-dedicated-sidebar-tab.md)

## Context

ADR 0006 gave dials a root sidebar tab so the GM's working set during a fight
would not be mixed in with the system's gear. That reasoning holds, but it
answered the wrong question: it put dials at the same rank as Actors and Items —
a permanent claim on a scarce sidebar — when what they actually are is an
accessory to the scene in play.

During a fight the table is already looking at the combat tracker. That is where
a dial at 5/6 does its work.

The objection was that the tracker only exists during an encounter. It does not:
the Combat sidebar tab is rendered whether or not a `Combat` document exists —
with no encounter it shows its empty state, and `renderCombatTracker` still
fires. Dials that have nothing to do with combat stay reachable there. This is
also not [combat-scoped dials](../ROADMAP.md): no dial is attached to a `Combat`
document, and none is cleaned up with one.

## Decision

Dials get a tab **inside** the combat tracker, next to the encounter, as their
main home.

The tab is **grafted onto the rendered markup** at `renderCombatTracker`, not
installed by subclassing `CONFIG.ui.combat`.

The root sidebar tab from ADR 0006 is removed. Its dial icon moves onto the
button for this inner tracker tab, so there is one obvious sidebar destination
rather than two.

## Consequences

- `CONFIG.ui.combat` is a single slot, and it is the one every combat tracker
  module claims — Carousel, Dock, and others. Subclassing it means the last
  module to load wins and the others silently lose their work. Sharing the DOM
  costs us the core tab styling and buys coexistence.
- We depend on the tracker's markup instead. The graft looks for the combatant
  list through a short list of selectors, warns once, and does nothing if it
  finds none — the panel and the root tab still work. A module that replaces the
  tracker wholesale will degrade to that.
- The injection runs on **every** tracker render — each turn, each initiative
  roll, each dial change — so it must be idempotent. It removes its own nodes
  before adding them back rather than trusting the previous pass to be gone.
- Which tab is showing is held in memory, not in a setting: the tracker
  re-renders constantly and must not drop back to the encounter mid-fight, but a
  fresh session should open on the encounter rather than on whatever was up
  three weeks ago.
- Clicking a segment places a slice, as everywhere else in the module, so
  opening a sheet needed a different gesture: right-click, matching the rest of
  the sidebar.
- Three surfaces remain three, all still drawn by the one list component from
  [ADR 0005](0005-one-svg-component-drawn-per-segment.md). That constraint is
  now doing real work — it is the only reason another surface was cheap.
