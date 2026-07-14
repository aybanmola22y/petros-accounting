import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSalesOrders, useCreateSalesOrder, useUpdateSalesOrder, useDeleteSalesOrder, getListSalesOrdersQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  orderNumber: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional().or(z.literal("")),
  orderDate: z.string().min(1),
  expectedDate: z.string().min(1),
  subtotal: z.coerce.number().min(0),
  tax: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
  notes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

const statusColor: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-amber-100 text-amber-800",
  shipped: "bg-purple-100 text-purple-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

export function SalesOrders() {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const qc = useQueryClient();

  const params = { search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined };
  const { data: orders, isLoading } = useListSalesOrders(params, { query: { queryKey: getListSalesOrdersQueryKey(params) } });
  const createMut = useCreateSalesOrder();
  const updateMut = useUpdateSalesOrder();
  const deleteMut = useDeleteSalesOrder();
  const form = useForm<Form>({ resolver: zodResolver(schema) });

  const today = new Date().toISOString().split("T")[0];
  function openCreate() { form.reset({ orderDate: today, tax: 0 }); setEditId(null); setOpen(true); }
  function openEdit(o: NonNullable<typeof orders>[number]) {
    form.reset({ orderNumber: o.orderNumber, customerName: o.customerName, customerEmail: o.customerEmail ?? "", orderDate: o.orderDate, expectedDate: o.expectedDate, subtotal: Number(o.subtotal), tax: Number(o.tax), total: Number(o.total), notes: o.notes ?? "" });
    setEditId(o.id); setOpen(true);
  }
  function onSubmit(data: Form) {
    const inv = () => qc.invalidateQueries({ queryKey: getListSalesOrdersQueryKey() });
    if (editId) updateMut.mutate({ id: editId, data }, { onSuccess: () => { setOpen(false); inv(); } });
    else createMut.mutate({ data }, { onSuccess: () => { setOpen(false); inv(); } });
  }
  function advanceStatus(o: NonNullable<typeof orders>[number]) {
    const progression: Record<string, string> = { draft: "confirmed", confirmed: "processing", processing: "shipped", shipped: "completed" };
    const next = progression[o.status];
    if (next) updateMut.mutate({ id: o.id, data: { status: next } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListSalesOrdersQueryKey() }) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Sales Orders</h1><p className="text-sm text-muted-foreground mt-1">Track customer orders through fulfillment</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />New Order</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Sales Order</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Order #</Label><Input {...form.register("orderNumber")} placeholder="ORD-001" /></div>
                <div className="space-y-1.5"><Label>Customer Name</Label><Input {...form.register("customerName")} /></div>
              </div>
              <div className="space-y-1.5"><Label>Customer Email</Label><Input type="email" {...form.register("customerEmail")} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Order Date</Label><Input type="date" {...form.register("orderDate")} /></div>
                <div className="space-y-1.5"><Label>Expected Date</Label><Input type="date" {...form.register("expectedDate")} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label>Subtotal</Label><Input type="number" step="0.01" {...form.register("subtotal")} /></div>
                <div className="space-y-1.5"><Label>Tax</Label><Input type="number" step="0.01" {...form.register("tax")} /></div>
                <div className="space-y-1.5"><Label>Total</Label><Input type="number" step="0.01" {...form.register("total")} /></div>
              </div>
              <div className="space-y-1.5"><Label>Notes</Label><Input {...form.register("notes")} /></div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">{editId ? "Save" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search orders..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {["draft","confirmed","processing","shipped","completed","cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4" /></TableCell>)}</TableRow>
              )) : orders?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No sales orders yet</TableCell></TableRow>
              ) : orders?.map(o => (
                <TableRow key={o.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                  <TableCell className="font-medium text-sm">{o.customerName}</TableCell>
                  <TableCell className="text-sm">{o.orderDate}</TableCell>
                  <TableCell className="text-sm">{o.expectedDate}</TableCell>
                  <TableCell className="text-right text-sm font-medium">${Number(o.total).toFixed(2)}</TableCell>
                  <TableCell><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor[o.status] || ""}`}>{o.status}</span></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!["completed","cancelled"].includes(o.status) && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => advanceStatus(o)}>Advance</Button>}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(o)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate({ id: o.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListSalesOrdersQueryKey() }) })}><Trash2 className="w-3.5 h-3.5" /></Button>
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
