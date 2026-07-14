/** Full-screen flows (e.g. report builder) — no sidebar or app chrome. */
export default function FullscreenLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="h-dvh overflow-hidden bg-background">{children}</div>;
}
