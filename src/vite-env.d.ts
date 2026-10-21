/// <reference types="vite/client" />

type PetCommand =
  | "pat"
  | "greet"
  | "cry"
  | "sleep"
  | "walk"
  | "angry"
  | "cute"
  | "kiss"
  | "hugSmall"
  | "hug"
  | "buttPinch"
  | "surprise";

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WindowPlacement {
  bounds: WindowBounds;
  workArea: WindowBounds;
}

interface DesktopPetApi {
  setMenuOpen: (open: boolean) => void;
  beginDrag: () => Promise<WindowBounds>;
  finishDrag: () => Promise<WindowBounds>;
  getPlacement: () => Promise<WindowPlacement>;
  startWalk: () => Promise<1 | -1>;
  stopWalk: () => void;
  setAlwaysOnTop: (pinned: boolean) => Promise<boolean>;
  quit: () => void;
  onCommand: (callback: (command: PetCommand) => void) => () => void;
  onWalkBounce: (callback: (direction: 1 | -1) => void) => () => void;
  onPinnedChange: (callback: (pinned: boolean) => void) => () => void;
}

declare global {
  interface Window {
    desktopPet: DesktopPetApi;
  }
}

export {};
