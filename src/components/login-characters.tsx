"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type LoginMood = "idle" | "amazed" | "shy";

type Point = { x: number; y: number };

function usePointer(enabled: boolean): Point {
  const [point, setPoint] = useState<Point>({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      setPoint({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    setPoint({ x: window.innerWidth * 0.7, y: window.innerHeight * 0.45 });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled]);

  return point;
}

function useEyeOffset(
  pointer: Point,
  maxOffset: number,
  mood: LoginMood,
  lockedOffset?: Point,
) {
  const ref = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (mood !== "idle" && lockedOffset) {
      setOffset(lockedOffset);
      return;
    }

    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = pointer.x - cx;
    const dy = pointer.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const scale = Math.min(maxOffset, dist) / dist;
    setOffset({ x: dx * scale, y: dy * scale });
  }, [pointer, maxOffset, mood, lockedOffset]);

  return { ref, offset };
}

function Eye({
  pointer,
  size,
  maxOffset,
  sclera,
  pupil,
  mood,
  lockedOffset,
}: {
  pointer: Point;
  size: number;
  maxOffset: number;
  sclera: string;
  pupil: string;
  mood: LoginMood;
  lockedOffset?: Point;
}) {
  const eyeSize = mood === "amazed" ? size * 1.35 : size;
  const { ref, offset } = useEyeOffset(
    pointer,
    maxOffset * (mood === "amazed" ? 1.15 : 1),
    mood,
    lockedOffset,
  );

  return (
    <span
      ref={ref}
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-[width,height] duration-200"
      style={{ width: eyeSize, height: eyeSize, background: sclera }}
    >
      <span
        className="absolute rounded-full transition-transform duration-200"
        style={{
          width: Math.max(3, eyeSize * (mood === "amazed" ? 0.32 : 0.4)),
          height: Math.max(3, eyeSize * (mood === "amazed" ? 0.32 : 0.4)),
          background: pupil,
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
      />
    </span>
  );
}

function DotEyes({
  pointer,
  size = 10,
  gap = 14,
  mood,
  lockedOffset,
}: {
  pointer: Point;
  size?: number;
  gap?: number;
  mood: LoginMood;
  lockedOffset?: Point;
}) {
  return (
    <div
      className="flex items-center transition-[gap] duration-200"
      style={{ gap: mood === "amazed" ? gap * 1.1 : gap }}
    >
      <Eye
        pointer={pointer}
        size={size}
        maxOffset={size * 0.28}
        sclera="#171717"
        pupil="#f5f5f5"
        mood={mood}
        lockedOffset={lockedOffset}
      />
      <Eye
        pointer={pointer}
        size={size}
        maxOffset={size * 0.28}
        sclera="#171717"
        pupil="#f5f5f5"
        mood={mood}
        lockedOffset={lockedOffset}
      />
    </div>
  );
}

function Mouth({
  mood,
  variant,
}: {
  mood: LoginMood;
  variant: "line" | "dot" | "bar";
}) {
  if (mood === "amazed") {
    return (
      <div
        className="rounded-full transition-all duration-200"
        style={{
          width: variant === "bar" ? 14 : 16,
          height: variant === "bar" ? 18 : 16,
          background: variant === "line" ? "rgba(255,255,255,0.95)" : "#171717",
        }}
      />
    );
  }

  if (mood === "shy") {
    if (variant === "line" || variant === "bar") {
      return (
        <div
          className="h-[3px] w-5 rounded-full transition-all duration-200"
          style={{ background: variant === "line" ? "rgba(255,255,255,0.9)" : "#171717" }}
        />
      );
    }
    return <div className="h-2 w-5 rounded-full bg-[#171717] transition-all duration-200" />;
  }

  if (variant === "line") {
    return <div className="h-5 w-[3px] rounded-full bg-white/90" />;
  }
  if (variant === "bar") {
    return <div className="h-[3px] w-12 rounded-full bg-[#171717]" />;
  }
  return <div className="h-3.5 w-3.5 rounded-full bg-[#171717]" />;
}

function Face({
  mood,
  pointer,
  shaking,
  className,
  children,
  intensity = 1,
  centered = false,
  maxShift = 22,
}: {
  mood: LoginMood;
  pointer: Point;
  shaking?: boolean;
  className?: string;
  children: React.ReactNode;
  intensity?: number;
  centered?: boolean;
  /** How far the whole face can slide toward the cursor (idle). */
  maxShift?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (mood !== "idle" || shaking) return;

    const home = ref.current?.parentElement;
    if (!home) return;
    const rect = home.getBoundingClientRect();
    // Aim from where the face usually sits (upper third of the body).
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.22;
    const dx = pointer.x - cx;
    const dy = pointer.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const reach = maxShift * intensity;
    const scale = Math.min(reach, dist) / dist;
    setFollow({
      x: dx * scale,
      y: dy * scale * 0.75,
    });
  }, [pointer, mood, shaking, maxShift, intensity]);

  const tx =
    mood === "amazed"
      ? 10 * intensity
      : mood === "shy"
        ? -12 * intensity
        : follow.x;
  const ty =
    mood === "amazed"
      ? 2 * intensity
      : mood === "shy"
        ? -5 * intensity
        : follow.y;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute flex flex-col gap-3",
        centered ? "items-center" : "items-start",
        shaking && "login-char-face-shake",
        className,
      )}
      style={{
        transform: `${centered ? "translateX(-50%) " : ""}translate(${tx}px, ${ty}px)`,
        // Snap-follow the cursor (no laggy transition while idle).
        transition: shaking
          ? undefined
          : mood === "idle"
            ? "transform 70ms linear"
            : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Single continuous shape. Body stays planted on the baseline.
 * Idle: whole face slides toward the cursor (not just pupils).
 * Amazed / shy: gentle lean + face offset. Wrong password: soft skew shake.
 */
function Character({
  mood,
  nodding,
  shakeDelayMs = 0,
  towardDeg,
  awayDeg,
  className,
  children,
}: {
  mood: LoginMood;
  nodding?: boolean;
  shakeDelayMs?: number;
  towardDeg: number;
  awayDeg: number;
  className?: string;
  children: React.ReactNode;
}) {
  // Only lean the silhouette for email/password moods — idle keeps body still.
  const lean =
    mood === "amazed" ? towardDeg : mood === "shy" ? awayDeg : 0;

  return (
    <div
      className={cn(
        "absolute bottom-0",
        nodding && "login-char-body-shake",
        className,
      )}
      style={
        nodding
          ? {
              transformOrigin: "50% 100%",
              animationDelay: `${shakeDelayMs}ms`,
            }
          : lean !== 0
            ? {
                transform: `skewX(${lean}deg)`,
                transformOrigin: "50% 100%",
                transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              }
            : {
                transform: "skewX(0deg)",
                transformOrigin: "50% 100%",
                transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              }
      }
    >
      <div
        className="relative h-full w-full"
        style={
          nodding || lean === 0
            ? undefined
            : {
                transform: `skewX(${-lean * 0.28}deg)`,
                transformOrigin: "50% 100%",
                transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              }
        }
      >
        {children}
      </div>
    </div>
  );
}

type LoginCharactersProps = {
  className?: string;
  mood?: LoginMood;
  nodding?: boolean;
};

export function LoginCharacters({
  className,
  mood = "idle",
  nodding = false,
}: LoginCharactersProps) {
  const pointer = usePointer(!nodding);
  const effectiveMood: LoginMood = nodding ? "shy" : mood;

  const lockedOffset: Point | undefined = nodding
    ? { x: 0, y: 0 }
    : effectiveMood === "amazed"
      ? { x: 5, y: 1 }
      : effectiveMood === "shy"
        ? { x: -7, y: -5 }
        : undefined;

  return (
    <div
      className={cn("relative flex h-full w-full items-end justify-center", className)}
      aria-hidden="true"
    >
      <style>{`
        /* Continuous shape: skew from feet — baseline stays, outline never splits. */
        @keyframes login-char-no-shake {
          0%   { transform: skewX(0deg); }
          14%  { transform: skewX(-12deg); }
          32%  { transform: skewX(12deg); }
          50%  { transform: skewX(-8deg); }
          68%  { transform: skewX(6deg); }
          84%  { transform: skewX(-2deg); }
          100% { transform: skewX(0deg); }
        }
        @keyframes login-char-face-no {
          0%, 100% { translate: 0 0; }
          14% { translate: -10px 0; }
          32% { translate: 10px 0; }
          50% { translate: -7px 0; }
          68% { translate: 5px 0; }
          84% { translate: -2px 0; }
        }
        .login-char-body-shake {
          animation: login-char-no-shake 1.55s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
          transform-origin: 50% 100% !important;
        }
        .login-char-face-shake {
          animation: login-char-face-no 1.55s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>

      <div className="relative mb-[10%] h-[min(560px,68vh)] w-[min(560px,86%)]">
        {/* Purple */}
        <Character
          mood={effectiveMood}
          nodding={nodding}
          shakeDelayMs={0}
          towardDeg={8}
          awayDeg={-10}
          className="left-[12%] z-[1] h-[88%] w-[28%] rounded-[40px] bg-[#7b61ff]"
        >
          <Face
            mood={effectiveMood}
            pointer={pointer}
            shaking={nodding}
            intensity={1}
            maxShift={24}
            centered
            className="left-1/2 top-[11%]"
          >
            <div className="flex gap-3.5">
              <Eye
                pointer={pointer}
                size={16}
                maxOffset={4}
                sclera="#ffffff"
                pupil="#171717"
                mood={effectiveMood}
                lockedOffset={lockedOffset}
              />
              <Eye
                pointer={pointer}
                size={16}
                maxOffset={4}
                sclera="#ffffff"
                pupil="#171717"
                mood={effectiveMood}
                lockedOffset={lockedOffset}
              />
            </div>
            <Mouth mood={effectiveMood} variant="line" />
          </Face>
        </Character>

        {/* Black */}
        <Character
          mood={effectiveMood}
          nodding={nodding}
          shakeDelayMs={50}
          towardDeg={9}
          awayDeg={-8}
          className="left-[36%] z-[2] h-[72%] w-[18%] rounded-[32px] bg-[#141414]"
        >
          <Face
            mood={effectiveMood}
            pointer={pointer}
            shaking={nodding}
            intensity={1.15}
            maxShift={20}
            centered
            className="left-1/2 top-[10%]"
          >
            <div className="flex gap-3">
              <Eye
                pointer={pointer}
                size={22}
                maxOffset={6}
                sclera="#ffffff"
                pupil="#141414"
                mood={effectiveMood}
                lockedOffset={lockedOffset}
              />
              <Eye
                pointer={pointer}
                size={22}
                maxOffset={6}
                sclera="#ffffff"
                pupil="#141414"
                mood={effectiveMood}
                lockedOffset={lockedOffset}
              />
            </div>
          </Face>
        </Character>

        {/* Yellow */}
        <Character
          mood={effectiveMood}
          nodding={nodding}
          shakeDelayMs={90}
          towardDeg={7}
          awayDeg={9}
          className="left-[48%] z-[3] h-[58%] w-[34%] rounded-[999px] bg-[#f5c400]"
        >
          <Face
            mood={effectiveMood}
            pointer={pointer}
            shaking={nodding}
            intensity={1.05}
            maxShift={26}
            className="left-[18%] top-[20%]"
          >
            <DotEyes
              pointer={pointer}
              size={14}
              gap={18}
              mood={effectiveMood}
              lockedOffset={lockedOffset}
            />
            <Mouth mood={effectiveMood} variant="bar" />
          </Face>
        </Character>

        {/* Orange */}
        <Character
          mood={effectiveMood}
          nodding={nodding}
          shakeDelayMs={30}
          towardDeg={5}
          awayDeg={-6}
          className="left-[2%] z-[4] h-[42%] w-[54%] rounded-t-[999px] rounded-b-[72px] bg-[#ff7a1a]"
        >
          <Face
            mood={effectiveMood}
            pointer={pointer}
            shaking={nodding}
            intensity={0.9}
            maxShift={28}
            centered
            className="left-1/2 top-[28%]"
          >
            <DotEyes
              pointer={pointer}
              size={16}
              gap={22}
              mood={effectiveMood}
              lockedOffset={lockedOffset}
            />
            <Mouth mood={effectiveMood} variant="dot" />
          </Face>
        </Character>
      </div>
    </div>
  );
}
