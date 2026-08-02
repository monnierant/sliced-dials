import { dialType, moduleId } from "../../constants";
import {
  activateDialList,
  dialsOf,
  renderDialList,
} from "../components/dialList";
import { createDial } from "../components/createDial";
import { openDialsPopup, showDialsToAll } from "../DialsPopup";
import { isDialsOnly, registerCombatSettings } from "./combatSettings";
import { filterCombatDials } from "./combatFilter";

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

  const tab = (id: string, label: string, badge?: number, icon?: string) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sd-combat-tab";
    button.dataset.sdTab = id;
    if (icon) {
      const glyph = document.createElement("i");
      glyph.className = `fa-solid ${icon}`;
      glyph.setAttribute("aria-hidden", "true");
      button.append(glyph);
    }
    button.append(label);
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
    tab(
      DIALS,
      localize("SLICEDDIALS.Combat.dials"),
      count,
      "fa-chart-pie"
    )
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
    section.insertAdjacentHTML(
      "beforeend",
      renderDialList(dials, { controls: true })
    );
  }

  section.prepend(buildActions(dials.length));
  return section;
}

/**
 * The bar above the dials. It sits inside the section rather than in the tab
 * nav so it survives the dials-only mode, where there is no nav at all.
 */
function buildActions(count: number): HTMLElement {
  const actions = document.createElement("div");
  actions.className = "sd-combat-actions";

  const button = (
    icon: string,
    key: string,
    onClick: () => void,
    label = false
  ) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "sd-combat-action";
    element.title = localize(key);
    // Icon-only unless `label` says otherwise, so the accessible name has to
    // be stated: a title is a hover affordance, not a name.
    element.setAttribute("aria-label", localize(key));
    element.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    if (label) element.append(` ${localize(key)}`);
    element.addEventListener("click", onClick);
    return element;
  };

  // Nothing to put in a window, and nothing to push at anyone.
  if (count > 0) {
    actions.append(
      button("fa-up-right-and-down-left-from-center", "SLICEDDIALS.Combat.open", openDialsPopup)
    );

    if ((game as any).user?.isGM) {
      actions.append(
        button("fa-eye", "SLICEDDIALS.Combat.showAll", showDialsToAll)
      );
    }
  }

  if ((game as any).user?.isGM) {
    actions.append(
      button("fa-plus", "SLICEDDIALS.Sidebar.create", () => void createDial(), true)
    );
  }

  return actions;
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
  const section = root.querySelector<HTMLElement>(".sd-combat-dials");

  // Dials-only means there is no nav to switch with, so the section is the
  // whole tracker - unless there is no section, in which case hiding the
  // encounter would leave an empty panel.
  const showing = section
    ? isDialsOnly()
      ? DIALS
      : root.querySelector(".sd-combat-tabs")
        ? activeTab
        : ENCOUNTER
    : ENCOUNTER;

  trackerParts(root, tracker).forEach((part) =>
    part.classList.toggle("sd-hidden", showing === DIALS)
  );

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

  const dials = filterCombatDials(dialsOf((game as any).items));

  // Nothing to show and nothing to create: a player in a game without dials
  // gets the plain tracker back, tabs and all removed.
  if (dials.length === 0 && !(game as any).user?.isGM) {
    applyTab(root, tracker);
    return;
  }

  const section = buildSection(dials);
  tracker.after(section);

  // In dials-only mode there is nothing to switch between, so there is no nav
  // to draw: the dials simply are the tracker.
  if (!isDialsOnly()) {
    const nav = buildNav(dials.length);
    tracker.before(nav);

    nav.querySelectorAll<HTMLElement>(".sd-combat-tab").forEach((button) => {
      button.addEventListener("click", () => {
        activeTab = button.dataset.sdTab ?? ENCOUNTER;
        applyTab(root, tracker);
      });
    });
  }

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
  registerCombatSettings();

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
