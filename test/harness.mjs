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
class ObjectField extends Field {}

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
      ObjectField,
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

// Completing a dial now reaches for the DOM to celebrate it. There is no
// browser here and there is nothing rendered to find, so a stub that answers
// "nothing" is exactly right: what the celebration draws is outside what this
// can check, and it must not take the write path down with it.
globalThis.document = { querySelectorAll: () => [] };
globalThis.window = { setTimeout: (fn, ms) => setTimeout(fn, ms) };
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
check(
  "Item subtype has an explicit translation key",
  CONFIG.Item.typeLabels?.["sliced-dials.dial"],
  "SLICEDDIALS.Dial.label"
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
check("ruleset listed", api.listRulesets().map((r) => r.id).sort(), [
  "generic-counter",
  "generic-slices",
  "test",
]);

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
  // Ownership lives on the document, not in the system data, and Foundry
  // merges it on update rather than replacing it. Both matter to the states.
  const { ownership = {}, ...systemOverrides } = overrides;
  const data = {
    size: 4,
    slices: [],
    ruleset: "test",
    allowedCategories: [],
    allowedSigns: ["+", "-"],
    onComplete: "lock",
    onCompleteState: "keep",
    celebration: "discreet",
    state: "active",
    revealedOwnership: {},
    locked: false,
    gmNote: "",
    ...systemOverrides,
  };
  const dial = {
    id: "d1",
    type: "sliced-dials.dial",
    name: "Fuite du <convoi>",
    isOwner: true,
    ownership: { ...ownership },
    testUserPermission: () => true,
    _data: data,
    system: new DialModel(data),
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        if (key === "ownership") dial.ownership = { ...dial.ownership, ...value };
        else dial._data[key.replace("system.", "")] = value;
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

// --- the closing category -------------------------------------------------
const placed = [{ sign: "+", category: "rock", userId: "u1", at: 0 }];

// One slice on a two-segment dial: the next one closes it.
const closing = makeDial({
  size: 2,
  slices: placed,
  closingCategory: "jazz",
});
check(
  "closing category refuses another at the last segment",
  api.canAddSlice(closing, { sign: "+", category: "rock", userId: "u1", at: 0 }).ok,
  false
);
check(
  "closing category accepts its own at the last segment",
  api.canAddSlice(closing, { sign: "+", category: "jazz", userId: "u1", at: 0 }).ok,
  true
);

// Same requirement, two segments left: it must not bite yet.
const notYet = makeDial({ size: 3, slices: placed, closingCategory: "jazz" });
check(
  "closing category ignored before the last segment",
  api.canAddSlice(notYet, { sign: "+", category: "rock", userId: "u1", at: 0 }).ok,
  true
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
check("GM can correct an auto-locked dial", (await api.removeLastSlice(dial)).ok, true);
check("correction keeps the dial locked", dial.system.locked, true);
check("correction removed the last slice", dial.system.value, 3);
check(
  "locked dial refuses more",
  api.canAddSlice(dial, { sign: "+", category: "rock", userId: "u1", at: 0 }).ok,
  false
);

// A ruleset with no mode keeps the historical slice semantics used by Cowboy
// Bebop: its negative sign placed and counted a slice above. Only the explicit
// generic counter interprets minus as movement backwards.
const counter = makeDial({
  ruleset: "generic-counter",
  color: "#123456",
  onComplete: "none",
});
check(
  "empty counter refuses to recede",
  api.canAddSlice(counter, { sign: "-", category: "progress", userId: "u1", at: 0 }).ok,
  false
);
await api.addSlice(counter, { sign: "+", category: "progress" });
await api.addSlice(counter, { sign: "+", category: "progress" });
await api.addSlice(counter, { sign: "-", category: "progress" });
check("counter advances then recedes", counter.system.value, 1);
check("counter keeps only its remaining progress", counter.system.composition, {
  positive: 1,
  negative: 0,
  byCategory: { progress: 1 },
});
check(
  "counter uses its per-dial colour",
  api.renderDial(counter).includes('fill="#123456"'),
  true
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
// Safe by default: the drawing carries no name unless one is handed to it,
// so no caller can leak a name by forgetting to think about it.
check("no label means no name", svg.includes("convoi"), false);
check(
  "a given label is escaped",
  api.renderDial(drawn, { label: drawn.name }).includes("Fuite du &lt;convoi&gt;"),
  true
);
check(
  "anonymous drops the slice tooltips",
  api.renderDial(drawn, { anonymous: true }).includes("<title>"),
  false
);
check("interactive class applied", svg.includes("sd-dial--interactive"), true);
check("pattern id scoped to the dial", svg.includes("sd-hatch-d1"), true);

// --- the shared list ------------------------------------------------------
// One implementation feeds the panel, the sidebar and any system sheet, so the
// anonymising rule is asserted once and holds in all three.
const listed = makeDial();
listed.name = "Convoy";
await api.addSlice(listed, { sign: "+", category: "rock" });

listed.testUserPermission = (_user, level) => level === "LIMITED";
const hidden = api.renderDialList([listed]);
check("LIMITED hides the name", hidden.includes("Convoy"), false);
check("LIMITED still draws the dial", hidden.includes("sd-segment"), true);
check("LIMITED is not interactive", hidden.includes("sd-dial--interactive"), false);

listed.testUserPermission = () => true;
const shown = api.renderDialList([listed]);
check("OBSERVER shows the name", shown.includes("Convoy"), true);
check("an owner may act", shown.includes("sd-dial--interactive"), true);

listed.system.locked = true;
check(
  "a locked dial is not interactive",
  api.renderDialList([listed]).includes("sd-dial--interactive"),
  false
);
listed.system.locked = false;

check(
  "read-only mounting disables interaction",
  api.renderDialList([listed], { interactive: false }).includes("sd-dial--interactive"),
  false
);

// dialsOf reads any collection, which is what lets a system pass an actor.
const embedded = { items: [listed, { type: "weapon" }] };
check("dialsOf keeps only dials", api.dialsOf(embedded).length, 1);

// --- states ---------------------------------------------------------------
// The state decides which surfaces a dial reaches; ownership, checked above,
// decides how much of it a viewer gets. Both have to pass.
const states = {
  items: [
    makeDial({ state: "active" }),
    makeDial({ state: "hidden" }),
    makeDial({ state: "inactive" }),
  ],
};

check("in play, the GM sees the hidden one too", api.dialsOf(states).length, 2);
check("the directory sees every state", api.dialsOf(states, { states: "all" }).length, 3);

game.user.isGM = false;
check("a player sees neither hidden nor prepared", api.dialsOf(states).length, 1);
game.user.isGM = true;

// Concealing is enforced through ownership, not merely drawn: the document has
// to stop reaching a player's client at all.
const secret = makeDial({
  state: "active",
  ownership: { default: 0, "u-alice": 3 },
});

await api.setState(secret, "hidden");
check("concealing drops every granted level", secret.ownership, {
  default: 0,
  "u-alice": 0,
});
check(
  "what was granted is kept aside",
  secret.system.revealedOwnership,
  { default: 0, "u-alice": 3 }
);

// Prepared is just as concealed, and must not overwrite the backup with the
// stripped map it now reads.
await api.setState(secret, "inactive");
check(
  "hiding twice keeps the first backup",
  secret.system.revealedOwnership,
  { default: 0, "u-alice": 3 }
);

await api.setState(secret, "active");
check("revealing puts back exactly what was granted", secret.ownership, {
  default: 0,
  "u-alice": 3,
});
check("nothing is kept aside once in play", secret.system.revealedOwnership, {});

// Completion is executed by whoever placed the final slice. A player-owned
// dial must still be able to carry out the state consequence its GM configured
// beforehand; this private consequence is distinct from the GM-only API.
const completingPlayerDial = makeDial({
  size: 1,
  onComplete: "none",
  onCompleteState: "hidden",
  ownership: { default: 2 },
});
game.user.isGM = false;
await api.addSlice(completingPlayerDial, { sign: "+", category: "rock" });
await new Promise((resolve) => setTimeout(resolve, 2500));
check(
  "player completion applies its declared state",
  completingPlayerDial.system.state,
  "hidden"
);
check(
  "player completion conceals ownership",
  completingPlayerDial.ownership.default,
  0
);
game.user.isGM = true;

// A dial that has never been revealed has nothing to put back, and "in play"
// has to mean somebody can see it.
const fresh = makeDial({ state: "inactive", ownership: { default: 0 } });
await api.setState(fresh, "active");
check("a first reveal gives the table Observer", fresh.ownership.default, 2);

// Unless the GM has already named who this dial is for.
const named = makeDial({ state: "inactive", ownership: { "u-alice": 3 } });
await api.setState(named, "active");
check("a named player is not widened to the table", named.ownership, {
  "u-alice": 3,
});

game.user.isGM = false;
check(
  "a player cannot change a state",
  (await api.setState(fresh, "hidden")).ok,
  false
);
game.user.isGM = true;

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
