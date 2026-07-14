import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const params = new URLSearchParams();
  params.set("report", "transaction-detail-by-account");
  for (const [key, value] of Object.entries(resolved)) {
    if (key === "report" || value == null) continue;
    params.set(key, Array.isArray(value) ? value[0]! : value);
  }
  redirect(`/reports/custom?${params.toString()}`);
}
