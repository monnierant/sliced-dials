// Exercises the actually-built bundle against a minimal stand-in for Foundry.
// This is not Foundry, and anything that depends on real document persistence
// or on the real DataModel machinery is NOT covered. What it does cover is our
// own logic: validation, the write path, completion, and the SVG output.

const chat = [];
const hooks = { init: [], setup: [], other: {} };

class Field {
  constructor(options = {}) {
    this.options = options;
  }
}
class ArrayField extends Field {
  constructor(element, options) {
    super(options);
    this.element = element;
  }
}
class SchemaField extends Field {}

globalThis.foundry = {
  abstract: {
    TypeDataModel: class {
      constructor(data = {}) {
        Object.assign(this, data);
      }
      static defineSchema() {
        return {};
      }
    },
  },
  applications: {
    api: {
      ApplicationV2: class {
        render() {
          /* the panel is never mounted here; only its module must load */
        }
      },
      HandlebarsApplicationMixin: (Base) => class extends Base {},
    },
    sheets: {
      ItemSheetV2: class {
        render() {
          /* same: the sheet is browser territory */
        }
      },
    },
  },
  data: {
    fields: {
      StringField: Field,
      NumberField: Field,
      BooleanField: Field,
      ArrayField,
      SchemaField,
    },
  },
};

const moduleEntry = {};
const settings = new Map();
globalThis.game = {
  user: { id: "u-gm", isGM: true },
  users: { get: (id) => ({ name: id === "u-gm" ? "MJ" : "Alice" }) },
  modules: { get: () => moduleEntry },
  i18n: { localize: (k) => k },
  settings: {
    register: (scope, key, config) =>
      settings.set(`${scope}.${key}`, config.default),
    get: (scope, key) => settings.get(`${scope}.${key}`),
    set: async (scope, key, value) => settings.set(`${scope}.${key}`, value),
  },
};
globalThis.CONFIG = { Item: { dataModels: {} } };
globalThis.Handlebars = { registerHelper: () => {} };
globalThis.ChatMessage = {
  create: async (data) => {
    chat.push(data);
    return data;
  },
};
globalThis.Hooks = {
  once: (name, fn) => (hooks[name] ??= []).push(fn),
  on: (name, fn) => ((hooks.other[name] ??= []).push(fn)),
  callAll: (name, ...args) => {
    (hooks.other[name] ?? []).forEach((fn) => fn(...args));
    return true;
  },
};

await import(
  new URL("../dist/scripts/module.js", import.meta.url)
);

let failures = 0;
const check = (label, actual, expected) => {
  const okay = JSON.stringify(actual) === JSON.stringify(expected);
  if (!okay) {
    failures += 1;
    console.log(
      `FAIL ${label}\n  got      ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`
    );
  } else console.log(`ok   ${label}`);
};

// --- init -----------------------------------------------------------------
let registeredApi = null;
Hooks.on("slicedDials.register", (api) => (registeredApi = api));
hooks.init.forEach((fn) => fn());

check("register hook received the api", registeredApi !== null, true);
check("api published on the module entry", moduleEntry.api === registeredApi, true);
check(
  "Item subtype registered",
  typeof CONFIG.Item.dataModels["sliced-dials.dial"],
  "function"
);

const api = moduleEntry.api;
const DialModel = CONFIG.Item.dataModels["sliced-dials.dial"];

// --- ruleset --------------------------------------------------------------
api.registerRuleset({
  id: "test",
  categories: {
    rock: { label: "Rock", color: "#f44336" },
    jazz: { label: "Jazz", color: "#ff9800" },
  },
  validate: (dial, slice) =>
    slice.category === "jazz" && dial.system.value === 0
      ? { ok: false, reason: "Jazz cannot open a dial." }
      : { ok: true },
});
// "demo" comes from the temporary scaffolding and goes away with it.
check("ruleset listed", api.listRulesets().map((r) => r.id).sort(), ["demo", "test"]);

// Freezing happens at setup; a late registration must be refused.
hooks.setup.forEach((fn) => fn());
let lateError = null;
try {
  api.registerRuleset({ id: "late", categories: {} });
} catch (e) {
  lateError = e.message;
}
check("late registration refused", lateError !== null, true);

// --- a dial ---------------------------------------------------------------
function makeDial(overrides = {}) {
  const data = {
    size: 4,
    slices: [],
    ruleset: "test",
    allowedCategories: [],
    allowedSigns: ["+", "-"],
    onComplete: "lock",
    locked: false,
    gmNote: "",
    ...overrides,
  };
  const dial = {
    id: "d1",
    name: 'Fuite du <convoi>',
    isOwner: true,
    _data: data,
    system: new DialModel(data),
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        dial._data[key.replace("system.", "")] = value;
      }
      dial.system = new DialModel(dial._data);
    },
  };
  return dial;
}

const dial = makeDial();
check("empty dial value", dial.system.value, 0);
check("empty dial not complete", dial.system.isComplete, false);

// --- validation -----------------------------------------------------------
check(
  "unknown category refused",
  api.canAddSlice(dial, { sign: "+", category: "tango", userId: "u1", at: 0 }).ok,
  false
);
check(
  "system validator refused jazz opening",
  api.canAddSlice(dial, { sign: "+", category: "jazz", userId: "u1", at: 0 }).reason,
  "Jazz cannot open a dial."
);

const singleSigned = makeDial({ allowedSigns: ["+"] });
check(
  "single-signed dial refuses the other sign",
  api.canAddSlice(singleSigned, { sign: "-", category: "rock", userId: "u1", at: 0 }).ok,
  false
);

// --- the write path -------------------------------------------------------
await api.addSlice(dial, { sign: "+", category: "rock" });
check("one slice placed", dial.system.value, 1);
check("placement announced in chat", chat.length, 1);
check("author recorded", dial.system.slices[0].userId, "u-gm");

await api.addSlice(dial, { sign: "-", category: "rock" });
check("composition counts both signs", dial.system.composition, {
  positive: 1,
  negative: 1,
  byCategory: { rock: 2 },
});

await api.addSlice(dial, { sign: "+", category: "jazz" });
await api.addSlice(dial, { sign: "+", category: "jazz" });
check("dial complete", dial.system.isComplete, true);
check("locked by onComplete", dial.system.locked, true);
check("completion announced", chat.length, 5);
check(
  "full dial refuses more",
  api.canAddSlice(dial, { sign: "+", category: "rock", userId: "u1", at: 0 }).ok,
  false
);

// --- corrections are the GM's -------------------------------------------
const correctable = makeDial();
await api.addSlice(correctable, { sign: "+", category: "rock" });
game.user.isGM = false;
check("player cannot undo", (await api.removeLastSlice(correctable)).ok, false);
game.user.isGM = true;
check("gm can undo", (await api.removeLastSlice(correctable)).ok, true);
check("undo removed the slice", correctable.system.value, 0);

// --- ownership ------------------------------------------------------------
const notMine = makeDial();
notMine.isOwner = false;
check(
  "non-owner write refused",
  (await api.addSlice(notMine, { sign: "+", category: "rock" })).ok,
  false
);

// --- shrinking a dial -----------------------------------------------------
// Only categories the "test" ruleset declares: anything else is refused, which
// is the point of the ruleset.
const shrunk = makeDial({ size: 6 });
for (const category of ["rock", "jazz", "rock", "jazz", "rock"])
  await api.addSlice(shrunk, { sign: "+", category });
check("five placed on a six", shrunk.system.value, 5);

// The trim itself is checked by test:geometry, which runs the real function
// rather than a copy of it. What is worth asserting here is that a dial can
// actually get into the overflowing state the trim exists to fix.
check("overflow state is reachable", shrunk.system.slices.length > 4, true);

// --- rendering ------------------------------------------------------------
const drawn = makeDial();
await api.addSlice(drawn, { sign: "+", category: "rock" });
await api.addSlice(drawn, { sign: "-", category: "jazz" });
const svg = api.renderDial(drawn, { interactive: true });

check("four segments drawn", (svg.match(/class="sd-segment /g) || []).length, 4);
check("two filled", (svg.match(/sd-segment--filled/g) || []).length, 2);
check("two empty", (svg.match(/sd-segment--empty/g) || []).length, 2);
check("category colour used", svg.includes('fill="#f44336"'), true);
check("negative slice hatched", (svg.match(/sd-segment-hatch/g) || []).length, 1);
check("positive slice not hatched", (svg.match(/sd-segment-hatch/g) || []).length, 1);
check("author in the title", svg.includes("+1 Rock - MJ"), true);
check("dial name escaped", svg.includes("Fuite du &lt;convoi&gt;"), true);
check("interactive class applied", svg.includes("sd-dial--interactive"), true);
check("pattern id scoped to the dial", svg.includes("sd-hatch-d1"), true);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
