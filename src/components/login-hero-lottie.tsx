"use client";

import Lottie from "lottie-react";
import { cn } from "@/lib/utils";
import loginHeroAnimation from "../../public/lottie/login-hero.json";

type LoginHeroLottieProps = {
  className?: string;
};

export function LoginHeroLottie({ className }: LoginHeroLottieProps) {
  return (
    <div
      className={cn("flex h-full w-full items-center justify-center", className)}
      aria-hidden
    >
      <Lottie
        animationData={loginHeroAnimation}
        loop
        autoplay
        className="h-[min(72vh,560px)] w-[min(72vh,560px)] max-w-[90%]"
      />
    </div>
  );
}
