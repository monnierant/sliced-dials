import { dialType } from "../../constants";
import { setState } from "../../slices";
import { DialState } from "../../types";
import { renderDial } from "../components/renderDial";

// A dial has no artwork of its own, so the directory shows it as the generic
// item icon - the one thing on screen that says nothing about the dial. The
// drawing already exists and is the dial's real portrait, so it takes the
// thumbnail's place.
//
// This grafts onto the rendered markup rather than writing an image to the
// document: the dial changes on every slice, and an `img` would have to be
// regenerated and stored on every one of them.

const THUMB = "sd-directory-thumb";
const CONTROLS = "sd-directory-controls";
// Marks a directory we have already reached, so a later slice knows where to
// redraw without having to guess at this version's sidebar markup.
const HOST = "sd-directory-host";

const isGM = (): boolean => (game as any).user?.isGM === true;

const localize = (key: string): string =>
  (game as any).i18n?.localize(key) ?? key;

/** The entry's document, whatever this Foundry version names the attribute. */
function dialOf(entry: HTMLElement): any {
  const id = entry.dataset.entryId ?? entry.dataset.documentId;
  if (!id) return undefined;

  const item = (game as any).items?.get(id);
  return item?.type === dialType ? item : undefined;
}

function drawing(dial: any): string {
  const user = (game as any).user;
  // The same rule the lists follow: a dial held at LIMITED shows that something
  // is ticking, never what. Its name is already withheld by core, and the
  // tooltips would hand it back.
  const anonymous = !dial.testUserPermission(user, "OBSERVER");

  return renderDial(dial, {
    anonymous,
    label: anonymous ? undefined : dial.name,
  });
}

function toggle(
  className: string,
  icon: string,
  title: string,
  next: DialState,
  disabled = false
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.dataset.next = next;
  button.disabled = disabled;
  button.innerHTML = `<i class="fa-solid ${icon}"></i>`;
  return button;
}

/**
 * The three states of ADR 0008 laid out as the two questions a GM actually
 * asks: is this dial in play at all, and may the players see it. Turning a dial
 * off from hidden and back on returns it in play rather than hidden - the
 * remembered secret is the ownership, not the state, and a dial coming back
 * should be one gesture from being seen.
 */
function controls(dial: any): HTMLElement {
  const state: DialState = dial.system?.state ?? "active";
  const inactive = state === "inactive";
  const hidden = state === "hidden";

  const bar = document.createElement("div");
  bar.className = CONTROLS;

  bar.append(
    toggle(
      "sd-power",
      inactive ? "fa-toggle-off" : "fa-toggle-on",
      localize(`SLICEDDIALS.Sidebar.${inactive ? "activate" : "deactivate"}`),
      inactive ? "active" : "inactive"
    ),
    // A prepared dial is not in anyone's client, so there is nothing to reveal
    // or conceal until it is in play: the eye is shown, and refuses.
    toggle(
      "sd-eye",
      hidden ? "fa-eye-slash" : "fa-eye",
      localize(`SLICEDDIALS.Sidebar.${hidden ? "reveal" : "conceal"}`),
      hidden ? "active" : "hidden",
      inactive
    )
  );

  return bar;
}

function activateControls(bar: HTMLElement, dial: any): void {
  bar.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.addEventListener("click", (event) => {
      // The whole row opens the sheet; without this, changing a state would
      // open it every time.
      event.preventDefault();
      event.stopPropagation();
      void setState(dial, button.dataset.next as DialState);
    });
  });
}

/**
 * Idempotent, and re-entrant on a directory that has already been decorated:
 * the first pass swaps the `img` out, later ones redraw inside the frame it
 * left behind.
 */
function decorate(root: HTMLElement): void {
  root.classList.add(HOST);

  root
    // The row itself, not the links inside it that carry the same id: the
    // controls are appended to whatever this matches.
    .querySelectorAll<HTMLElement>("li[data-entry-id], li[data-document-id]")
    .forEach((entry) => {
      const dial = dialOf(entry);
      if (!dial) return;

      const existing = entry.querySelector<HTMLElement>(`.${THUMB}`);

      if (existing) {
        existing.innerHTML = drawing(dial);
      } else {
        const image = entry.querySelector<HTMLElement>("img");
        if (!image) return;

        const frame = document.createElement("span");
        // Keeps whatever classes core sized and placed the image with, so the
        // dial lands in the same box rather than in a hole where one used to
        // be.
        frame.className = `${image.className} ${THUMB}`.trim();
        frame.innerHTML = drawing(dial);
        image.replaceWith(frame);
      }

      // Rebuilt rather than updated: a state change moves both buttons at
      // once, and the pass that redraws the dial is the same one.
      entry.querySelector(`.${CONTROLS}`)?.remove();
      if (!isGM()) return;

      const bar = controls(dial);
      activateControls(bar, dial);
      entry.append(bar);
    });
}

/** Every item directory on screen: the sidebar one, and any popped out. */
function refresh(): void {
  document
    .querySelectorAll<HTMLElement>(`.${HOST}`)
    .forEach((root) => decorate(root));
}

export function registerDirectoryThumbs(): void {
  Hooks.on("renderItemDirectory", ((_app: any, html: any) => {
    // v13 hands over an HTMLElement; older versions a jQuery object.
    const root: HTMLElement | undefined = html?.[0] ?? html;
    if (root instanceof HTMLElement) decorate(root);
  }) as any);

  // Core only re-renders the directory when a field it draws changes, and
  // slices are not one of them: a placed slice would otherwise leave a stale
  // dial sitting in the list until something else redrew it.
  Hooks.on("updateItem", (item: any) => {
    if (item?.type === dialType) refresh();
  });
}
