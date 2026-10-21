import { useEffect, useState } from "react";
import animatedAngryUrl from "../assets/bubu-animated/angry.webp";
import animatedButtPinchUrl from "../assets/bubu-animated/buttPinch.webp";
import animatedCryUrl from "../assets/bubu-animated/cry.webp";
import animatedDragUrl from "../assets/bubu-animated/drag.webp";
import animatedGreetUrl from "../assets/bubu-animated/greet.webp";
import animatedHugUrl from "../assets/bubu-animated/hug.webp";
import animatedHugSmallUrl from "../assets/bubu-animated/hugSmall.webp";
import animatedIdleUrl from "../assets/bubu-animated/idle.webp";
import animatedKissUrl from "../assets/bubu-animated/kiss.webp";
import animatedPatUrl from "../assets/bubu-animated/pat.webp";
import animatedSleepUrl from "../assets/bubu-animated/sleep.webp";
import angryUrl from "../assets/bubu/angry.png";
import buttPinchUrl from "../assets/bubu/butt-pinch.png";
import cryUrl from "../assets/bubu/cry.png";
import greetUrl from "../assets/bubu/greet.png";
import hugUrl from "../assets/bubu/hug.png";
import hugSmallUrl from "../assets/bubu/hug-small.png";
import happyUrl from "../assets/bubu/happy.png";
import idleUrl from "../assets/bubu/idle.png";
import kissUrl from "../assets/bubu/kiss.png";
import sadUrl from "../assets/bubu/sad.png";
import sleepUrl from "../assets/bubu/sleep.png";
import type { PetAction } from "../types";

interface StickerBubuProps {
  action: PetAction;
  facing: 1 | -1;
}

const animatedImageByAction: Record<PetAction, string> = {
  idle: animatedSleepUrl,
  pat: animatedPatUrl,
  drag: animatedDragUrl,
  sleep: animatedSleepUrl,
  cry: animatedCryUrl,
  walk: animatedIdleUrl,
  greet: animatedGreetUrl,
  kiss: animatedKissUrl,
  hugSmall: animatedHugSmallUrl,
  hug: animatedHugUrl,
  buttPinch: animatedButtPinchUrl,
  angry: animatedAngryUrl,
  cute: animatedSleepUrl,
  surprise: animatedPatUrl
};

const staticImageByAction: Record<PetAction, string> = {
  idle: sleepUrl,
  pat: happyUrl,
  drag: sadUrl,
  sleep: sleepUrl,
  cry: cryUrl,
  walk: idleUrl,
  greet: greetUrl,
  kiss: kissUrl,
  hugSmall: hugSmallUrl,
  hug: hugUrl,
  buttPinch: buttPinchUrl,
  angry: angryUrl,
  cute: sleepUrl,
  surprise: happyUrl
};

export function StickerBubu({ action, facing }: StickerBubuProps) {
  const [reduceMotion, setReduceMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const source = reduceMotion
    ? staticImageByAction[action]
    : animatedImageByAction[action];
  const effectiveFacing = action === "walk" ? facing : 1;
  const stateClass =
    action === "hugSmall"
      ? "hug-small"
      : action === "buttPinch"
        ? "butt-pinch"
        : action;

  return (
    <div className={`sticker-shell state-${stateClass}`}>
      <div
        className="sticker-frame"
        style={{ transform: `scaleX(${effectiveFacing})` }}
      >
        <img
          className="bubu-sticker"
          src={source}
          alt="布布小棕熊"
          draggable={false}
        />
      </div>

      <div className="sticker-hearts" aria-hidden="true">
        <span>♥</span>
        <span>♥</span>
        <span>♥</span>
      </div>

      <div className="sticker-sleep" aria-hidden="true">
        <span>Z</span>
        <span>Z</span>
      </div>

      <div className="sticker-sparkles" aria-hidden="true">
        <span>✦</span>
        <span>✦</span>
        <span>✦</span>
      </div>

      <div className="sticker-anger" aria-hidden="true">
        <span>!</span>
        <span>!</span>
      </div>
    </div>
  );
}
