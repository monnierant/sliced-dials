import { moduleId } from "../constants";

// The one socket this module uses. Everything crossing it is a *request to
// show something*, never a write: no client is ever told to change a dial.
// Dials are documents, and Foundry already syncs those.

export const socketName = `module.${moduleId}`;

export type SocketMessage =
  | { action: "showDials" }
  | { action: "celebrate"; dialId: string };

type Handler = (message: SocketMessage) => void;

const handlers: Handler[] = [];

export function onSocket(handler: Handler): void {
  handlers.push(handler);
}

/** Sends to every other client. The sender acts on its own copy directly. */
export function broadcast(message: SocketMessage): void {
  (game as any).socket?.emit(socketName, message);
}

export function registerSocket(): void {
  (game as any).socket?.on(socketName, (message: SocketMessage) => {
    // A message is a suggestion, not an order: each handler still checks what
    // this user is allowed to see before showing anything.
    handlers.forEach((handler) => handler(message));
  });
}
