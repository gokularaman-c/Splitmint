import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: () => <AppShell><Dashboard /></AppShell>,
});

type Group = { id: string; name: string; emoji: string; participants: { count: number }[] };

function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💸");
  const [members, setMembers] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("groups")
      .select("id, name, emoji, participants(count)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setGroups((data as Group[]) ?? []);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const create = async () => {
    if (!name.trim() || !user) return;
    const filteredMembers = members.map((m) => m.trim()).filter(Boolean);
    if (filteredMembers.length > 3) return toast.error("Max 3 additional participants.");
    setBusy(true);
    const { data: group, error } = await supabase
      .from("groups").insert({ name: name.trim(), emoji, owner_id: user.id }).select().single();
    if (error || !group) { setBusy(false); return toast.error(error?.message ?? "Failed"); }

    const ownerName = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "You";
    const palette = ["#10b981", "#06b6d4", "#f59e0b", "#a855f7"];
    const rows = [
      { group_id: group.id, name: ownerName, color: palette[0], is_owner: true },
      ...filteredMembers.map((n, i) => ({ group_id: group.id, name: n, color: palette[(i + 1) % palette.length], is_owner: false })),
    ];
    const { error: pErr } = await supabase.from("participants").insert(rows);
    setBusy(false);
    if (pErr) toast.error(pErr.message);
    else {
      toast.success("Group created!");
      setOpen(false); setName(""); setMembers(["", ""]); setEmoji("💸");
      load();
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your groups</h1>
          <p className="mt-1 text-muted-foreground">Create a group to start splitting expenses.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-mint text-primary-foreground shadow-mint hover:opacity-90">
              <Plus className="mr-1 h-4 w-4" /> New group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a group</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-20"><Label>Emoji</Label><Input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 2))} /></div>
                <div className="flex-1"><Label>Name</Label><Input placeholder="Trip to Goa" value={name} onChange={(e) => setName(e.target.value)} /></div>
              </div>
              <div>
                <Label>Other participants (max 3)</Label>
                <div className="space-y-2">
                  {members.map((m, i) => (
                    <Input key={i} placeholder={`Friend ${i + 1}`} value={m}
                      onChange={(e) => { const c = [...members]; c[i] = e.target.value; setMembers(c); }} />
                  ))}
                  {members.length < 3 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setMembers([...members, ""])}>+ Add another</Button>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create} disabled={busy} className="bg-gradient-mint text-primary-foreground shadow-mint">
                Create group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card className="bg-gradient-card p-12 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No groups yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first group to start tracking shared expenses.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Link key={g.id} to="/groups/$groupId" params={{ groupId: g.id }}>
              <Card className="group cursor-pointer bg-gradient-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-mint">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-2xl">{g.emoji}</div>
                    <div>
                      <h3 className="font-semibold">{g.name}</h3>
                      <p className="text-xs text-muted-foreground">{g.participants?.[0]?.count ?? 0} members</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
