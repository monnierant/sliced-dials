// TEMPORARY SCAFFOLDING.
//
// The registry is frozen at `setup`, so a ruleset cannot be registered from the
// console, and there is no display surface yet. Without these two helpers the
// module cannot be exercised in a world at all before a consuming system
// exists. Delete this file once the HUD lands.

import { addSlice, canAddSlice } from "./api";
import { renderDial } from "./apps/components/renderDial";
import { dialType } from "./constants";
import { registerRuleset } from "./registry";
import { Sign } from "./types";

export const DEMO_RULESET = "demo";

export function registerDemoRuleset(): void {
  registerRuleset({
    id: DEMO_RULESET,
    categories: {
      rock: { label: "Rock", color: "#f44336" },
      blues: { label: "Blues", color: "#2196f3" },
      jazz: { label: "Jazz", color: "#ff9800" },
    },
  });
}

/** Creates a world dial to play with. */
export async function debugCreateDial(size = 6): Promise<any> {
  return (Item as any).create({
    name: "Demo dial",
    type: dialType,
    system: { size, ruleset: DEMO_RULESET },
  });
}

/**
 * A floating panel showing one dial, deliberately built out of plain DOM rather
 * than Foundry's application API: this is throwaway and must not become a
 * dependency of the real HUD.
 */
export function debugShow(dial: any): void {
  const existing = document.getElementById("sd-debug");
  existing?.remove();

  const panel = document.createElement("div");
  panel.id = "sd-debug";
  panel.style.cssText =
    "position:fixed;top:80px;right:20px;z-index:1000;background:rgba(20,20,20,.9);" +
    "padding:12px;border-radius:6px;color:#eee;width:200px;font-size:12px;";

  let category = "rock";
  let sign: Sign = "+";

  const draw = () => {
    const current = (game as any).items?.get(dial.id) ?? dial;
    panel.innerHTML =
      `<div style="margin-bottom:6px">${current.name} ` +
      `${current.system.value}/${current.system.size}</div>` +
      renderDial(current, { interactive: true }) +
      `<div style="margin-top:8px">` +
      ["rock", "blues", "jazz"]
        .map(
          (key) =>
            `<button type="button" data-cat="${key}" ` +
            `style="${key === category ? "font-weight:bold" : ""}">${key}</button>`
        )
        .join("") +
      `</div><div style="margin-top:4px">` +
      (["+", "-"] as Sign[])
        .map(
          (s) =>
            `<button type="button" data-sign="${s}" ` +
            `style="${s === sign ? "font-weight:bold" : ""}">${s}</button>`
        )
        .join("") +
      `</div>`;

    panel.querySelectorAll<HTMLElement>("[data-cat]").forEach((button) =>
      button.addEventListener("click", () => {
        category = button.dataset.cat!;
        draw();
      })
    );
    panel.querySelectorAll<HTMLElement>("[data-sign]").forEach((button) =>
      button.addEventListener("click", () => {
        sign = button.dataset.sign as Sign;
        draw();
      })
    );

    panel.querySelectorAll<SVGPathElement>(".sd-segment").forEach((segment) =>
      segment.addEventListener("click", async () => {
        const live = (game as any).items?.get(dial.id) ?? dial;
        const verdict = await addSlice(live, { sign, category });
        if (!verdict.ok) ui.notifications?.warn(verdict.reason ?? "Refused");
        draw();
      })
    );
  };

  draw();
  document.body.appendChild(panel);

  // Keep the panel honest when the dial changes from anywhere else.
  Hooks.on("updateItem", (item: any) => {
    if (item.id === dial.id) draw();
  });
}

export const debugApi = {
  createDial: debugCreateDial,
  show: debugShow,
  canAddSlice,
};
