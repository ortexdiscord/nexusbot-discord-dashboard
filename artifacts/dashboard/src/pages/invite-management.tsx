import { useParams } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Trophy, Bot, Link2, HelpCircle } from "lucide-react";

interface InviteRecord {
  id: number;
  guildId: string;
  invitedUserId: string;
  invitedUsername: string;
  invitedAt: string;
  inviterUserId: string | null;
  inviterUsername: string | null;
  inviteCode: string | null;
  isBot: boolean;
  isOAuth: boolean;
}

interface LeaderboardEntry {
  inviterUserId: string;
  inviterUsername: string;
  inviteCount: number;
}

function useInvites(guildId: string) {
  return useQuery<InviteRecord[]>({
    queryKey: ["invite-management", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/invite-management`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });
}

function useLeaderboard(guildId: string) {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["invite-leaderboard", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/invite-management/leaderboard`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });
}

function InviterLabel({ record }: { record: InviteRecord }) {
  if (record.isBot) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Bot className="size-3.5" />
        Bot / OAuth2
      </span>
    );
  }
  if (record.isOAuth) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-blue-400">
        <Link2 className="size-3.5" />
        OAuth2 / Discovery
      </span>
    );
  }
  if (!record.inviterUserId) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <HelpCircle className="size-3.5" />
        Unknown
      </span>
    );
  }
  return (
    <span className="text-sm text-foreground font-medium">
      @{record.inviterUsername ?? record.inviterUserId}
    </span>
  );
}

export default function InviteManagement() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: invites, isLoading: invLoading } = useInvites(guildId!);
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboard(guildId!);

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UserPlus className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Invite Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track who invited each member to your server
            </p>
          </div>
        </div>

        <Tabs defaultValue="history" className="space-y-4">
          <TabsList className="bg-card/50 border border-border/50">
            <TabsTrigger value="history" className="gap-2">
              <UserPlus className="size-3.5" />Recent Joins
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2">
              <Trophy className="size-3.5" />Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* Recent Joins */}
          <TabsContent value="history" className="mt-0 space-y-2">
            {invLoading ? (
              [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)
            ) : !invites?.length ? (
              <div className="text-center py-16 border border-dashed border-border/50 rounded-xl text-muted-foreground">
                <UserPlus className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No join records yet</p>
                <p className="text-xs mt-1 opacity-60">
                  Records appear here once the bot tracks invite activity
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {invites.map(inv => (
                  <Card key={inv.id} className="border-border/50 bg-card/50">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                          {inv.invitedUsername.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">@{inv.invitedUsername}</p>
                            {inv.isBot && <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 gap-1"><Bot className="size-2.5" />Bot</Badge>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground">Invited by:</span>
                            <InviterLabel record={inv} />
                          </div>
                          {inv.inviteCode && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              Code: {inv.inviteCode}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 text-right">
                        {new Date(inv.invitedAt).toLocaleDateString()}
                        <br />
                        {new Date(inv.invitedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Leaderboard */}
          <TabsContent value="leaderboard" className="mt-0 space-y-2">
            {lbLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)
            ) : !leaderboard?.length ? (
              <div className="text-center py-16 border border-dashed border-border/50 rounded-xl text-muted-foreground">
                <Trophy className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No invite data yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div key={entry.inviterUserId} className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/50">
                    <div
                      className="size-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: i === 0 ? "rgba(245,196,0,0.2)" : i === 1 ? "rgba(192,192,192,0.15)" : i === 2 ? "rgba(205,127,50,0.15)" : "rgba(255,255,255,0.05)",
                        color: i === 0 ? "#f5c400" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "#888",
                      }}
                    >
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">@{entry.inviterUsername}</p>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                      {entry.inviteCount} invite{entry.inviteCount !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
