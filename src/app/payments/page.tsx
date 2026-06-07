"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { BDT, formatDateTime } from "@/lib/format";
import { logActivity, type Member } from "@/lib/queries";
import { toast } from "sonner";
import { Plus, Trash2, Wallet } from "lucide-react";

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["payments-list"],
    queryFn: async () => {
      const [p, m] = await Promise.all([
        supabase.from("payments").select("*").order("created_at", { ascending: false }),
        supabase.from("members").select("id, name"),
      ]);
      const names = new Map<string, string>((m.data ?? []).map((mm: any) => [mm.id, mm.name]));
      return (p.data ?? []).map((row: any) => ({
        ...row,
        name: names.get(row.member_id) ?? "Unknown",
      }));
    },
  });

  async function remove(id: string, name: string, amount: number) {
    if (!confirm("Delete this payment?")) return;
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity("payment", `Deleted payment of ${BDT(amount)} from ${name}`);
    toast.success("Payment deleted");
    qc.invalidateQueries();
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto">
      <PageHeader
        title="Payments"
        subtitle="Record member payments and reduce dues"
        actions={
          <Button onClick={() => setOpen(true)} className="gradient-ember text-primary-foreground">
            <Plus className="size-4" /> Record payment
          </Button>
        }
      />

      <Card className="bg-surface border-border overflow-hidden">
        <div className="divide-y divide-border">
          {(data ?? []).map((p: any) => (
            <div key={p.id} className="flex items-center gap-4 p-4">
              <div className="size-9 rounded-full bg-success/15 flex items-center justify-center">
                <Wallet className="size-4 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {p.name}
                  <span className="ml-2 inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {p.method === "bkash" ? "bKash" : "Cash"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(p.created_at)}
                  {p.note ? ` · ${p.note}` : ""}
                </div>
              </div>
              <div className="text-success font-semibold">+{BDT(Number(p.amount))}</div>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 hover:text-destructive"
                onClick={() => remove(p.id, p.name, Number(p.amount))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {(!data || data.length === 0) && (
            <div className="p-6 text-sm text-muted-foreground">No payments yet.</div>
          )}
        </div>
      </Card>

      <PaymentDialog open={open} onOpenChange={setOpen} onSaved={() => qc.invalidateQueries()} />
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { data: members } = useQuery({
    queryKey: ["members-min-pay"],
    queryFn: async () => {
      const [m, sp, pay] = await Promise.all([
        supabase.from("members").select("*").order("name"),
        supabase.from("session_participants").select("member_id, share_amount"),
        supabase.from("payments").select("member_id, amount"),
      ]);
      const due = new Map<string, number>();
      sp.data?.forEach((p: any) => {
        due.set(p.member_id, (due.get(p.member_id) ?? 0) + Number(p.share_amount));
      });
      pay.data?.forEach((p: any) => {
        due.set(p.member_id, (due.get(p.member_id) ?? 0) - Number(p.amount));
      });
      return ((m.data ?? []) as Member[]).map((mm) => ({
        ...mm,
        due: Math.max(0, due.get(mm.id) ?? 0),
      }));
    },
  });

  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bkash">("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedMember = useMemo(
    () => members?.find((m) => m.id === memberId),
    [members, memberId],
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const amt = Number(amount);
      if (!memberId) throw new Error("Pick a member");
      if (!amt || amt <= 0) throw new Error("Enter an amount");
      const { error } = await supabase.from("payments").insert({
        user_id: u.user.id,
        member_id: memberId,
        amount: amt,
        method,
        note: note || null,
      });
      if (error) throw error;
      await logActivity(
        "payment",
        `Payment from ${selectedMember?.name ?? "member"} via ${method === "bkash" ? "bKash" : "Cash"}`,
        amt,
      );
      toast.success("Payment recorded");
      onSaved();
      onOpenChange(false);
      setAmount("");
      setNote("");
      setMemberId("");
      setMethod("cash");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Pick a member" />
              </SelectTrigger>
              <SelectContent>
                {(members ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} {m.due > 0 ? `· due ${BDT(m.due)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMember && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Current due: {BDT(selectedMember.due)}
              </p>
            )}
          </div>
          <div>
            <Label>Amount (BDT)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5"
              required
            />
            {selectedMember && selectedMember.due > 0 && (
              <button
                type="button"
                onClick={() => setAmount(String(selectedMember.due))}
                className="text-xs text-primary mt-1.5 hover:underline"
              >
                Pay full due ({BDT(selectedMember.due)})
              </button>
            )}
          </div>
          <div>
            <Label>Payment method</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["cash", "bkash"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    method === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "bkash" ? "bKash" : "Cash"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={saving}
              className="gradient-ember text-primary-foreground"
            >
              Save payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
