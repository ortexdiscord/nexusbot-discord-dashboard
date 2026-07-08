import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, ShieldAlert, ShieldCheck, Terminal,
  TrendingUp, ChevronDown, ChevronUp, Lightbulb, AlertTriangle,
} from "lucide-react";

interface GraphPoint { day: string; count?: number; verified?: number; failed?: number; }
interface SummaryData {
  graphs: {
    joins: GraphPoint[];
    moderation: GraphPoint[];
    verification: GraphPoint[];
    commands: GraphPoint[];
  };
  totals: {
    memberCount: number;
    bans: number; kicks: number; warns: number;
    verifiedTotal: number;
    joinsLast7Days: number;
    modActionsLast30Days: number;
    commandsLast30Days: number;
  };
  recommendations: string[];
}

function fmt(day: string) {
  const d = new Date(day);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const CHART_STYLE = { fontSize: 11, fill: "#9ca3af" };

export default function Summary() {
  const { guildId } = useParams<{ guildId: string }>();
  const [showMore, setShowMore] = useState(false);

  const { data, isLoading } = useQuery<SummaryData>({
    queryKey: ["summary", guildId],
    queryFn: async () => {
      const r = await fetch(`/api/guilds/${guildId}/summary`);
      if (!r.ok) throw new Error("Failed to load summary");
      return r.json();
    },
    enabled: !!guildId,
    refetchInterval: 60_000,
  });

  const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) => (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-xl p-2.5" style={{ background: color + "20" }}>
          <Icon className="size-4" style={{ color }} />
        </div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2"><TrendingUp className="size-5 text-primary" />Summary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Server analytics and health overview</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            {[1,2].map(i => <Skeleton key={i} className="h-52 w-full rounded-xl" />)}
          </div>
        ) : data ? (
          <>
            {/* Recommendations */}
            {data.recommendations.length > 0 && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-yellow-400">
                    <Lightbulb className="size-4" />Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4 space-y-2">
                  {data.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-yellow-300/70">
                      <AlertTriangle className="size-3 mt-0.5 shrink-0 text-yellow-500" />{r}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Top stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Users} label="Members" value={data.totals.memberCount.toLocaleString()} color="#7c3aed" />
              <StatCard icon={TrendingUp} label="Joins (7d)" value={data.totals.joinsLast7Days} color="#22c55e" />
              <StatCard icon={ShieldAlert} label="Mod Actions (30d)" value={data.totals.modActionsLast30Days} color="#f59e0b" />
              <StatCard icon={Terminal} label="Commands (30d)" value={data.totals.commandsLast30Days} color="#60a5fa" />
            </div>

            {/* Joins graph */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="size-4 text-purple-400" />User Joins — Last 30 Days</CardTitle></CardHeader>
              <CardContent>
                {data.graphs.joins.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No join data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={data.graphs.joins.map(d => ({ ...d, day: fmt(d.day) }))}>
                      <defs>
                        <linearGradient id="joinsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                      <XAxis dataKey="day" tick={CHART_STYLE} axisLine={false} tickLine={false} />
                      <YAxis tick={CHART_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#1a0d2e", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="count" name="Joins" stroke="#7c3aed" fill="url(#joinsGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Moderation graph */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="size-4 text-yellow-400" />Moderation Actions — Last 30 Days</CardTitle></CardHeader>
              <CardContent>
                {data.graphs.moderation.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No moderation data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.graphs.moderation.map(d => ({ ...d, day: fmt(d.day) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                      <XAxis dataKey="day" tick={CHART_STYLE} axisLine={false} tickLine={false} />
                      <YAxis tick={CHART_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#1a0d2e", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" name="Actions" fill="#f59e0b" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Verification graph */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="size-4 text-green-400" />Verifications — Last 30 Days</CardTitle></CardHeader>
              <CardContent>
                {data.graphs.verification.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No verification data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.graphs.verification.map(d => ({ ...d, day: fmt(d.day) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                      <XAxis dataKey="day" tick={CHART_STYLE} axisLine={false} tickLine={false} />
                      <YAxis tick={CHART_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#1a0d2e", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="verified" name="Verified" fill="#22c55e" radius={[3,3,0,0]} stackId="a" />
                      <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[3,3,0,0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Commands graph */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Terminal className="size-4 text-blue-400" />Commands Used — Last 30 Days</CardTitle></CardHeader>
              <CardContent>
                {data.graphs.commands.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No command data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={data.graphs.commands.map(d => ({ ...d, day: fmt(d.day) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                      <XAxis dataKey="day" tick={CHART_STYLE} axisLine={false} tickLine={false} />
                      <YAxis tick={CHART_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#1a0d2e", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="count" name="Commands" stroke="#60a5fa" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Show more — extra stats as numbers */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <button
                  className="flex items-center justify-between w-full"
                  onClick={() => setShowMore(v => !v)}
                >
                  <CardTitle className="text-sm">All-Time Statistics</CardTitle>
                  {showMore ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                </button>
              </CardHeader>
              {showMore && (
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Total Bans", value: data.totals.bans, color: "#ef4444" },
                      { label: "Total Kicks", value: data.totals.kicks, color: "#f97316" },
                      { label: "Total Warns", value: data.totals.warns, color: "#f59e0b" },
                      { label: "Total Verified", value: data.totals.verifiedTotal, color: "#22c55e" },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl border border-border/30 bg-background/40 p-3 text-center">
                        <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-16">Failed to load summary data.</p>
        )}
      </div>
    </Layout>
  );
}
