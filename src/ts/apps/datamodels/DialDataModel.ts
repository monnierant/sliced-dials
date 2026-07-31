import TypeDataModel = foundry.abstract.TypeDataModel;
import { DialSchema, dialSchema } from "../schemas/dialSchema";
import { Sign } from "../../types";

export interface Composition {
  positive: number;
  negative: number;
  // Slice count per category, so a completion message can say which category
  // carried the dial without the module knowing what any of them mean.
  byCategory: Record<string, number>;
}

export default class DialDataModel extends TypeDataModel<DialSchema, any> {
  static override defineSchema() {
    return dialSchema;
  }

  // How many segments are filled. Derived rather than stored: a stored counter
  // and a slice list are two sources of truth that will drift.
  get value(): number {
    return (this as any).slices.length;
  }

  get free(): number {
    return Math.max(0, (this as any).size - this.value);
  }

  get isComplete(): boolean {
    return this.value >= (this as any).size;
  }

  get composition(): Composition {
    const result: Composition = { positive: 0, negative: 0, byCategory: {} };
    for (const slice of (this as any).slices) {
      if ((slice.sign as Sign) === "+") result.positive += 1;
      else result.negative += 1;
      result.byCategory[slice.category] =
        (result.byCategory[slice.category] ?? 0) + 1;
    }
    return result;
  }
}
