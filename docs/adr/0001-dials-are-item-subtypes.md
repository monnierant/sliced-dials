# 0001 — A dial is an Item subtype provided by this module

**Status:** accepted

## Context

A dial has to be able to hang off an actor (an antagonist carrying its own
objective and threat dials) *and* to exist on its own at world level (an
ambient "the reinforcements are coming"). It also has to be visible to some
players and not others, stay in sync across clients, and ideally be shippable
as a ready-made template.

The obvious cheap option is an array in a flag or a world setting, which is
what the previous Cowboy Bebop implementation did.

## Decision

Declare `documentTypes.Item.dial` in the manifest and store dials as real
Foundry documents.

## Consequences

- Embedded on an actor and free at world level are the same model, for free.
- Per-dial ownership, multi-client sync, folders, search, compendiums and
  cascade deletion all come from Foundry rather than from us.
- Dials appear in the Items tab alongside the system's own items. A dedicated
  sidebar tab exists to compensate — see
  [ADR 0006](0006-a-dedicated-sidebar-tab.md).
- If the module is disabled in a world, its documents become invalid. The data
  survives; it is unreadable until the module is re-enabled.
- Foundry namespaces module-provided subtypes, so the stored type string is
  `sliced-dials.dial`, never the bare word. Anything comparing types must use
  the constant.
