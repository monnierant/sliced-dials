import { dialType } from "../../constants";

/**
 * Creating a dial and opening it is the same gesture wherever it is offered -
 * the directory, the combat tracker - so it lives in one place. Two copies
 * would be two chances to forget the sheet.
 */
export async function createDial(): Promise<any> {
  const dial = await (Item as any).create({
    name: (game as any).i18n?.localize("SLICEDDIALS.Sidebar.newDial") ?? "Dial",
    type: dialType,
  });

  dial?.sheet?.render(true);
  return dial;
}
