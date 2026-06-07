"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { BDT, formatDateTime } from "@/lib/format";
import { Cigarette, Wallet, UserCog } from "lucide-react";

export default function LedgerPage() {
  const { data } = useQuery({
    queryKey: ["ledger"],
    queryFn: async () => {
      const [logs, sessions, payments, members] = await Promise.all([
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }),
        supabase.from("smoking_sessions").select("*").order("created_at", { ascending: false }),
        supabase.from("payments").select("*").order("created_at", { ascending: false }),
        supabase.from("members").select("id, name"),
      ]);

      const names = new Map<string, string>((members.data ?? []).map((m: any) => [m.id, m.name]));

      type Entry = {
        id: string;
        type: "session" | "payment" | "log";
        title: string;
        sub: string;
        amount: number;
        delta: "+" | "-" | "";
        when: string;
      };

      const entries: Entry[] = [];

      sessions.data?.forEach((s: any) =>
        entries.push({
          id: `s-${s.id}`,
          type: "session",
          title: `Session · ${s.quantity}× cigarette`,
          sub: `${s.participant_count} members · ${BDT(Number(s.per_share))} each`,
          amount: Number(s.total_cost),
          delta: "-",
          when: s.created_at,
        }),
      );

      payments.data?.forEach((p: any) =>
        entries.push({
          id: `p-${p.id}`,
          type: "payment",
          title: `Payment · ${names.get(p.member_id) ?? "Member"}`,
          sub: p.note ?? "Payment received",
          amount: Number(p.amount),
          delta: "+",
          when: p.created_at,
        }),
      );

      logs.data
        ?.filter((l: any) => l.type === "member")
        .forEach((l: any) =>
          entries.push({
            id: `l-${l.id}`,
            type: "log",
            title: l.description,
            sub: "Member update",
            amount: 0,
            delta: "",
            when: l.created_at,
          }),
        );

      entries.sort((a, b) => (a.when < b.when ? 1 : -1));
      return entries;
    },
  });

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto">
      <PageHeader title="Ledger" subtitle="All transactions in chronological order" />

      <Card className="bg-surface border-border">
        <div className="divide-y divide-border">
          {(data ?? []).map((e) => {
            const Icon = e.type === "session" ? Cigarette : e.type === "payment" ? Wallet : UserCog;
            return (
              <div key={e.id} className="flex items-center gap-4 p-4">
                <div
                  className={`size-9 rounded-full flex items-center justify-center ${
                    e.type === "session"
                      ? "bg-primary/15 text-primary"
                      : e.type === "payment"
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(e.when)} · {e.sub}
                  </div>
                </div>
                {e.amount > 0 && (
                  <div
                    className={`font-semibold ${
                      e.delta === "+" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {e.delta}
                    {BDT(e.amount)}
                  </div>
                )}
              </div>
            );
          })}
          {(!data || data.length === 0) && (
            <div className="p-6 text-sm text-muted-foreground">No activity yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
