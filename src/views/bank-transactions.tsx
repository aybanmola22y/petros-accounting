import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBankTransactions,
  useCreateBankTransaction,
  useUpdateBankTransaction,
  useDeleteBankTransaction,
  getListBankTransactionsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const txSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  type: z.string().min(1),
  accountName: z.string().min(1),
  category: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
type TxForm = z.infer<typeof txSchema>;

const statusColor: Record<string, string> = {
  uncategorized: "bg-amber-100 text-amber-800 border-amber-200",
  categorized: "bg-emerald-100 text-emerald-800 border-emerald-200",
  reconciled: "bg-blue-100 text-blue-800 border-blue-200",
};

export function BankTransactions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params = { search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined };
  const { data: txns, isLoading } = useListBankTransactions(params, {
    query: { queryKey: getListBankTransactionsQueryKey(params) },
  });
  const createMut = useCreateBankTransaction();
  const updateMut = useUpdateBankTransaction();
  const deleteMut = useDeleteBankTransaction();

  const form = useForm<TxForm>({ resolver: zodResolver(txSchema) });

  function openCreate() { form.reset({ date: new Date().toISOString().split("T")[0], type: "debit" }); setEditId(null); setOpen(true); }
  function openEdit(tx: NonNullable<typeof txns>[number]) {
    form.reset({ date: tx.date, description: tx.description, amount: Number(tx.amount), type: tx.type, accountName: tx.accountName, category: tx.category ?? "", reference: tx.reference ?? "", notes: tx.notes ?? "" });
    setEditId(tx.id); setOpen(true);
  }
  function onSubmit(data: TxForm) {
    const invalidate = () => qc.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
    if (editId) {
      updateMut.mutate({ id: editId, data }, { onSuccess: () => { setOpen(false); invalidate(); } });
    } else {
      createMut.mutate({ data }, { onSuccess: () => { setOpen(false); invalidate(); } });
    }
  }
  function onDelete(id: number) {
    deleteMut.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() }) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bank Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and categorize your bank activity</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Add Transaction</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Bank Transaction</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Date</Label><Input type="date" {...form.register("date")} /></div>
                <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" {...form.register("amount")} placeholder="0.00" /></div>
              </div>
              <div className="space-y-1.5"><Label>Description</Label><Input {...form.register("description")} placeholder="Description" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Type</Label>
                  <Select onValueChange={(v) => form.setValue("type", v)} defaultValue={form.watch("type")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Account</Label><Input {...form.register("accountName")} placeholder="Account name" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Category</Label><Input {...form.register("category")} placeholder="e.g. Office Supplies" /></div>
                <div className="space-y-1.5"><Label>Reference</Label><Input {...form.register("reference")} placeholder="Ref #" /></div>
              </div>
              <div className="space-y-1.5"><Label>Notes</Label><Input {...form.register("notes")} placeholder="Optional notes" /></div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>{editId ? "Save" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search transactions..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                <SelectItem value="categorized">Categorized</SelectItem>
                <SelectItem value="reconciled">Reconciled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              )) : txns?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No bank transactions found</TableCell></TableRow>
              ) : txns?.map(tx => (
                <TableRow key={tx.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm">{tx.date}</TableCell>
                  <TableCell className="font-medium text-sm max-w-[200px] truncate">{tx.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tx.accountName}</TableCell>
                  <TableCell className="text-sm">{tx.category || <span className="text-muted-foreground/60">—</span>}</TableCell>
                  <TableCell><Badge variant="outline" className={tx.type === "credit" ? "text-emerald-700 border-emerald-200" : "text-slate-600"}>{tx.type}</Badge></TableCell>
                  <TableCell className={`text-right font-medium text-sm ${tx.type === "credit" ? "text-emerald-600" : ""}`}>
                    {tx.type === "credit" ? "+" : "-"}${Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor[tx.status] || "bg-gray-100 text-gray-700"}`}>{tx.status}</span></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tx)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(tx.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
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
