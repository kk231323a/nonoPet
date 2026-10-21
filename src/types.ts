export type PetAction =
  | "idle"
  | "pat"
  | "drag"
  | "sleep"
  | "cry"
  | "walk"
  | "greet"
  | "kiss"
  | "hugSmall"
  | "hug"
  | "buttPinch"
  | "angry"
  | "cute"
  | "surprise";

export type PetCommand = Exclude<PetAction, "idle" | "drag">;
