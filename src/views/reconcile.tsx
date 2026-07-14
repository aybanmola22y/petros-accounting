import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListReconciliations,
  useCreateReconciliation,
  useUpdateReconciliation,
  getListReconciliationsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CheckCircle2, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  accountName: z.string().min(1),
  accountId: z.coerce.number().min(1),
  statementDate: z.string().min(1),
  statementBalance: z.coerce.number(),
  notes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function Reconcile() {
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const qc = useQueryClient();
  const params = { status: statusFilter !== "all" ? statusFilter : undefined };
  const { data: recs, isLoading } = useListReconciliations(params, { query: { queryKey: getListReconciliationsQueryKey(params) } });
  const createMut = useCreateReconciliation();
  const updateMut = useUpdateReconciliation();
  const form = useForm<Form>({ resolver: zodResolver(schema) });

  function onSubmit(data: Form) {
    createMut.mutate({ data: { accountId: data.accountId, accountName: data.accountName, statementDate: data.statementDate, statementBalance: data.statementBalance, notes: data.notes } }, {
      onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: getListReconciliationsQueryKey() }); }
    });
  }
  function complete(id: number) {
    updateMut.mutate({ id, data: { status: "completed" } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListReconciliationsQueryKey() }) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Reconcile</h1><p className="text-sm text-muted-foreground mt-1">Match your books against bank statements</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />New Reconciliation</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Start Reconciliation</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5"><Label>Account Name</Label><Input {...form.register("accountName")} placeholder="e.g. Chase Checking" /></div>
              <div className="space-y-1.5"><Label>Account ID</Label><Input type="number" {...form.register("accountId")} placeholder="Account ID" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Statement Date</Label><Input type="date" {...form.register("statementDate")} /></div>
                <div className="space-y-1.5"><Label>Statement Balance</Label><Input type="number" step="0.01" {...form.register("statementBalance")} /></div>
              </div>
              <div className="space-y-1.5"><Label>Notes</Label><Input {...form.register("notes")} /></div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending}>Start</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex gap-2">
        {["all", "in_progress", "completed"].map(s => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
            {s === "all" ? "All" : s === "in_progress" ? "In Progress" : "Completed"}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Statement Date</TableHead>
                <TableHead className="text-right">Statement Balance</TableHead>
                <TableHead className="text-right">Cleared Balance</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4" /></TableCell>)}</TableRow>
              )) : recs?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No reconciliations yet</TableCell></TableRow>
              ) : recs?.map(rec => (
                <TableRow key={rec.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{rec.accountName}</TableCell>
                  <TableCell className="text-sm">{rec.statementDate}</TableCell>
                  <TableCell className="text-right text-sm">${Number(rec.statementBalance).toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm">${Number(rec.clearedBalance).toFixed(2)}</TableCell>
                  <TableCell className={`text-right text-sm font-medium ${Number(rec.difference) !== 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {Number(rec.difference) === 0 ? "Balanced" : `$${Number(rec.difference).toFixed(2)}`}
                  </TableCell>
                  <TableCell>
                    <span className={`flex items-center gap-1 text-xs font-medium ${rec.status === "completed" ? "text-emerald-600" : "text-amber-600"}`}>
                      {rec.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      {rec.status === "completed" ? "Completed" : "In Progress"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {rec.status !== "completed" && <Button size="sm" variant="outline" onClick={() => complete(rec.id)}>Complete</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
