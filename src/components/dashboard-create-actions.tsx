import Link from "next/link";
import { customersListHref } from "@/lib/customer-navigation";
import { expenseTransactionsHref } from "@/lib/expense-navigation";
import { invoicesHref } from "@/lib/invoice-navigation";
import { salesTransactionsHref } from "@/lib/sales-navigation";
import { cn } from "@/lib/utils";

const CREATE_ACTIONS = [
  { label: "Create invoice", href: invoicesHref(true) },
  { label: "Add customer", href: customersListHref(true) },
  { label: "Record expense", href: expenseTransactionsHref({ expense: true }) },
  { label: "Create cheque", href: expenseTransactionsHref({ cheque: true }) },
  { label: "Add bank deposit", href: salesTransactionsHref(true) },
] as const;

export function DashboardCreateActions({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:gap-5",
        className,
      )}
    >
      <p className="text-sm font-semibold tracking-tight shrink-0">Create Actions</p>
      <div className="flex flex-wrap gap-2">
        {CREATE_ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="inline-flex h-9 items-center rounded-full border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-muted/50"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
