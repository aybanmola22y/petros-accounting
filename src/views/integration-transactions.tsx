import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListIntegrationTransactions,
  useUpdateIntegrationTransaction,
  useDeleteIntegrationTransaction,
  getListIntegrationTransactionsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, CheckCircle, XCircle, Trash2 } from "lucide-react";

export function IntegrationTransactions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const qc = useQueryClient();

  const params = { search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined, source: sourceFilter !== "all" ? sourceFilter : undefined };
  const { data: txns, isLoading } = useListIntegrationTransactions(params, {
    query: { queryKey: getListIntegrationTransactionsQueryKey(params) },
  });
  const updateMut = useUpdateIntegrationTransaction();
  const deleteMut = useDeleteIntegrationTransaction();

  function approve(id: number) {
    updateMut.mutate({ id, data: { status: "approved" } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListIntegrationTransactionsQueryKey() }) });
  }
  function reject(id: number) {
    updateMut.mutate({ id, data: { status: "rejected" } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListIntegrationTransactionsQueryKey() }) });
  }
  function remove(id: number) {
    deleteMut.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListIntegrationTransactionsQueryKey() }) });
  }

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integration Transactions</h1>
        <p className="text-sm text-muted-foreground mt-1">Review transactions synced from external sources</p>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Sources" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="shopify">Shopify</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
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
                <TableHead>Source</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              )) : txns?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No integration transactions found</TableCell></TableRow>
              ) : txns?.map(tx => (
                <TableRow key={tx.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm">{tx.date}</TableCell>
                  <TableCell className="font-medium text-sm">{tx.description}</TableCell>
                  <TableCell><Badge variant="secondary">{tx.source}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{tx.externalId}</TableCell>
                  <TableCell className="text-sm">{tx.category || <span className="text-muted-foreground/50">—</span>}</TableCell>
                  <TableCell className="text-right font-medium text-sm">${Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[tx.status] || ""}`}>{tx.status}</span></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {tx.status === "pending" && <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => approve(tx.id)}><CheckCircle className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => reject(tx.id)}><XCircle className="w-3.5 h-3.5" /></Button>
                      </>}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(tx.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
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
