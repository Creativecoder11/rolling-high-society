"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BDT, formatDate, formatDateTime } from "@/lib/format";
import { logActivity, type Member } from "@/lib/queries";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Phone, Wallet, Cigarette, MoreVertical } from "lucide-react";

export default function MembersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [viewing, setViewing] = useState<Member | null>(null);
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["members-full"],
    queryFn: async () => {
      const [m, sp, pay] = await Promise.all([
        supabase.from("members").select("*").order("name"),
        supabase.from("session_participants").select("member_id, share_amount"),
        supabase.from("payments").select("member_id, amount"),
      ]);
      const members = (m.data ?? []) as Member[];
      const due = new Map<string, number>();
      const paid = new Map<string, number>();
      const sessions = new Map<string, number>();
      sp.data?.forEach((p: any) => {
        due.set(p.member_id, (due.get(p.member_id) ?? 0) + Number(p.share_amount));
        sessions.set(p.member_id, (sessions.get(p.member_id) ?? 0) + 1);
      });
      pay.data?.forEach((p: any) => {
        paid.set(p.member_id, (paid.get(p.member_id) ?? 0) + Number(p.amount));
      });
      return members.map((mm) => ({
        ...mm,
        totalDue: (due.get(mm.id) ?? 0) - (paid.get(mm.id) ?? 0),
        totalPaid: paid.get(mm.id) ?? 0,
        sessionCount: sessions.get(mm.id) ?? 0,
      }));
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (m) => m.name.toLowerCase().includes(term) || (m.phone ?? "").toLowerCase().includes(term),
    );
  }, [data, q]);

  async function remove(m: Member) {
    if (!confirm(`Delete ${m.name}? This removes their history too.`)) return;
    const { error } = await supabase.from("members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    await logActivity("member", `Deleted member ${m.name}`);
    toast.success("Member deleted");
    qc.invalidateQueries();
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto">
      <PageHeader
        title="Members"
        subtitle={`${data?.length ?? 0} members total`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="gradient-ember text-primary-foreground"
          >
            <Plus className="size-4" /> Add member
          </Button>
        }
      />

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or phone"
          className="pl-9"
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m) => (
          <Card key={m.id} className="p-5 bg-surface border-border">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{m.name}</div>
                {m.phone && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="size-3" /> {m.phone}
                  </div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="size-8">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-surface border-border">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(m);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="size-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => remove(m)}
                  >
                    <Trash2 className="size-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Stat label="Due" value={BDT(Math.max(0, m.totalDue))} warn={m.totalDue > 0} />
              <Stat label="Paid" value={BDT(m.totalPaid)} />
              <Stat label="Sessions" value={String(m.sessionCount)} />
            </div>
            {m.notes && (
              <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{m.notes}</p>
            )}
            <Button
              onClick={() => setViewing(m)}
              className="w-full mt-4 gradient-ember text-primary-foreground"
            >
              <Wallet className="size-4" /> Paid / History
            </Button>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No members found.</p>
        )}
      </div>

      <MemberDialog
        open={open}
        onOpenChange={setOpen}
        member={editing}
        onSaved={() => qc.invalidateQueries()}
      />
      <MemberDetailDialog
        member={viewing}
        onOpenChange={(v) => !v && setViewing(null)}
        onChanged={() => qc.invalidateQueries()}
      />
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${warn ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

function MemberDialog({
  open,
  onOpenChange,
  member,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: Member | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [notes, setNotes] = useState(member?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // sync when member changes
  useMemo(() => {
    setName(member?.name ?? "");
    setPhone(member?.phone ?? "");
    setNotes(member?.notes ?? "");
  }, [member]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      if (member) {
        const { error } = await supabase
          .from("members")
          .update({ name, phone: phone || null, notes: notes || null })
          .eq("id", member.id);
        if (error) throw error;
        await logActivity("member", `Updated member ${name}`);
        toast.success("Member updated");
      } else {
        const { error } = await supabase.from("members").insert({
          user_id: u.user.id,
          name,
          phone: phone || null,
          notes: notes || null,
        });
        if (error) throw error;
        await logActivity("member", `Added member ${name}`);
        toast.success("Member added");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member ? "Edit member" : "Add member"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5"
              placeholder="01XXXXXXXXX"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={saving}
              className="gradient-ember text-primary-foreground"
            >
              {member ? "Save changes" : "Add member"}
            </Button>
          </DialogFooter>
        </form>

        {member && <PersonalSessionSection member={member} />}
      </DialogContent>
    </Dialog>
  );
}

function PersonalSessionSection({ member }: { member: Member }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const PRESETS = [30, 50, 80, 100];

  const { data: list } = useQuery({
    queryKey: ["personal-sessions", member.id],
    queryFn: async () => {
      const { data: parts } = await supabase
        .from("session_participants")
        .select("id, session_id, share_amount, smoking_sessions(id, participant_count, created_at)")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false });
      return (parts ?? [])
        .filter((p: any) => p.smoking_sessions?.participant_count === 1)
        .map((p: any) => ({
          sessionId: p.session_id,
          amount: Number(p.share_amount),
          createdAt: p.smoking_sessions.created_at as string,
        }));
    },
  });

  async function addPersonal(amt: number) {
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { data: sess, error: sErr } = await supabase
        .from("smoking_sessions")
        .insert({
          user_id: u.user.id,
          cigarette_price: amt,
          quantity: 1,
          total_cost: amt,
          per_share: amt,
          rounding_mode: "none",
          participant_count: 1,
          notes: `Personal · ${member.name}`,
        })
        .select()
        .single();
      if (sErr) throw sErr;
      const { error: pErr } = await supabase.from("session_participants").insert({
        user_id: u.user.id,
        session_id: sess.id,
        member_id: member.id,
        share_amount: amt,
      });
      if (pErr) throw pErr;
      await logActivity("session", `Personal session for ${member.name}`, amt, sess.id);
      toast.success("Personal session added");
      setAmount("");
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removePersonal(sessionId: string) {
    if (!confirm("Delete this personal session?")) return;
    await supabase.from("session_participants").delete().eq("session_id", sessionId);
    const { error } = await supabase.from("smoking_sessions").delete().eq("id", sessionId);
    if (error) return toast.error(error.message);
    toast.success("Personal session deleted");
    qc.invalidateQueries();
  }

  const total = (list ?? []).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="mt-2 pt-4 border-t border-border space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Personal sessions</div>
          <div className="text-xs text-muted-foreground">Added directly to {member.name}'s due</div>
        </div>
        <div className="text-sm font-semibold text-destructive">{BDT(total)}</div>
      </div>

      <div className="rounded-lg bg-surface-2 p-3 space-y-2">
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={saving}
              onClick={() => addPersonal(p)}
              className="rounded-md border border-border bg-surface px-2 py-2 text-sm font-medium hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            >
              +৳{p}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Custom amount"
          />
          <Button
            type="button"
            disabled={saving}
            onClick={() => addPersonal(Number(amount))}
            className="gradient-ember text-primary-foreground"
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>

      <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
        {(list ?? []).map((r) => (
          <div key={r.sessionId} className="flex items-center gap-3 px-3 py-2">
            <div className="size-7 rounded-full bg-destructive/15 flex items-center justify-center">
              <Cigarette className="size-3.5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="font-medium">Personal session</div>
              <div className="text-muted-foreground">{formatDateTime(r.createdAt)}</div>
            </div>
            <div className="text-sm font-semibold text-destructive">+{BDT(r.amount)}</div>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 hover:text-destructive"
              onClick={() => removePersonal(r.sessionId)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        {(!list || list.length === 0) && (
          <div className="px-3 py-3 text-xs text-muted-foreground">No personal sessions yet.</div>
        )}
      </div>
    </div>
  );
}

type TimelineRow =
  | { kind: "session"; id: string; date: string; amount: number; notes: string | null }
  | {
      kind: "payment";
      id: string;
      date: string;
      amount: number;
      method: "cash" | "bkash";
      note: string | null;
    };

function MemberDetailDialog({
  member,
  onOpenChange,
  onChanged,
}: {
  member: Member | null;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const memberId = member?.id ?? "";
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bkash">("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    enabled: !!memberId,
    queryKey: ["member-detail", memberId],
    queryFn: async () => {
      const [sp, pay] = await Promise.all([
        supabase
          .from("session_participants")
          .select("id, share_amount, session_id, created_at, smoking_sessions(notes, created_at)")
          .eq("member_id", memberId)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("id, amount, method, note, created_at")
          .eq("member_id", memberId)
          .order("created_at", { ascending: false }),
      ]);
      const totalDue = (sp.data ?? []).reduce((s: number, r: any) => s + Number(r.share_amount), 0);
      const totalPaid = (pay.data ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
      const rows: TimelineRow[] = [
        ...(sp.data ?? []).map((r: any) => ({
          kind: "session" as const,
          id: r.id,
          date: r.smoking_sessions?.created_at ?? r.created_at,
          amount: Number(r.share_amount),
          notes: r.smoking_sessions?.notes ?? null,
        })),
        ...(pay.data ?? []).map((r: any) => ({
          kind: "payment" as const,
          id: r.id,
          date: r.created_at,
          amount: Number(r.amount),
          method: (r.method ?? "cash") as "cash" | "bkash",
          note: r.note,
        })),
      ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

      // group by date
      const byDay = new Map<string, TimelineRow[]>();
      for (const r of rows) {
        const key = new Date(r.date).toDateString();
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(r);
      }
      return { totalDue, totalPaid, remaining: totalDue - totalPaid, byDay };
    },
  });

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Enter an amount");
      const { error } = await supabase.from("payments").insert({
        user_id: u.user.id,
        member_id: member.id,
        amount: amt,
        method,
        note: note || null,
      });
      if (error) throw error;
      await logActivity(
        "payment",
        `Payment from ${member.name} via ${method === "bkash" ? "bKash" : "Cash"}`,
        amt,
      );
      toast.success("Payment recorded");
      setAmount("");
      setNote("");
      setMethod("cash");
      qc.invalidateQueries({ queryKey: ["member-detail", member.id] });
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(id: string) {
    if (!confirm("Delete this payment?")) return;
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payment deleted");
    qc.invalidateQueries({ queryKey: ["member-detail", memberId] });
    onChanged();
  }

  const remaining = Math.max(0, data?.remaining ?? 0);

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{member?.name}</span>
            <span
              className={`text-sm font-semibold ${remaining > 0 ? "text-destructive" : "text-success"}`}
            >
              {remaining > 0 ? `Due ${BDT(remaining)}` : "All clear"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-surface-2 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total due
            </div>
            <div className="text-sm font-semibold">{BDT(data?.totalDue ?? 0)}</div>
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total paid
            </div>
            <div className="text-sm font-semibold text-success">{BDT(data?.totalPaid ?? 0)}</div>
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Remaining
            </div>
            <div className={`text-sm font-semibold ${remaining > 0 ? "text-destructive" : ""}`}>
              {BDT(remaining)}
            </div>
          </div>
        </div>

        <form onSubmit={pay} className="rounded-lg border border-border bg-surface-2 p-3 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Record payment
          </div>
          <div className="grid grid-cols-[1fr,auto] gap-2">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (BDT)"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAmount(String(remaining))}
              disabled={remaining <= 0}
            >
              Full ({BDT(remaining)})
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["cash", "bkash"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  method === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "bkash" ? "bKash" : "Cash"}
              </button>
            ))}
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
          />
          <Button
            type="submit"
            disabled={saving}
            className="w-full gradient-ember text-primary-foreground"
          >
            <Wallet className="size-4" /> Save payment
          </Button>
        </form>

        <div className="space-y-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            History
          </div>
          {data && data.byDay.size === 0 && (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
          {data &&
            Array.from(data.byDay.entries()).map(([day, rows]) => {
              const dayDue = rows
                .filter((r) => r.kind === "session")
                .reduce((s, r) => s + r.amount, 0);
              const dayPaid = rows
                .filter((r) => r.kind === "payment")
                .reduce((s, r) => s + r.amount, 0);
              return (
                <div key={day} className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center justify-between bg-surface-2 px-3 py-2">
                    <div className="text-sm font-medium">{formatDate(day)}</div>
                    <div className="flex gap-3 text-xs">
                      {dayDue > 0 && <span className="text-destructive">+{BDT(dayDue)} due</span>}
                      {dayPaid > 0 && <span className="text-success">-{BDT(dayPaid)} paid</span>}
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {rows.map((r) => (
                      <div key={`${r.kind}-${r.id}`} className="flex items-center gap-3 px-3 py-2">
                        <div
                          className={`size-7 rounded-full flex items-center justify-center ${
                            r.kind === "session" ? "bg-destructive/15" : "bg-success/15"
                          }`}
                        >
                          {r.kind === "session" ? (
                            <Cigarette className="size-3.5 text-destructive" />
                          ) : (
                            <Wallet className="size-3.5 text-success" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-xs">
                          <div className="font-medium">
                            {r.kind === "session" ? "Session share" : "Payment"}
                            {r.kind === "payment" && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                {r.method === "bkash" ? "bKash" : "Cash"}
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            {formatDateTime(r.date)}
                            {r.kind === "session" && r.notes ? ` · ${r.notes}` : ""}
                            {r.kind === "payment" && r.note ? ` · ${r.note}` : ""}
                          </div>
                        </div>
                        <div
                          className={`text-sm font-semibold ${
                            r.kind === "session" ? "text-destructive" : "text-success"
                          }`}
                        >
                          {r.kind === "session" ? "+" : "-"}
                          {BDT(r.amount)}
                        </div>
                        {r.kind === "payment" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 hover:text-destructive"
                            onClick={() => deletePayment(r.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
