import { Card, CardContent } from "@/components/ui/card";

type ReportsPageProps = {
  title: string;
  description: string;
};

export function ReportsPage({ title, description }: ReportsPageProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Reports
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-xl">{description}</p>
      </div>
      <Card className="rounded-xl border-dashed shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-foreground">Coming soon</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            This section is being built with the Ledger reporting experience.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export { StandardReports } from "@/views/standard-reports";
export { CustomReports } from "@/views/custom-reports";

export { ManagementReports } from "@/views/management-reports";

export function FinancialPlanning() {
  return (
    <ReportsPage
      title="Financial Planning"
      description="Budgets, forecasts, and long-range financial planning"
    />
  );
}
