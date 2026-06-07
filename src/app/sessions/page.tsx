"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BDT, applyRounding, formatDate, formatDateTime, type RoundingMode } from "@/lib/format";
import { logActivity, type Member, type SmokingSession } from "@/lib/queries";
import { toast } from "sonner";
import { Plus, Cigarette, Trash2, Users, Pencil, CalendarDays } from "lucide-react";

type SessionWithParts = SmokingSession & {
  participants: Array<{
    id: string;
    member_id: string;
    share_amount: number;
    name: string;
    phone: string | null;
  }>;
};

export default function SessionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SessionWithParts | null>(null);

  const { data } = useQuery({
    queryKey: ["sessions-list"],
    queryFn: async () => {
      const [s, sp, m] = await Promise.all([
        supabase.from("smoking_sessions").select("*").order("created_at", { ascending: false }),
        supabase.from("session_participants").select("*"),
        supabase.from("members").select("id, name, phone"),
      ]);
      const members = new Map<string, { name: string; phone: string | null }>(
        (m.data ?? []).map((mm: any) => [mm.id, { name: mm.name, phone: mm.phone }]),
      );
      const partsBySession = new Map<string, any[]>();
      sp.data?.forEach((p: any) => {
        const arr = partsBySession.get(p.session_id) ?? [];
        arr.push(p);
        partsBySession.set(p.session_id, arr);
      });
      return (s.data ?? []).map((sess: any) => ({
        ...sess,
        participants: (partsBySession.get(sess.id) ?? []).map((p) => {
          const mm = members.get(p.member_id);
          return {
            ...p,
            name: mm?.name ?? "Unknown",
            phone: mm?.phone ?? null,
          };
        }),
      })) as SessionWithParts[];
    },
  });

  async function remove(sess: SmokingSession) {
    if (!confirm("Delete this session? Member dues from it will be removed.")) return;
    const { error } = await supabase.from("smoking_sessions").delete().eq("id", sess.id);
    if (error) return toast.error(error.message);
    await logActivity("session", `Deleted session of ${BDT(Number(sess.total_cost))}`);
    toast.success("Session deleted");
    qc.invalidateQueries();
  }

  // Group sessions by day -> per-member breakdown
  const dayGroups = (() => {
    const groups = new Map<
      string,
      {
        dateKey: string;
        label: string;
        sessions: SessionWithParts[];
        members: Map<
          string,
          { name: string; phone: string | null; total: number; sessionNos: number[] }
        >;
      }
    >();
    const sorted = [...(data ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    for (const s of sorted) {
      const d = new Date(s.created_at);
      // Use LOCAL date (not UTC) so a session entered on the 25th locally
      // doesn't get bucketed into the 24th because of timezone offset.
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!groups.has(key)) {
        groups.set(key, {
          dateKey: key,
          label: formatDate(d),
          sessions: [],
          members: new Map(),
        });
      }
      const g = groups.get(key)!;
      g.sessions.push(s);
      const sessionNo = g.sessions.length;
      for (const p of s.participants) {
        const m = g.members.get(p.member_id) ?? {
          name: p.name,
          phone: p.phone,
          total: 0,
          sessionNos: [] as number[],
        };
        m.total += Number(p.share_amount);
        m.sessionNos.push(sessionNo);
        g.members.set(p.member_id, m);
      }
    }
    return Array.from(groups.values()).sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
  })();

  const [viewingDay, setViewingDay] = useState<string | null>(null);
  const activeDay = dayGroups.find((g) => g.dateKey === viewingDay) ?? null;

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto">
      <PageHeader
        title="Smoking sessions"
        subtitle="One card per day · click to see every session"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="gradient-ember text-primary-foreground"
          >
            <Plus className="size-4" /> New session
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {dayGroups.map((g) => {
          const dayTotal = g.sessions.reduce((s, x) => s + Number(x.total_cost), 0);
          return (
            <Card
              key={g.dateKey}
              role="button"
              tabIndex={0}
              onClick={() => setViewingDay(g.dateKey)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setViewingDay(g.dateKey);
                }
              }}
              className="p-5 bg-surface border-border cursor-pointer hover:border-primary/60 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <CalendarDays className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{g.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.sessions.length} session{g.sessions.length > 1 ? "s" : ""} ·{" "}
                      {g.members.size} member{g.members.size > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Day total
                  </div>
                  <div className="text-base font-semibold text-gradient-ember">{BDT(dayTotal)}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingDay(g.dateKey);
                  }}
                >
                  View session details
                </Button>
              </div>
            </Card>
          );
        })}
        {dayGroups.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">
            No sessions yet. Create one.
          </p>
        )}
      </div>

      <DayDetailDialog
        day={activeDay}
        onOpenChange={(v) => !v && setViewingDay(null)}
        onEdit={(s) => {
          setEditing(s);
          setOpen(true);
        }}
        onDelete={remove}
      />

      <SessionDialog
        open={open}
        onOpenChange={setOpen}
        session={editing}
        onSaved={() => qc.invalidateQueries()}
      />
    </div>
  );
}

function DayDetailDialog({
  day,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  day: {
    dateKey: string;
    label: string;
    sessions: SessionWithParts[];
    members: Map<
      string,
      { name: string; phone: string | null; total: number; sessionNos: number[] }
    >;
  } | null;
  onOpenChange: (v: boolean) => void;
  onEdit: (s: SessionWithParts) => void;
  onDelete: (s: SmokingSession) => void;
}) {
  if (!day) return null;
  const dayTotal = day.sessions.reduce((s, x) => s + Number(x.total_cost), 0);
  return (
    <Dialog open={!!day} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            {day.label}
            <span className="ml-auto text-sm font-semibold text-gradient-ember">
              {BDT(dayTotal)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {day.sessions.length} session{day.sessions.length > 1 ? "s" : ""} · {day.members.size}{" "}
            member{day.members.size > 1 ? "s" : ""}
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Member</th>
                <th className="text-left px-3 py-2 font-medium">Joined</th>
                <th className="text-right px-3 py-2 font-medium">Day due</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(day.members.values())
                .sort((a, b) => b.total - a.total)
                .map((m, idx) => {
                  return (
                    <tr key={idx} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{m.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {m.sessionNos.map((n) => `#${n}`).join(", ")}{" "}
                        <span className="text-xs">({m.sessionNos.length})</span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{BDT(m.total)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sessions
          </div>
          {day.sessions.map((s, i) => (
            <Card key={s.id} className="p-4 bg-surface-2 border-border">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Cigarette className="size-4 text-primary" />
                    <span className="font-semibold">
                      #{i + 1} · {s.quantity}× @ {BDT(Number(s.cigarette_price))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {formatDateTime(s.created_at)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Users className="size-3" /> {s.participants.length} participants ·{" "}
                    {BDT(Number(s.per_share))} per person
                  </div>
                  {s.notes && <p className="text-sm text-muted-foreground mt-2">{s.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Total
                    </div>
                    <div className="text-base font-semibold text-gradient-ember">
                      {BDT(Number(s.total_cost))}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => onEdit(s)}
                    title="Edit session"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 hover:text-destructive"
                    onClick={() => onDelete(s)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {s.participants.map((p) => (
                  <span
                    key={p.id}
                    className="text-xs px-2.5 py-1 rounded-full bg-surface border border-border"
                  >
                    {p.name} · {BDT(Number(p.share_amount))}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SessionDialog({
  open,
  onOpenChange,
  session,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  session: SessionWithParts | null;
  onSaved: () => void;
}) {
  const { data: members } = useQuery({
    queryKey: ["members-min"],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("*").order("name");
      return (data ?? []) as Member[];
    },
  });

  const [price, setPrice] = useState(80);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rounding, setRounding] = useState<RoundingMode>("nearest_5");
  const [override, setOverride] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessionDate, setSessionDate] = useState<string>("");

  // Format a Date as "YYYY-MM-DDTHH:mm" in LOCAL time for <input type="datetime-local" />
  function toLocalInput(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Sync form when opening for create/edit
  useEffect(() => {
    if (!open) return;
    if (session) {
      setPrice(Number(session.cigarette_price));
      setQuantity(session.quantity);
      setSelected(new Set(session.participants.map((p) => p.member_id)));
      setRounding(session.rounding_mode as RoundingMode);
      setOverride(String(session.per_share));
      setNotes(session.notes ?? "");
      setSessionDate(toLocalInput(new Date(session.created_at)));
    } else {
      setPrice(80);
      setQuantity(1);
      setSelected(new Set());
      setRounding("nearest_5");
      setOverride("");
      setNotes("");
      setSessionDate(toLocalInput(new Date()));
    }
  }, [open, session]);

  const total = price * quantity;
  const rawShare = selected.size > 0 ? total / selected.size : 0;
  const autoShare = applyRounding(rawShare, rounding);
  const finalShare = override !== "" ? Number(override) : autoShare;

  function toggle(id: string) {
    const n = new Set(selected);
    if (n.has(id)) {
      n.delete(id);
    } else {
      n.add(id);
    }
    setSelected(n);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) return toast.error("Select at least one participant");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");

      // Parse the local datetime string into an ISO timestamp.
      // new Date("YYYY-MM-DDTHH:mm") treats the input as local time, which is
      // exactly what we want, then toISOString() converts to UTC for storage.
      const createdAtIso = sessionDate
        ? new Date(sessionDate).toISOString()
        : new Date().toISOString();

      let sessionId: string;
      if (session) {
        const { error } = await supabase
          .from("smoking_sessions")
          .update({
            cigarette_price: price,
            quantity,
            total_cost: total,
            per_share: finalShare,
            rounding_mode: rounding,
            participant_count: selected.size,
            notes: notes || null,
            created_at: createdAtIso,
          })
          .eq("id", session.id);
        if (error) throw error;
        sessionId = session.id;
        await supabase.from("session_participants").delete().eq("session_id", sessionId);
      } else {
        const { data: sess, error } = await supabase
          .from("smoking_sessions")
          .insert({
            user_id: u.user.id,
            cigarette_price: price,
            quantity,
            total_cost: total,
            per_share: finalShare,
            rounding_mode: rounding,
            participant_count: selected.size,
            notes: notes || null,
            created_at: createdAtIso,
          })
          .select()
          .single();
        if (error) throw error;
        sessionId = sess!.id;
      }

      const rows = Array.from(selected).map((member_id) => ({
        user_id: u.user!.id,
        session_id: sessionId,
        member_id,
        share_amount: finalShare,
      }));
      const { error: e2 } = await supabase.from("session_participants").insert(rows);
      if (e2) throw e2;

      await logActivity(
        "session",
        session
          ? `Updated session: ${selected.size} members, ${BDT(finalShare)}/each`
          : `Session: ${selected.size} members, ${BDT(finalShare)}/each`,
        total,
        sessionId,
      );
      toast.success(session ? "Session updated" : "Session saved");

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const allMembers = members ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{session ? "Edit smoking session" : "New smoking session"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cigarette price (BDT)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label>Session date &amp; time</Label>
            <Input
              type="datetime-local"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="mt-1.5"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Pick any date — past or today. Defaults to right now.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Participants ({selected.size})</Label>
              {allMembers.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() =>
                    setSelected(
                      selected.size === allMembers.length
                        ? new Set()
                        : new Set(allMembers.map((m) => m.id)),
                    )
                  }
                >
                  {selected.size === allMembers.length ? "Clear all" : "Select all"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
              {allMembers.map((m) => {
                const on = selected.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className={`text-left px-3 py-2 rounded-lg border text-sm transition ${
                      on
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
              {allMembers.length === 0 && (
                <p className="text-xs text-muted-foreground col-span-2">Add members first.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rounding</Label>
              <Select value={rounding} onValueChange={(v) => setRounding(v as RoundingMode)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No rounding</SelectItem>
                  <SelectItem value="nearest_5">Nearest 5</SelectItem>
                  <SelectItem value="nearest_10">Nearest 10</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Manual override</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={String(autoShare)}
                value={override}
                onChange={(e) => setOverride(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="rounded-lg bg-surface-2 p-4 grid grid-cols-3 gap-3 text-center">
            <Mini label="Total" value={BDT(total)} />
            <Mini label="Auto share" value={BDT(autoShare)} />
            <Mini label="Per person" value={BDT(finalShare)} accent />
          </div>

          <div>
            <Label>Session notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1.5"
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={saving || selected.size === 0}
              className="gradient-ember text-primary-foreground"
            >
              {session ? "Save changes" : "Save session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${accent ? "text-gradient-ember" : ""}`}>{value}</div>
    </div>
  );
}
