"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { BDT, formatDateTime } from "@/lib/format";
import { Cigarette, Wallet, AlertCircle, Users, Activity, TrendingUp } from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();

      const [sessions, payments, members, participants, logs] = await Promise.all([
        supabase.from("smoking_sessions").select("*").order("created_at", { ascending: false }),
        supabase.from("payments").select("*"),
        supabase.from("members").select("*"),
        supabase.from("session_participants").select("*"),
        supabase
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const allSessions = sessions.data ?? [];
      const allPayments = payments.data ?? [];
      const allMembers = members.data ?? [];
      const allParts = participants.data ?? [];

      const todaySessions = allSessions.filter((s) => s.created_at >= iso);
      const cigsToday = todaySessions.reduce((sum, s) => sum + (s.quantity ?? 1), 0);
      const totalDueGross = allParts.reduce((s, p) => s + Number(p.share_amount), 0);
      const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount), 0);
      const totalDue = Math.max(0, totalDueGross - totalPaid);
      const activeMemberIds = new Set(allParts.map((p) => p.member_id));

      // 7 day chart
      const days: { date: string; collected: number; consumed: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        const label = d.toLocaleDateString("en-GB", { weekday: "short" });
        const collected = allPayments
          .filter((p) => p.created_at >= d.toISOString() && p.created_at < next.toISOString())
          .reduce((s, p) => s + Number(p.amount), 0);
        const consumed = allSessions
          .filter((s) => s.created_at >= d.toISOString() && s.created_at < next.toISOString())
          .reduce((s, x) => s + Number(x.total_cost), 0);
        days.push({ date: label, collected, consumed });
      }

      return {
        cigsToday,
        totalCollection: totalPaid,
        totalDue,
        totalSessions: allSessions.length,
        activeMembers: activeMemberIds.size,
        totalMembers: allMembers.length,
        chart: days,
        logs: logs.data ?? [],
      };
    },
  });

  const stats = [
    {
      label: "Cigarettes today",
      value: data?.cigsToday ?? 0,
      icon: Cigarette,
      hint: "Total smoked in sessions today",
    },
    {
      label: "Total collection",
      value: BDT(data?.totalCollection ?? 0),
      icon: Wallet,
      hint: "All payments received",
      accent: true,
    },
    {
      label: "Total due",
      value: BDT(data?.totalDue ?? 0),
      icon: AlertCircle,
      hint: "Outstanding from members",
      warn: true,
    },
    {
      label: "Sessions",
      value: data?.totalSessions ?? 0,
      icon: Activity,
      hint: "All-time sessions",
    },
    {
      label: "Active members",
      value: `${data?.activeMembers ?? 0}/${data?.totalMembers ?? 0}`,
      icon: Users,
      hint: "Members in any session",
    },
  ];

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle="Today at a glance"
        actions={
          <Link
            href="/sessions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-ember text-primary-foreground text-sm font-medium shadow-glow"
          >
            <Cigarette className="size-4" /> New session
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((s) => (
          <Card
            key={s.label}
            className={`p-5 bg-surface border-border ${s.accent ? "ring-1 ring-primary/30" : ""}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
              <s.icon
                className={`size-4 ${
                  s.accent ? "text-primary" : s.warn ? "text-destructive" : "text-muted-foreground"
                }`}
              />
            </div>
            <div className={`text-2xl font-semibold ${s.accent ? "text-gradient-ember" : ""}`}>
              {s.value}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{s.hint}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 bg-surface border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">7-day activity</h3>
              <p className="text-xs text-muted-foreground">Collection vs consumption</p>
            </div>
            <TrendingUp className="size-4 text-primary" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chart ?? []}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.18 38)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 38)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.16 155)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.72 0.16 155)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.014 250)" />
                <XAxis dataKey="date" stroke="oklch(0.68 0.02 250)" fontSize={12} />
                <YAxis stroke="oklch(0.68 0.02 250)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.014 250)",
                    border: "1px solid oklch(0.28 0.014 250)",
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="consumed"
                  stroke="oklch(0.72 0.18 38)"
                  fill="url(#g1)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="collected"
                  stroke="oklch(0.72 0.16 155)"
                  fill="url(#g2)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 bg-surface border-border">
          <h3 className="font-semibold mb-1">Recent activity</h3>
          <p className="text-xs text-muted-foreground mb-4">Last 8 events</p>
          <div className="space-y-3">
            {(data?.logs ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
            {data?.logs?.map((l) => (
              <div key={l.id} className="flex items-start gap-3 text-sm">
                <div
                  className={`mt-1 size-2 rounded-full shrink-0 ${
                    l.type === "payment"
                      ? "bg-success"
                      : l.type === "session"
                        ? "bg-primary"
                        : "bg-muted-foreground"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{l.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(l.created_at)}
                  </div>
                </div>
                {l.amount && <div className="text-sm font-medium">{BDT(Number(l.amount))}</div>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
