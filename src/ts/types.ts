// A slice is positive or negative. The sign is orthogonal to the category: the
// same category can push either way depending on the fiction.
export type Sign = "+" | "-";

// One placed slice, occupying exactly one segment. A slice is never worth more
// than one segment - an effect that "counts double" places two slices, so what
// the dial draws is always exactly what was placed.
export interface Slice {
  sign: Sign;
  // Opaque to this module. Meaning, label, colour and icon come from the
  // ruleset the owning system registered.
  category: string;
  // Who placed it. This is what makes the history readable and the undo honest.
  userId: string;
  at: number;
}

// What happens the moment a dial fills up. The consequence in the fiction is
// never this module's business; this is only the state the dial is left in.
export type OnComplete = "lock" | "reset" | "none";

// Where a dial is in play. State and permission answer different questions,
// but concealed states also strip player ownership so the document itself no
// longer reaches their clients. See ADR 0008.
export type DialState = "inactive" | "hidden" | "active";

export interface Category {
  label: string;
  // CSS colour used for the slice fill.
  color: string;
  // Font Awesome class, e.g. "fa-solid fa-bolt".
  icon?: string;
}

// The answer to "may this slice go on this dial?". Carrying a reason rather
// than a bare boolean is what lets the interface explain a greyed-out slice
// instead of silently swallowing the click.
export interface Verdict {
  ok: boolean;
  reason?: string;
}

// What a game system registers. `validate` is optional: the declarative
// constraints carried by the dial itself cover the common cases.
export interface Ruleset {
  id: string;
  categories: Record<string, Category>;
  validate?: (dial: any, slice: Slice) => Verdict;
}
