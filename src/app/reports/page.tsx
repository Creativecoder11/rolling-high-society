"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BDT } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Printer } from "lucide-react";
import { toast } from "sonner";

function inRange(iso: string, days: number) {
  const now = Date.now();
  return now - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000;
}

export default function ReportsPage() {
  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [m, sp, pay, sess] = await Promise.all([
        supabase.from("members").select("id, name"),
        supabase.from("session_participants").select("*"),
        supabase.from("payments").select("*"),
        supabase.from("smoking_sessions").select("*"),
      ]);
      const names = new Map<string, string>((m.data ?? []).map((mm: any) => [mm.id, mm.name]));

      const due = new Map<string, number>();
      const paid = new Map<string, number>();
      const smoked = new Map<string, number>();
      sp.data?.forEach((p: any) => {
        due.set(p.member_id, (due.get(p.member_id) ?? 0) + Number(p.share_amount));
        smoked.set(p.member_id, (smoked.get(p.member_id) ?? 0) + 1);
      });
      pay.data?.forEach((p: any) => {
        paid.set(p.member_id, (paid.get(p.member_id) ?? 0) + Number(p.amount));
      });

      const memberRows = Array.from(names.entries()).map(([id, name]) => ({
        id,
        name,
        due: Math.max(0, (due.get(id) ?? 0) - (paid.get(id) ?? 0)),
        paid: paid.get(id) ?? 0,
        sessions: smoked.get(id) ?? 0,
      }));

      const topDue = [...memberRows].sort((a, b) => b.due - a.due).slice(0, 5);
      const topSmokers = [...memberRows].sort((a, b) => b.sessions - a.sessions).slice(0, 5);

      const range = (days: number) => {
        const s = (sess.data ?? []).filter((x: any) => inRange(x.created_at, days));
        const p = (pay.data ?? []).filter((x: any) => inRange(x.created_at, days));
        return {
          sessions: s.length,
          spent: s.reduce((a: number, b: any) => a + Number(b.total_cost), 0),
          collected: p.reduce((a: number, b: any) => a + Number(b.amount), 0),
        };
      };

      return {
        daily: range(1),
        weekly: range(7),
        monthly: range(30),
        topDue,
        topSmokers,
        totalDue: memberRows.reduce((a, b) => a + b.due, 0),
        totalPaid: memberRows.reduce((a, b) => a + b.paid, 0),
      };
    },
  });

  function printPdf() {
    toast.info("Use the system dialog to save as PDF");
    setTimeout(() => window.print(), 200);
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto">
      <PageHeader
        title="Reports"
        subtitle="Daily, weekly and monthly summaries"
        actions={
          <div className="flex gap-2 no-print">
            <Button onClick={printPdf} className="gradient-ember text-primary-foreground">
              <Printer className="size-4" /> Export PDF
            </Button>
          </div>
        }
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Today", v: data?.daily },
          { label: "This week", v: data?.weekly },
          { label: "This month", v: data?.monthly },
        ].map((r) => (
          <Card key={r.label} className="p-5 bg-surface border-border">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-muted-foreground">Sessions</div>
                <div className="font-semibold">{r.v?.sessions ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Spent</div>
                <div className="font-semibold">{BDT(r.v?.spent ?? 0)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Collected</div>
                <div className="font-semibold text-success">{BDT(r.v?.collected ?? 0)}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-surface border-border">
          <h3 className="font-semibold mb-1">Top due members</h3>
          <p className="text-xs text-muted-foreground mb-4">Members who owe most</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topDue ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.014 250)" />
                <XAxis dataKey="name" stroke="oklch(0.68 0.02 250)" fontSize={11} />
                <YAxis stroke="oklch(0.68 0.02 250)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.014 250)",
                    border: "1px solid oklch(0.28 0.014 250)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="due" fill="oklch(0.72 0.18 38)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 bg-surface border-border">
          <h3 className="font-semibold mb-1">Most active smokers</h3>
          <p className="text-xs text-muted-foreground mb-4">By session count</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topSmokers ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.014 250)" />
                <XAxis dataKey="name" stroke="oklch(0.68 0.02 250)" fontSize={11} />
                <YAxis stroke="oklch(0.68 0.02 250)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.014 250)",
                    border: "1px solid oklch(0.28 0.014 250)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="sessions" fill="oklch(0.72 0.16 155)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
