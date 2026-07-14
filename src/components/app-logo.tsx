import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/petrosphere-mark.png";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
  /** Use on dark backgrounds — hides black matte in the source artwork. */
  variant?: "default" | "onDark";
  className?: string;
  priority?: boolean;
};

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-20 w-20",
} as const;

const sizePixels = {
  sm: 40,
  md: 64,
  lg: 80,
} as const;

export function AppLogo({
  size = "sm",
  variant = "default",
  className,
  priority = false,
}: AppLogoProps) {
  const dimension = sizePixels[size];

  return (
    <Image
      src={LOGO_SRC}
      alt="Petrosphere Inc."
      width={dimension}
      height={dimension}
      priority={priority}
      unoptimized
      className={cn(
        "shrink-0 object-contain bg-transparent",
        variant === "onDark" && "mix-blend-lighten",
        sizeClasses[size],
        className,
      )}
    />
  );
}
