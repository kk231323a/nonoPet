import {
  HandHeart,
  HandGrabbing,
  HandPointing,
  HandsClapping,
  HandWaving,
  Heart,
  Power,
  PushPin,
  PushPinSlash,
  SmileyAngry,
  SmileySad,
  SneakerMove,
  Sparkle,
  X
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import { StickerBubu } from "./components/StickerBubu";
import type { PetAction, PetCommand } from "./types";

interface DragSession {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  moved: boolean;
}

const ACTION_DURATIONS: Partial<Record<PetAction, number>> = {
  pat: 3000,
  cry: 2000,
  angry: 1600,
  greet: 2400,
  cute: 2600,
  kiss: 2600,
  hugSmall: 2600,
  hug: 3600,
  buttPinch: 1900,
  surprise: 900
};

const AUTO_ACTIONS: PetAction[] = [
  "pat",
  "greet",
  "kiss",
  "hugSmall",
  "hug",
  "buttPinch",
  "cute",
  "cry",
  "surprise"
];

export default function App() {
  const [action, setAction] = useState<PetAction>("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinned, setPinned] = useState(true);
  const [walking, setWalking] = useState(false);
  const [walkFacing, setWalkFacing] = useState<1 | -1>(1);
  const [showHint, setShowHint] = useState(true);
  const [menuPosition, setMenuPosition] = useState({ left: 48, top: 13 });
  const actionTimer = useRef<number | null>(null);
  const walkTimer = useRef<number | null>(null);
  const dragSession = useRef<DragSession | null>(null);
  const lastAutoAction = useRef<PetAction | null>(null);

  const clearActionTimer = useCallback(() => {
    if (actionTimer.current !== null) {
      window.clearTimeout(actionTimer.current);
      actionTimer.current = null;
    }
  }, []);

  const settleToIdle = useCallback(() => {
    clearActionTimer();
    setAction("idle");
  }, [clearActionTimer]);

  const stopWalking = useCallback(() => {
    if (walkTimer.current !== null) {
      window.clearTimeout(walkTimer.current);
      walkTimer.current = null;
    }
    setWalking(false);
    setWalkFacing(1);
    window.desktopPet.stopWalk();
  }, []);

  const runAction = useCallback(
    (nextAction: PetAction, duration?: number) => {
      clearActionTimer();
      setAction(nextAction);
      const finishAfter = duration ?? ACTION_DURATIONS[nextAction];
      if (finishAfter) {
        actionTimer.current = window.setTimeout(() => {
          setAction("idle");
          actionTimer.current = null;
        }, finishAfter);
      }
    },
    [clearActionTimer]
  );

  const runCommand = useCallback(
    (command: PetCommand) => {
      setMenuOpen(false);
      setShowHint(false);
      window.desktopPet.setMenuOpen(false);

      if (command === "walk") {
        if (walking) {
          stopWalking();
          setAction("idle");
          return;
        }
        clearActionTimer();
        setWalking(true);
        setAction("walk");
        void window.desktopPet.startWalk().then((direction) => {
          if (direction === 1 || direction === -1) setWalkFacing(direction);
        });
        walkTimer.current = window.setTimeout(() => {
          setWalking(false);
          setAction("idle");
          window.desktopPet.stopWalk();
          walkTimer.current = null;
        }, 12000);
        return;
      }

      if (command === "sleep") {
        stopWalking();
        runAction("sleep");
        return;
      }

      stopWalking();
      runAction(command);
    },
    [clearActionTimer, runAction, stopWalking, walking]
  );

  useEffect(() => {
    const unsubscribeCommand = window.desktopPet.onCommand(runCommand);
    const unsubscribePinned = window.desktopPet.onPinnedChange(setPinned);
    const unsubscribeBounce = window.desktopPet.onWalkBounce(setWalkFacing);

    return () => {
      unsubscribeCommand();
      unsubscribePinned();
      unsubscribeBounce();
    };
  }, [runCommand]);

  useEffect(() => {
    const hintTimer = window.setTimeout(() => setShowHint(false), 3600);
    return () => window.clearTimeout(hintTimer);
  }, []);

  useEffect(() => {
    if (action !== "idle" || menuOpen || walking) return;

    const nextActionTimer = window.setTimeout(() => {
      const choices = AUTO_ACTIONS.filter(
        (candidate) => candidate !== lastAutoAction.current
      );
      const nextAction =
        choices[Math.floor(Math.random() * choices.length)] ?? AUTO_ACTIONS[0];
      lastAutoAction.current = nextAction;
      runAction(nextAction);
    }, 900 + Math.random() * 1400);

    return () => window.clearTimeout(nextActionTimer);
  }, [action, menuOpen, runAction, walking]);

  useEffect(() => {
    return () => {
      clearActionTimer();
      if (walkTimer.current !== null) window.clearTimeout(walkTimer.current);
      window.desktopPet.stopWalk();
    };
  }, [clearActionTimer]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    window.desktopPet.setMenuOpen(false);
  }, []);

  const openMenu = useCallback(async () => {
    if (menuOpen) {
      closeMenu();
      return;
    }

    setShowHint(false);
    const placement = await window.desktopPet.getPlacement();
    const menuWidth = 284;
    const menuHeight = 230;
    const safeX = Math.max(
      placement.workArea.x + 8,
      Math.min(
        placement.bounds.x + 24,
        placement.workArea.x + placement.workArea.width - menuWidth - 8
      )
    );
    const safeY = Math.max(
      placement.workArea.y + 8,
      Math.min(
        placement.bounds.y + 13,
        placement.workArea.y + placement.workArea.height - menuHeight - 8
      )
    );

    setMenuPosition({
      left: safeX - placement.bounds.x,
      top: safeY - placement.bounds.y
    });
    setMenuOpen(true);
    window.desktopPet.setMenuOpen(true);
  }, [closeMenu, menuOpen]);

  const wakeUp = useCallback(() => {
    if (action === "sleep") settleToIdle();
  }, [action, settleToIdle]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    wakeUp();
    if (walking) stopWalking();
    setShowHint(false);
    dragSession.current = {
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragSession.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.screenX - drag.startScreenX;
    const dy = event.screenY - drag.startScreenY;

    if (!drag.moved && Math.hypot(dx, dy) > 5) {
      drag.moved = true;
      stopWalking();
      clearActionTimer();
      setAction("drag");
      void window.desktopPet.beginDrag();
    }
  };

  const handlePointerUp = async (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragSession.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragSession.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.moved) {
      await window.desktopPet.finishDrag();
      settleToIdle();
    } else if (action !== "sleep") {
      runAction(event.detail > 1 ? "surprise" : "pat");
    }
  };

  const togglePinned = async () => {
    const next = await window.desktopPet.setAlwaysOnTop(!pinned);
    setPinned(next);
  };

  return (
    <main
      className="desktop-pet"
      onPointerDown={() => setShowHint(false)}
      onMouseLeave={() => {
        if (menuOpen && !dragSession.current) closeMenu();
      }}
    >
      {showHint && !menuOpen && (
        <div className="hint-bubble" aria-hidden="true">
          右键点我
        </div>
      )}

      {menuOpen && (
        <section
          className="action-menu"
          aria-label="布布的动作菜单"
          style={menuPosition}
        >
          <header className="menu-heading">
            <span>今天想做什么？</span>
            <button className="menu-close" type="button" onClick={closeMenu} aria-label="关闭菜单">
              <X weight="bold" />
            </button>
          </header>

          <div className="menu-grid">
            <button type="button" onClick={() => runAction("pat")}>
              <Heart weight="fill" />
              <span>摸摸头</span>
            </button>
            <button type="button" onClick={() => runCommand("greet")}>
              <HandWaving weight="fill" />
              <span>喊老婆</span>
            </button>
            <button type="button" onClick={() => runCommand("kiss")}>
              <HandPointing weight="fill" />
              <span>啾咪</span>
            </button>
            <button type="button" onClick={() => runCommand("hugSmall")}>
              <HandHeart weight="fill" />
              <span>抱小一二</span>
            </button>
            <button type="button" onClick={() => runCommand("hug")}>
              <HandsClapping weight="fill" />
              <span>抱抱</span>
            </button>
            <button type="button" onClick={() => runCommand("buttPinch")}>
              <HandGrabbing weight="fill" />
              <span>捏屁屁</span>
            </button>
            <button type="button" onClick={() => runCommand("cry")}>
              <SmileySad weight="fill" />
              <span>委屈屈</span>
            </button>
            <button type="button" onClick={() => runCommand("cute")}>
              <Sparkle weight="fill" />
              <span>卖萌</span>
            </button>
            <button type="button" onClick={() => runCommand("walk")}>
              <SneakerMove weight="fill" />
              <span>{walking ? "停一停" : "散散步"}</span>
            </button>
            <button type="button" onClick={() => runCommand("angry")}>
              <SmileyAngry weight="fill" />
              <span>生气气</span>
            </button>
          </div>

          <div className="menu-footer">
            <button type="button" onClick={togglePinned}>
              {pinned ? <PushPin weight="fill" /> : <PushPinSlash weight="fill" />}
              <span>{pinned ? "取消置顶" : "保持置顶"}</span>
            </button>
            <button type="button" onClick={() => window.desktopPet.quit()}>
              <Power weight="bold" />
              <span>退出桌宠</span>
            </button>
          </div>
        </section>
      )}

      <div
        className="pet-hitarea"
        onContextMenu={(event) => {
          event.preventDefault();
          void openMenu();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => {
          if (!dragSession.current) runAction("surprise");
        }}
        aria-label="布布桌宠，左键摸摸，按住拖动，右键打开菜单"
      >
        <StickerBubu action={action} facing={walkFacing} />
      </div>
    </main>
  );
}
