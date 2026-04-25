import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Sparkles, Receipt, Edit2, Search, ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { computeNetBalances, computeSplits, fmt, minimalSettlements, type ExpenseRow, type Participant } from "@/lib/balance";

export const Route = createFileRoute("/groups/$groupId")({
  component: () => <AppShell><GroupPage /></AppShell>,
});

type ExpenseFull = ExpenseRow & { category: string; split_mode: "equal" | "custom" | "percentage" };

function GroupPage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState<{ id: string; name: string; emoji: string } | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<ExpenseFull[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterParticipant, setFilterParticipant] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [{ data: g }, { data: p }, { data: e }] = await Promise.all([
      supabase.from("groups").select("id,name,emoji").eq("id", groupId).single(),
      supabase.from("participants").select("id,name,color,is_owner").eq("group_id", groupId).order("created_at"),
      supabase.from("expenses").select("id,payer_id,amount,description,expense_date,category,split_mode,expense_splits(participant_id,share_amount)").eq("group_id", groupId).order("expense_date", { ascending: false }),
    ]);
    setGroup(g ? { id: g.id, name: g.name, emoji: g.emoji ?? "💸" } : null);
    setParticipants((p as Participant[]) ?? []);
    setExpenses(((e as any[]) ?? []).map((x) => ({ ...x, splits: x.expense_splits ?? [] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [groupId]);

  const partMap = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);
  const owner = participants.find((p) => p.is_owner);

  const balances = useMemo(() => computeNetBalances(participants, expenses), [participants, expenses]);
  const settlements = useMemo(() => minimalSettlements(balances), [balances]);

  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const youNet = owner ? (balances.get(owner.id) ?? 0) : 0;

  const filtered = expenses.filter((e) => {
    if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterParticipant !== "all") {
      const inv = e.payer_id === filterParticipant || e.splits.some((s) => s.participant_id === filterParticipant);
      if (!inv) return false;
    }
    return true;
  });

  const deleteGroup = async () => {
    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    if (error) toast.error(error.message);
    else { toast.success("Group deleted"); navigate({ to: "/dashboard" }); }
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!group) return <div>Group not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-3xl shadow-soft">{group.emoji}</div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
            <p className="text-sm text-muted-foreground">{participants.length} members</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ExpenseDialog groupId={groupId} participants={participants} onSaved={load} />
          <MintSenseDialog groupId={groupId} participants={participants} expenses={expenses} onSaved={load} />
          <ManageDialog groupId={groupId} group={group} participants={participants} onSaved={load} />
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete this group?</AlertDialogTitle>
                <AlertDialogDescription>All expenses and splits will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteGroup} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-gradient-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Total spent</p>
          <p className="mt-1 text-2xl font-bold">{fmt(totalSpent)}</p>
        </Card>
        <Card className="bg-gradient-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Your net balance</p>
          <p className={`mt-1 text-2xl font-bold ${youNet >= 0 ? "text-success" : "text-destructive"}`}>
            {youNet >= 0 ? "+" : ""}{fmt(youNet)}
          </p>
        </Card>
        <Card className="bg-gradient-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Settlements needed</p>
          <p className="mt-1 text-2xl font-bold">{settlements.length}</p>
        </Card>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="settle">Settle up</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses…" className="pl-9" />
            </div>
            <Select value={filterParticipant} onValueChange={setFilterParticipant}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All participants</SelectItem>
                {participants.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card className="bg-gradient-card p-10 text-center shadow-card">
              <Receipt className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">No expenses yet. Add your first one!</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => {
                const payer = partMap.get(e.payer_id);
                return (
                  <Card key={e.id} className="flex items-center justify-between p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: (payer?.color ?? "#10b981") + "22" }}>
                        <Receipt className="h-5 w-5" style={{ color: payer?.color ?? "#10b981" }} />
                      </div>
                      <div>
                        <p className="font-medium">{e.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {payer?.name} paid · {new Date(e.expense_date).toLocaleDateString()} · <Badge variant="secondary" className="ml-1">{e.category}</Badge>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold">{fmt(Number(e.amount))}</p>
                        <p className="text-xs text-muted-foreground capitalize">{e.split_mode} split</p>
                      </div>
                      <ExpenseDialog groupId={groupId} participants={participants} expense={e} onSaved={load} trigger={
                        <Button variant="ghost" size="icon"><Edit2 className="h-4 w-4" /></Button>
                      } />
                      <Button variant="ghost" size="icon" onClick={async () => {
                        const { error } = await supabase.from("expenses").delete().eq("id", e.id);
                        if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="balances">
          <Card className="overflow-hidden shadow-card">
            <table className="w-full">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Participant</th><th className="p-3 text-right">Net balance</th></tr>
              </thead>
              <tbody>
                {participants.map((p) => {
                  const v = balances.get(p.id) ?? 0;
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color ?? "#10b981" }} /><span className="font-medium">{p.name}</span>{p.is_owner && <Badge variant="secondary" className="text-[10px]">you</Badge>}</div></td>
                      <td className={`p-3 text-right font-semibold ${v > 0 ? "text-success" : v < 0 ? "text-destructive" : ""}`}>{v >= 0 ? "+" : ""}{fmt(v)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="settle">
          {settlements.length === 0 ? (
            <Card className="bg-gradient-card p-10 text-center shadow-card">
              <Sparkles className="mx-auto h-8 w-8 text-success" />
              <p className="mt-2 font-medium">All settled up!</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {settlements.map((s, i) => {
                const from = partMap.get(s.fromId); const to = partMap.get(s.toId);
                return (
                  <Card key={i} className="flex items-center justify-between p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{from?.name}</span>
                      <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{to?.name}</span>
                    </div>
                    <span className="font-semibold text-primary">{fmt(s.amount)}</span>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============== Expense Dialog ==============
function ExpenseDialog({ groupId, participants, expense, onSaved, trigger }: {
  groupId: string; participants: Participant[]; expense?: ExpenseFull; onSaved: () => void; trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState(expense?.category ?? "general");
  const [payerId, setPayerId] = useState(expense?.payer_id ?? participants.find((p) => p.is_owner)?.id ?? participants[0]?.id ?? "");
  const [date, setDate] = useState(expense?.expense_date ?? new Date().toISOString().slice(0, 10));
  const [splitMode, setSplitMode] = useState<"equal" | "custom" | "percentage">(expense?.split_mode ?? "equal");
  const [included, setIncluded] = useState<Set<string>>(new Set(expense ? expense.splits.map((s) => s.participant_id) : participants.map((p) => p.id)));
  const [values, setValues] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    if (expense) expense.splits.forEach((s) => { o[s.participant_id] = String(s.share_amount); });
    return o;
  });
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(included);
    if (next.has(id)) next.delete(id); else next.add(id);
    setIncluded(next);
  };

  const save = async () => {
    const amt = parseFloat(amount);
    if (!description.trim() || !(amt > 0) || !payerId) return toast.error("Fill all fields");
    const ids = Array.from(included);
    if (ids.length === 0) return toast.error("Select at least one participant");

    let valMap: Record<string, number> | undefined;
    if (splitMode !== "equal") {
      valMap = {};
      ids.forEach((id) => { valMap![id] = parseFloat(values[id] ?? "0") || 0; });
      if (splitMode === "percentage") {
        const sum = Object.values(valMap).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 100) > 0.01) return toast.error("Percentages must sum to 100");
      } else {
        const sum = Object.values(valMap).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - amt) > 0.01) return toast.error("Custom amounts must sum to total");
      }
    }
    const splits = computeSplits(amt, ids, splitMode, valMap);
    setBusy(true);
    if (expense) {
      const { error } = await supabase.from("expenses").update({
        description: description.trim(), amount: amt, category, payer_id: payerId, expense_date: date, split_mode: splitMode,
      }).eq("id", expense.id);
      if (!error) {
        await supabase.from("expense_splits").delete().eq("expense_id", expense.id);
        await supabase.from("expense_splits").insert(splits.map((s) => ({ ...s, expense_id: expense.id })));
      }
      setBusy(false);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("expenses").insert({
        group_id: groupId, description: description.trim(), amount: amt, category, payer_id: payerId, expense_date: date, split_mode: splitMode,
      }).select().single();
      if (error || !data) { setBusy(false); return toast.error(error?.message ?? "Failed"); }
      const { error: sErr } = await supabase.from("expense_splits").insert(splits.map((s) => ({ ...s, expense_id: data.id })));
      setBusy(false);
      if (sErr) return toast.error(sErr.message);
    }
    toast.success(expense ? "Updated" : "Added");
    setOpen(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button className="bg-gradient-mint text-primary-foreground shadow-mint hover:opacity-90"><Plus className="mr-1 h-4 w-4" />Expense</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{expense ? "Edit" : "Add"} expense</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Paid by</Label>
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{participants.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["general", "food", "travel", "rent", "utilities", "shopping", "entertainment"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Split mode</Label>
            <Select value={splitMode} onValueChange={(v) => setSplitMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="equal">Equal</SelectItem><SelectItem value="custom">Custom amount</SelectItem><SelectItem value="percentage">Percentage</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label>Split between</Label>
            <div className="space-y-2 rounded-lg border border-border p-3">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <input type="checkbox" checked={included.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-[var(--color-primary)]" />
                  <span className="flex-1 text-sm">{p.name}</span>
                  {splitMode !== "equal" && included.has(p.id) && (
                    <Input type="number" step="0.01" className="w-28" placeholder={splitMode === "percentage" ? "%" : "$"}
                      value={values[p.id] ?? ""} onChange={(e) => setValues({ ...values, [p.id]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} className="bg-gradient-mint text-primary-foreground shadow-mint">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{expense ? "Save" : "Add"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Manage participants & rename ==============
function ManageDialog({ groupId, group, participants, onSaved }: { groupId: string; group: { name: string; emoji: string }; participants: Participant[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const [emoji, setEmoji] = useState(group.emoji);
  const [parts, setParts] = useState<Participant[]>(participants);
  const [newName, setNewName] = useState("");

  useEffect(() => { setParts(participants); setName(group.name); setEmoji(group.emoji); }, [open, participants, group]);

  const saveAll = async () => {
    await supabase.from("groups").update({ name, emoji }).eq("id", groupId);
    for (const p of parts) {
      await supabase.from("participants").update({ name: p.name, color: p.color }).eq("id", p.id);
    }
    toast.success("Saved");
    setOpen(false); onSaved();
  };

  const addParticipant = async () => {
    if (!newName.trim()) return;
    if (parts.length >= 4) return toast.error("Max 4 participants");
    const colors = ["#10b981", "#06b6d4", "#f59e0b", "#a855f7"];
    const { error } = await supabase.from("participants").insert({ group_id: groupId, name: newName.trim(), color: colors[parts.length % 4] });
    if (error) return toast.error(error.message);
    setNewName(""); onSaved(); setOpen(false);
  };

  const removeParticipant = async (id: string) => {
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removed (linked expenses cascaded)"); onSaved(); setOpen(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Manage</Button></DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Manage group</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div><Label>Emoji</Label><Input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 2))} /></div>
            <div><Label>Group name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          <div>
            <Label>Participants</Label>
            <div className="space-y-2 rounded-lg border border-border p-3">
              {parts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input type="color" value={p.color ?? "#10b981"} onChange={(e) => { const c = [...parts]; c[i] = { ...p, color: e.target.value }; setParts(c); }} className="h-8 w-8 rounded" />
                  <Input value={p.name} onChange={(e) => { const c = [...parts]; c[i] = { ...p, name: e.target.value }; setParts(c); }} />
                  {p.is_owner ? <Badge variant="secondary">you</Badge> :
                    <Button size="icon" variant="ghost" onClick={() => removeParticipant(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              ))}
              {parts.length < 4 && (
                <div className="flex gap-2 pt-2">
                  <Input placeholder="New participant" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <Button onClick={addParticipant} variant="outline">Add</Button>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={saveAll} className="bg-gradient-mint text-primary-foreground shadow-mint">Save changes</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== MintSense AI Dialog ==============
function MintSenseDialog({ groupId, participants, expenses, onSaved }: { groupId: string; participants: Participant[]; expenses: ExpenseFull[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string>("");

  const parseExpense = async () => {
    if (!text.trim()) return;
    setBusy(true); setSummary("");
    try {
      const { data, error } = await supabase.functions.invoke("mintsense", {
        body: { mode: "parse", text, participants: participants.map((p) => ({ id: p.id, name: p.name, is_owner: p.is_owner })) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const parsed = data.expense;
      const payer = participants.find((p) => p.id === parsed.payer_id) ?? participants[0];
      const ids = (parsed.participant_ids?.length ? parsed.participant_ids : participants.map((p) => p.id)) as string[];
      const splits = computeSplits(Number(parsed.amount), ids, "equal");
      const { data: exp, error: eErr } = await supabase.from("expenses").insert({
        group_id: groupId, description: parsed.description, amount: parsed.amount, category: parsed.category ?? "general",
        payer_id: payer.id, expense_date: parsed.date ?? new Date().toISOString().slice(0, 10), split_mode: "equal",
      }).select().single();
      if (eErr || !exp) throw eErr;
      await supabase.from("expense_splits").insert(splits.map((s) => ({ ...s, expense_id: exp.id })));
      toast.success(`Added: ${parsed.description}`);
      setText(""); setOpen(false); onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setBusy(false); }
  };

  const summarize = async () => {
    setBusy(true); setSummary("");
    try {
      const balances = computeNetBalances(participants, expenses);
      const settlements = minimalSettlements(balances);
      const { data, error } = await supabase.functions.invoke("mintsense", {
        body: {
          mode: "summary",
          participants: participants.map((p) => ({ id: p.id, name: p.name })),
          expenses: expenses.map((e) => ({ description: e.description, amount: e.amount, payer: participants.find((p) => p.id === e.payer_id)?.name, date: e.expense_date, category: e.category })),
          balances: Array.from(balances.entries()).map(([id, v]) => ({ name: participants.find((p) => p.id === id)?.name, net: v })),
          settlements: settlements.map((s) => ({ from: participants.find((p) => p.id === s.fromId)?.name, to: participants.find((p) => p.id === s.toId)?.name, amount: s.amount })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSummary(data.summary);
    } catch (e: any) { toast.error(e.message ?? "Failed"); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/40 text-primary"><Sparkles className="mr-1 h-4 w-4" />MintSense</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />MintSense AI</DialogTitle></DialogHeader>
        <Tabs defaultValue="add">
          <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="add">Add via text</TabsTrigger><TabsTrigger value="summary">Smart summary</TabsTrigger></TabsList>
          <TabsContent value="add" className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">e.g. "I paid $48 for dinner last night, split with Alex and Sam"</p>
            <textarea className="min-h-[100px] w-full rounded-md border border-border bg-input p-3 text-sm" value={text} onChange={(e) => setText(e.target.value)} />
            <Button onClick={parseExpense} disabled={busy} className="w-full bg-gradient-mint text-primary-foreground shadow-mint">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Parse & add expense"}
            </Button>
          </TabsContent>
          <TabsContent value="summary" className="space-y-3 pt-2">
            <Button onClick={summarize} disabled={busy || expenses.length === 0} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate summary"}
            </Button>
            {summary && <Card className="whitespace-pre-wrap bg-accent/40 p-4 text-sm">{summary}</Card>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
