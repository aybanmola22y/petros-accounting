"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { AppLogo } from "@/components/app-logo";
import { LoginCharacters, type LoginMood } from "@/components/login-characters";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const fieldClass = cn(
  "h-11 rounded-lg border border-neutral-200 bg-neutral-50/80 px-3.5 text-[15px] text-neutral-900 shadow-none",
  "placeholder:text-neutral-400",
  "focus-visible:border-neutral-900 focus-visible:bg-white focus-visible:ring-0",
  "aria-invalid:border-red-400",
  // Keep autofill from breaking the field look
  "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#fafafa]",
  "[&:-webkit-autofill]:[-webkit-text-fill-color:#171717]",
);

export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [activeField, setActiveField] = useState<"email" | "password" | null>(null);
  const [nodding, setNodding] = useState(false);
  const [nodToken, setNodToken] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const emailValue = watch("email");
  const passwordValue = watch("password");

  const resolvedMood: LoginMood =
    activeField === "password"
      ? "shy"
      : activeField === "email"
        ? "amazed"
        : passwordValue
          ? "shy"
          : emailValue
            ? "amazed"
            : "idle";

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    setNodding(false);
    const result = await signIn(values.email, values.password);
    if (!result.ok) {
      setError(result.message);
      setNodding(true);
      setNodToken((t) => t + 1);
      window.setTimeout(() => setNodding(false), 1650);
      return;
    }
    const from = searchParams.get("from");
    router.push(from && from.startsWith("/") ? from : "/");
    router.refresh();
  }

  const emailRegister = register("email");
  const passwordRegister = register("password");

  return (
    <div
      className="flex h-dvh w-full overflow-hidden bg-[#ebebef]"
      style={{ fontFamily: "var(--font-login-sans), system-ui, sans-serif" }}
    >
      <aside className="relative hidden min-h-0 w-[48%] shrink-0 overflow-hidden bg-[#e6e6ea] lg:block">
        <LoginCharacters
          key={nodToken}
          className="absolute inset-0"
          mood={resolvedMood}
          nodding={nodding}
        />
      </aside>

      <main className="relative flex min-h-0 w-full flex-1 flex-col overflow-y-auto bg-white lg:w-[52%]">
        <div className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-14 lg:px-16 xl:px-24">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-[380px] lg:mx-0"
          >
            <div className="mb-10 flex items-center gap-3.5">
              <AppLogo size="md" priority className="h-12 w-12" />
              <div className="min-w-0">
                <p className="text-lg font-semibold tracking-tight text-neutral-900">
                  Petrosphere
                </p>
                <p className="text-xs font-medium tracking-[0.16em] text-neutral-400 uppercase">
                  Accounting
                </p>
              </div>
            </div>

            <div className="mb-8 lg:hidden">
              <div className="relative h-28 overflow-hidden rounded-2xl bg-[#e6e6ea]">
                <LoginCharacters
                  key={`m-${nodToken}`}
                  className="absolute inset-0 scale-[0.85]"
                  mood={resolvedMood}
                  nodding={nodding}
                />
              </div>
            </div>

            <header className="mb-8">
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-neutral-900 sm:text-[1.875rem]">
                Sign in
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
                Enter your work email and password to continue.
              </p>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-[13px] font-medium text-neutral-600"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  aria-invalid={Boolean(errors.email)}
                  className={fieldClass}
                  {...emailRegister}
                  onFocus={() => setActiveField("email")}
                  onBlur={(e) => {
                    emailRegister.onBlur(e);
                    setActiveField((current) => (current === "email" ? null : current));
                  }}
                />
                {errors.email && (
                  <p className="text-[13px] text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-[13px] font-medium text-neutral-600"
                >
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-invalid={Boolean(errors.password)}
                    className={cn(fieldClass, "pr-11")}
                    {...passwordRegister}
                    onFocus={() => setActiveField("password")}
                    onBlur={(e) => {
                      passwordRegister.onBlur(e);
                      setActiveField((current) =>
                        current === "password" ? null : current,
                      );
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-700"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[13px] text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                />
                <Label
                  htmlFor="remember"
                  className="cursor-pointer text-[13px] font-normal text-neutral-600"
                >
                  Keep me signed in
                </Label>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="text-[13px] font-medium text-red-600"
                >
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "mt-1 h-11 w-full rounded-lg bg-neutral-950 text-[14px] font-semibold text-white",
                  "hover:bg-neutral-800 disabled:opacity-60",
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>

            <p className="mt-10 text-[12px] text-neutral-400">
              Access is limited to Petrosphere accounts.
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
