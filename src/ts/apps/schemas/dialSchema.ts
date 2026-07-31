// The import = form is what lets the field classes be referenced directly.
import fields = foundry.data.fields;

export const MIN_SIZE = 2;
export const MAX_SIZE = 12;

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
    min: MIN_SIZE,
    max: MAX_SIZE,
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

  // Cowboy Bebop creates single-signed dials - objective dials and threat
  // dials - while a system may want mixed dials where the final composition
  // decides. Both fall out of this one field.
  allowedSigns: new fields.ArrayField(
    new fields.StringField({ choices: ["+", "-"] }),
    { initial: ["+", "-"] }
  ),

  onComplete: new fields.StringField({
    initial: "lock",
    choices: ["lock", "reset", "none"],
  }),

  // A locked dial refuses every write until it is unlocked.
  locked: new fields.BooleanField({ initial: false }),

  // Never shown to players by the module.
  gmNote: new fields.StringField({ initial: "" }),
};

export type DialSchema = typeof dialSchema;
