// The import = form is what lets the field classes be referenced directly.
import fields = foundry.data.fields;

import { SIZES } from "./dialSize";

export { SIZES, trimToSize } from "./dialSize";

export const sliceSchema = () => ({
  sign: new fields.StringField({
    initial: "+",
    choices: ["+", "-"],
  }),
  category: new fields.StringField({ initial: "" }),
  userId: new fields.StringField({ initial: "" }),
  at: new fields.NumberField({ initial: 0 }),
});

export const dialSchema = {
  // How many segments the dial is divided into.
  size: new fields.NumberField({
    initial: 4,
    integer: true,
    choices: [...SIZES],
    nullable: false,
  }),

  // Ordered: the array index IS the segment position, and the last element is
  // what an undo removes. Never reorder it.
  slices: new fields.ArrayField(new fields.SchemaField(sliceSchema()), {
    initial: [],
  }),

  // Which system registered the rules this dial plays by. Empty means no
  // ruleset, in which case only the declarative constraints below apply.
  ruleset: new fields.StringField({ initial: "" }),

  // Declarative constraints. Empty `allowedCategories` means "any category".
  allowedCategories: new fields.ArrayField(new fields.StringField(), {
    initial: [],
  }),

  // What a dial accepts. Orthogonal to `tone` below: what may be placed on a
  // dial and what the dial is are two different questions, and a positive dial
  // may well take negative slices.
  allowedSigns: new fields.ArrayField(
    new fields.StringField({ choices: ["+", "-"] }),
    { initial: ["+", "-"] }
  ),

  // What the dial *is* - an objective, a threat, or neither. Carried by the
  // colour of its rim, and by nothing else: the module attaches no rule to it,
  // it is there so a table can tell a goal from a threat at a glance.
  //
  // `neutral` is the initial value so an existing dial keeps the plain rim it
  // was drawn with before this field existed.
  tone: new fields.StringField({
    initial: "neutral",
    choices: ["neutral", "positive", "negative"],
  }),

  // Reserves the last free segment for one category: "this dial must be closed
  // with a smooth". Empty means no such requirement. It is a property of the
  // dial rather than of the ruleset - the ruleset only says which categories
  // exist to choose from.
  closingCategory: new fields.StringField({ initial: "" }),

  onComplete: new fields.StringField({
    initial: "lock",
    choices: ["lock", "reset", "none"],
  }),

  // Filling a dial is the moment the table has been playing towards, so how
  // loudly it lands is per dial rather than global: the end of a heist and a
  // threat clock that merely ticked over do not deserve the same noise.
  celebration: new fields.StringField({
    initial: "discreet",
    choices: ["discreet", "modal", "none"],
  }),

  // Where the dial goes once it is done. Orthogonal to `onComplete`, which is
  // about the slices: a dial can be both locked and put away.
  onCompleteState: new fields.StringField({
    initial: "keep",
    choices: ["keep", "hidden", "inactive"],
  }),

  // Where the dial is in play. Orthogonal to ownership: the state decides which
  // surfaces show the dial at all, ownership decides how much of it a viewer
  // gets, and a dial has to pass both.
  //
  //   inactive - prepared, listed in the Items tab only. Not in play.
  //   hidden   - in play, in the tracker, but for the GM alone.
  //   active   - in play, for everyone the ownership allows.
  //
  // The two secret states are *enforced* by ownership, not merely drawn that
  // way: leaving `active` strips every player's permission, so the document
  // stops reaching their client at all. See ADR 0008.
  //
  // `active` is the initial value so an existing dial cannot vanish on upgrade;
  // a newly created one is set from the world default, `inactive`, at creation.
  state: new fields.StringField({
    initial: "active",
    choices: ["inactive", "hidden", "active"],
  }),

  // The ownership a dial had before it was concealed, so revealing it puts back
  // exactly what the GM had granted rather than a guess. Empty whenever the
  // dial is in play.
  revealedOwnership: new fields.ObjectField({ initial: {} }),

  // A locked dial refuses every write until it is unlocked.
  locked: new fields.BooleanField({ initial: false }),

  // Never shown to players by the module.
  gmNote: new fields.StringField({ initial: "" }),
};

export type DialSchema = typeof dialSchema;
