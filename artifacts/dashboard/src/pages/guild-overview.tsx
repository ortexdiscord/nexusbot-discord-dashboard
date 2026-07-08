import { useParams } from "wouter";
import { Layout } from "@/components/layout";
import { useGetGuildStats, useGetGuild, useGetBotStats, getGetGuildStatsQueryKey, getGetGuildQueryKey, getGetBotStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, ShieldAlert, Volume2, UserX, Clock, BarChart2, Terminal, MousePointer2, Users, Activity, Zap, Wifi } from "lucide-react";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | undefined; icon: React.ElementType; color: string }) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            {value === undefined ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-3xl font-bold mt-1">{value.toLocaleString()}</p>
            )}
          </div>
          <div className={`rounded-xl p-3 ${color}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GuildOverview() {
  const { guildId } = useParams<{ guildId: string }>();

  const { data: stats, isLoading: statsLoading } = useGetGuildStats(guildId!, {
    query: { enabled: !!guildId, queryKey: getGetGuildStatsQueryKey(guildId!) }
  });

  const { data: guild } = useGetGuild(guildId!, {
    query: { enabled: !!guildId, queryKey: getGetGuildQueryKey(guildId!) }
  });

  const { data: botStats } = useGetBotStats({
    query: { queryKey: getGetBotStatsQueryKey() }
  });

  const guildStats = [
    { label: "Total Warnings", value: stats?.totalWarnings, icon: Shield, color: "bg-yellow-500/10 text-yellow-400" },
    { label: "Total Bans", value: stats?.totalBans, icon: ShieldAlert, color: "bg-red-500/10 text-red-400" },
    { label: "Total Mutes", value: stats?.totalMutes, icon: Volume2, color: "bg-orange-500/10 text-orange-400" },
    { label: "Total Kicks", value: stats?.totalKicks, icon: UserX, color: "bg-pink-500/10 text-pink-400" },
    { label: "Active Reminders", value: stats?.activeReminders, icon: Clock, color: "bg-blue-500/10 text-blue-400" },
    { label: "Active Polls", value: stats?.activePolls, icon: BarChart2, color: "bg-green-500/10 text-green-400" },
    { label: "Custom Commands", value: stats?.customCommands, icon: Terminal, color: "bg-violet-500/10 text-violet-400" },
    { label: "Reaction Roles", value: stats?.reactionRoles, icon: MousePointer2, color: "bg-indigo-500/10 text-indigo-400" },
  ];

  return (
    <Layout guildId={guildId}>
      <div className="p-6 space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            {guild?.icon ? (
              <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} className="size-10 rounded-xl" alt="" />
            ) : (
              <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold">
                {guild?.name?.[0] ?? "S"}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{guild?.name ?? <Skeleton className="h-7 w-40" />}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Users className="size-3.5" />
                {guild?.memberCount?.toLocaleString() ?? "—"} members
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Moderation Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {guildStats.map(s => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>
        </div>

        {botStats && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Bot Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Guilds" value={botStats.totalGuilds} icon={Activity} color="bg-primary/10 text-primary" />
              <StatCard label="Total Users" value={botStats.totalUsers} icon={Users} color="bg-cyan-500/10 text-cyan-400" />
              <StatCard label="Commands Run" value={botStats.totalCommands} icon={Zap} color="bg-amber-500/10 text-amber-400" />
              <StatCard label="Ping (ms)" value={botStats.ping} icon={Wifi} color="bg-emerald-500/10 text-emerald-400" />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
