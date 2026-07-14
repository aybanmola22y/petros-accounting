import { DM_Sans } from "next/font/google";
import { Suspense } from "react";
import { LoginView } from "@/views/login";

const loginSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-login-sans",
  weight: ["400", "500", "600", "700"],
});

export default function LoginPage() {
  return (
    <div className={`${loginSans.variable} h-full`}>
      <Suspense fallback={null}>
        <LoginView />
      </Suspense>
    </div>
  );
}
