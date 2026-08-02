import { celebrationMs, completedHook } from "../constants";
import { renderDial } from "./components/renderDial";
import { broadcast, onSocket } from "./sockets";

// Filling a dial is what the table has been playing towards, so it gets a
// moment. How big a moment is the dial's own business - see `celebration` in
// the schema - because the end of a heist and a threat clock ticking over do
// not deserve the same noise.

const GLOW_MS = celebrationMs;

const localize = (key: string): string =>
  (game as any).i18n?.localize(key) ?? key;

/**
 * Every drawing of this dial on this screen, wherever it is: the tracker, the
 * panel, the window, a system's sheet. They all carry the id, which is what
 * makes one selector enough.
 */
function glow(dialId: string): void {
  document
    .querySelectorAll<SVGElement>(`svg.sd-dial[data-dial-id="${dialId}"]`)
    .forEach((svg) => {
      svg.classList.remove("sd-celebrating");
      // Forcing a reflow between the two restarts the animation on a dial
      // that is celebrating already - a recurring dial completes twice in a
      // row, and the second one must not be swallowed.
      svg.getBoundingClientRect();
      svg.classList.add("sd-celebrating");
      window.setTimeout(() => svg.classList.remove("sd-celebrating"), GLOW_MS);
    });
}

function modal(dial: any): void {
  const DialogV2 = (foundry as any).applications?.api?.DialogV2;
  if (!DialogV2) return glow(dial.id);

  const composition = dial.system.composition;
  const line = (game as any).i18n
    ?.format?.("SLICEDDIALS.Celebration.composition", composition)
    ?.replace("{positive}", composition.positive)
    ?.replace("{negative}", composition.negative);

  const content =
    `<div class="sd-celebration">` +
    renderDial(dial, { interactive: false, label: dial.name }) +
    `<p class="sd-celebration-title">${dial.name}</p>` +
    `<p class="sd-celebration-line">${line ?? ""}</p>` +
    `</div>`;

  void DialogV2.prompt({
    window: { title: localize("SLICEDDIALS.Celebration.completed") },
    classes: ["sliced-dials", "sliced-dials-celebration"],
    content,
    ok: { label: localize("SLICEDDIALS.Celebration.close") },
  });
}

/** Plays it on this screen, for a viewer allowed to know what happened. */
function play(dial: any): void {
  const kind = dial?.system?.celebration ?? "discreet";
  if (kind === "none") return;

  // A modal names the dial, so it belongs only to someone the dial is not
  // anonymous for. Everyone else gets the glow, which says "something landed"
  // without saying what - which is the point of Limited.
  const named = dial.testUserPermission((game as any).user, "OBSERVER");

  if (kind === "modal" && named) modal(dial);
  else glow(dial.id);
}

/**
 * Announces a completion here and asks every other client to do the same. The
 * dial itself has already been updated through Foundry; this carries nothing
 * but "look at this one now".
 */
export function celebrate(dial: any): void {
  play(dial);
  broadcast({ action: "celebrate", dialId: dial.id });
}

/**
 * The celebration listens to the completion hook rather than being called from
 * the write path. It is a consumer of that hook exactly like a game system is,
 * which keeps the write path unaware of anything visual - and keeps the import
 * graph a tree.
 */
export function registerCelebration(): void {
  Hooks.on(completedHook, (dial: any) => celebrate(dial));

  onSocket((message) => {
    if (message.action !== "celebrate") return;

    const dial = (game as any).items?.get(message.dialId);
    // Not visible to this user - or not visible yet: nothing to celebrate.
    if (!dial?.testUserPermission?.((game as any).user, "LIMITED")) return;
    if (dial.system?.state === "inactive") return;
    if (dial.system?.state === "hidden" && !(game as any).user?.isGM) return;

    play(dial);
  });
}
