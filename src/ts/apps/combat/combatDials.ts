import { dialType, moduleId } from "../../constants";
import {
  activateDialList,
  dialsOf,
  renderDialList,
} from "../components/dialList";
import { createDial } from "../components/createDial";

// Dials belong where the table is already looking during a fight, so they get a
// tab inside the combat tracker rather than a root tab of their own. The
// tracker renders whether or not an encounter exists, so this is a home even
// out of combat - it is not tied to a Combat document in any way.
//
// This grafts onto the rendered markup rather than subclassing CONFIG.ui.combat
// on purpose: that property is a single slot, and it is exactly the one every
// combat tracker module replaces. Sharing the DOM costs us the core tab styling
// and nothing else.

const ENCOUNTER = "encounter";
const DIALS = "dials";

// Which tab is showing, kept in memory rather than in a setting: the tracker is
// re-rendered constantly and must not lose the tab mid-fight, but a fresh
// session should open on the encounter.
let activeTab: string = ENCOUNTER;

let warned = false;

/** The combatant list, whatever this Foundry version calls it. */
function findTracker(root: HTMLElement): HTMLElement | null {
  const selectors = [
    "ol.combat-tracker",
    "ol.combatants",
    ".combat-tracker",
    "#combat-tracker",
  ];

  for (const selector of selectors) {
    const found = root.querySelector<HTMLElement>(selector);
    if (found && found !== root) return found;
  }

  return null;
}

function localize(key: string): string {
  return (game as any).i18n?.localize(key) ?? key;
}

function buildNav(count: number): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = "sd-combat-tabs";

  const tab = (id: string, label: string, badge?: number) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sd-combat-tab";
    button.dataset.sdTab = id;
    button.textContent = label;
    if (badge) {
      const span = document.createElement("span");
      span.className = "sd-combat-count";
      span.textContent = String(badge);
      button.append(span);
    }
    return button;
  };

  nav.append(
    tab(ENCOUNTER, localize("SLICEDDIALS.Combat.encounter")),
    tab(DIALS, localize("SLICEDDIALS.Combat.dials"), count)
  );

  return nav;
}

function buildSection(dials: any[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "sd-combat-dials";

  if (dials.length === 0) {
    const empty = document.createElement("p");
    empty.className = "sd-combat-empty";
    empty.textContent = localize("SLICEDDIALS.Sidebar.empty");
    section.append(empty);
  } else {
    section.insertAdjacentHTML("beforeend", renderDialList(dials));
  }

  if ((game as any).user?.isGM) {
    const actions = document.createElement("div");
    actions.className = "sd-combat-actions";

    const create = document.createElement("button");
    create.type = "button";
    create.className = "sd-combat-create";
    create.innerHTML = `<i class="fa-solid fa-plus"></i> `;
    create.append(localize("SLICEDDIALS.Sidebar.create"));
    create.addEventListener("click", () => void createDial());

    actions.append(create);
    section.append(actions);
  }

  return section;
}

/**
 * Placing a slice is what a click does everywhere else in the module, so the
 * sheet needs its own gesture. Right-click matches the rest of the sidebar,
 * where context menus are how you get at a document.
 */
function activateSheetOpening(section: HTMLElement): void {
  section.querySelectorAll<HTMLElement>(".sd-hud-dial").forEach((entry) => {
    entry.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const dial = (game as any).items?.get(entry.dataset.dialId);
      if (dial?.isOwner) dial.sheet?.render(true);
    });
  });
}

/** Everything the tracker owns, hidden while the dials tab is up. */
function trackerParts(root: HTMLElement, tracker: HTMLElement): HTMLElement[] {
  const footer = root.querySelector<HTMLElement>(
    ".combat-controls, footer.combat-controls"
  );
  return footer ? [tracker, footer] : [tracker];
}

function applyTab(root: HTMLElement, tracker: HTMLElement): void {
  const showing = root.querySelector(".sd-combat-tabs") ? activeTab : ENCOUNTER;

  trackerParts(root, tracker).forEach((part) =>
    part.classList.toggle("sd-hidden", showing === DIALS)
  );

  const section = root.querySelector<HTMLElement>(".sd-combat-dials");
  section?.classList.toggle("sd-hidden", showing !== DIALS);

  root.querySelectorAll<HTMLElement>(".sd-combat-tab").forEach((button) => {
    button.classList.toggle("sd-active", button.dataset.sdTab === showing);
  });
}

/**
 * Idempotent: the tracker re-renders on every turn, every initiative roll and
 * every dial change, and each pass must leave exactly one nav and one section
 * behind.
 */
function inject(root: HTMLElement): void {
  const tracker = findTracker(root);

  if (!tracker) {
    if (!warned) {
      warned = true;
      console.warn(
        `${moduleId} | no combatant list found in the combat tracker; ` +
          `another module may have replaced it. Dials stay in their own tab ` +
          `and in the panel.`
      );
    }
    return;
  }

  // Marks a tracker we have already reached, so a later dial change knows
  // where to redraw - including the pass that found nothing to draw.
  root.classList.add("sd-combat-host");

  root
    .querySelectorAll(".sd-combat-tabs, .sd-combat-dials")
    .forEach((node) => node.remove());

  const dials = dialsOf((game as any).items);

  // Nothing to show and nothing to create: a player in a game without dials
  // gets the plain tracker back, tabs and all removed.
  if (dials.length === 0 && !(game as any).user?.isGM) {
    applyTab(root, tracker);
    return;
  }

  const nav = buildNav(dials.length);
  const section = buildSection(dials);

  tracker.before(nav);
  tracker.after(section);

  nav.querySelectorAll<HTMLElement>(".sd-combat-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.sdTab ?? ENCOUNTER;
      applyTab(root, tracker);
    });
  });

  activateDialList(section);
  activateSheetOpening(section);
  applyTab(root, tracker);
}

/** Every tracker on screen: the sidebar one, and the popped-out one. */
function refresh(): void {
  document
    .querySelectorAll<HTMLElement>(".sd-combat-host")
    .forEach((root) => inject(root));
}

export function registerCombatTrackerTab(): void {
  Hooks.on("renderCombatTracker", ((_app: any, html: any) => {
    // v13 hands over an HTMLElement; older versions a jQuery object.
    const root: HTMLElement | undefined = html?.[0] ?? html;
    if (root instanceof HTMLElement) inject(root);
  }) as any);

  const onDialChange = (document: any) => {
    if (document?.type === dialType) refresh();
  };

  Hooks.on("createItem", onDialChange);
  Hooks.on("updateItem", onDialChange);
  Hooks.on("deleteItem", onDialChange);
}
