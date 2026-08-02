import { dialType } from "../../constants";
import { setState } from "../../slices";
import { dialDefaults } from "../settings/dialDefaults";

/**
 * Creating a dial and opening it is the same gesture wherever it is offered -
 * the directory, the combat tracker - so it lives in one place. Two copies
 * would be two chances to forget the sheet, or the defaults.
 */
export async function createDial(): Promise<any> {
  const defaults = dialDefaults();

  const dial = await (Item as any).create({
    name: (game as any).i18n?.localize("SLICEDDIALS.Sidebar.newDial") ?? "Dial",
    type: dialType,
    system: defaults,
  });

  // A new document is already unreadable by the players, which is what the two
  // concealed states want. Only "in play" has anything to grant, and it has to
  // go through setState rather than be written here.
  if (dial && defaults.state === "active") {
    await setState(dial, "active");
  }

  dial?.sheet?.render(true);
  return dial;
}
