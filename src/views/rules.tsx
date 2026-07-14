import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListRules, useCreateRule, useUpdateRule, useDeleteRule, getListRulesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  conditions: z.string().min(1),
  actions: z.string().min(1),
  isActive: z.boolean().default(true),
  priority: z.coerce.number().int().min(1).default(1),
});
type Form = z.infer<typeof schema>;

export function Rules() {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const qc = useQueryClient();
  const { data: rules, isLoading } = useListRules({ query: { queryKey: getListRulesQueryKey() } });
  const createMut = useCreateRule();
  const updateMut = useUpdateRule();
  const deleteMut = useDeleteRule();
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { isActive: true, priority: 1 } });

  function openCreate() { form.reset({ isActive: true, priority: 1 }); setEditId(null); setOpen(true); }
  function openEdit(r: NonNullable<typeof rules>[number]) {
    form.reset({ name: r.name, description: r.description ?? "", conditions: r.conditions, actions: r.actions, isActive: r.isActive, priority: r.priority });
    setEditId(r.id); setOpen(true);
  }
  function onSubmit(data: Form) {
    const inv = () => qc.invalidateQueries({ queryKey: getListRulesQueryKey() });
    if (editId) updateMut.mutate({ id: editId, data }, { onSuccess: () => { setOpen(false); inv(); } });
    else createMut.mutate({ data }, { onSuccess: () => { setOpen(false); inv(); } });
  }
  function toggleActive(r: NonNullable<typeof rules>[number]) {
    updateMut.mutate({ id: r.id, data: { isActive: !r.isActive } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListRulesQueryKey() }) });
  }
  function remove(id: number) {
    deleteMut.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListRulesQueryKey() }) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Rules</h1><p className="text-sm text-muted-foreground mt-1">Automate transaction categorization and routing</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />New Rule</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Create"} Rule</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5"><Label>Name</Label><Input {...form.register("name")} placeholder="e.g. Auto-categorize SaaS" /></div>
              <div className="space-y-1.5"><Label>Description</Label><Input {...form.register("description")} placeholder="Optional description" /></div>
              <div className="space-y-1.5"><Label>Conditions</Label><Textarea {...form.register("conditions")} placeholder='e.g. {"field":"description","operator":"contains","value":"AWS"}' rows={2} /></div>
              <div className="space-y-1.5"><Label>Actions</Label><Textarea {...form.register("actions")} placeholder='e.g. {"category":"Software","account":"6000"}' rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Priority</Label><Input type="number" {...form.register("priority")} /></div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v)} /><Label>Active</Label>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">{editId ? "Save" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4" /></TableCell>)}</TableRow>
              )) : rules?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No rules defined yet</TableCell></TableRow>
              ) : rules?.map(r => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{r.name}{r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground max-w-[160px] truncate">{r.conditions}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground max-w-[160px] truncate">{r.actions}</TableCell>
                  <TableCell className="text-sm">{r.priority}</TableCell>
                  <TableCell><Switch checked={r.isActive} onCheckedChange={() => toggleActive(r)} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
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
