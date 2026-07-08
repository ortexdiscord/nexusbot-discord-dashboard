import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InviteDialog } from "@/components/invite-dialog";
import {
  ExternalLink, Server, Users, Bot, CheckCircle2,
  LogOut, Crown, LayoutDashboard, ShieldCheck, Zap,
} from "lucide-react";

// ── API types ────────────────────────────────────────────────────────────────

interface BotInfo {
  id: string;
  username: string;
  tag: string;
  avatar: string | null;
  guildCount: number;
  inviteUrl: string;
  guilds: Array<{ id: string; name: string; icon: string | null; memberCount: number }>;
}

interface Visitor {
  id: string;
  username: string;
  avatar: string | null;
  globalName: string | null;
}

interface MatchedGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  hasManageGuild: boolean;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

function useBotInfo() {
  return useQuery<BotInfo>({
    queryKey: ["bot-info"],
    queryFn: async () => {
      const res = await fetch("/api/bot");
      if (!res.ok) throw new Error("Failed to fetch bot info");
      return res.json();
    },
    staleTime: 30_000,
  });
}

function useVisitor() {
  return useQuery<Visitor | null>({
    queryKey: ["visitor"],
    queryFn: async () => {
      const res = await fetch("/api/auth/visitor");
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
}

function useMatchedGuilds(enabled: boolean) {
  return useQuery<MatchedGuild[]>({
    queryKey: ["me-guilds"],
    queryFn: async () => {
      const res = await fetch("/api/me/guilds");
      if (!res.ok) throw new Error("Failed to fetch guilds");
      return res.json();
    },
    enabled,
    staleTime: 60_000,
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BotInfoPage() {
  const qc = useQueryClient();
  const { data: bot, isLoading: botLoading } = useBotInfo();
  const { data: visitor, isLoading: visitorLoading } = useVisitor();
  const [inviteType, setInviteType] = useState<"full" | "min" | null>(null);

  const isConnected = visitor != null;
  const { data: matchedGuilds, isLoading: guildsLoading } = useMatchedGuilds(isConnected);

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/visitor/logout", { method: "POST" });
    },
    onSuccess: () => {
      qc.setQueryData(["visitor"], null);
      qc.setQueryData(["me-guilds"], []);
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded bg-primary/20 flex items-center justify-center">
            <Bot className="size-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Umbra Utilities</span>
        </div>
        <a href="/guilds">
          <Button variant="outline" size="sm">Dashboard</Button>
        </a>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-xl space-y-8">

          {/* Bot card */}
          <div className="flex flex-col items-center gap-4 text-center">
            {botLoading ? (
              <Skeleton className="size-28 rounded-full" />
            ) : bot?.avatar ? (
              <img
                src={bot.avatar}
                alt={bot.username}
                className="size-28 rounded-full border-4 border-primary/30 shadow-xl shadow-primary/10"
              />
            ) : (
              <div className="size-28 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/30">
                <Bot className="size-14 text-primary" />
              </div>
            )}
            {botLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-40 mx-auto" />
                <Skeleton className="h-4 w-28 mx-auto" />
              </div>
            ) : (
              <>
                <div>
                  <h1 className="text-3xl font-bold">{bot?.username ?? "Umbra Utilities"}</h1>
                  <p className="text-muted-foreground text-sm mt-1">{bot?.tag}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <Badge variant="outline" className="border-green-500/40 text-green-400 gap-1.5">
                    <CheckCircle2 className="size-3" />Online
                  </Badge>
                  <Badge variant="outline" className="border-border/50 text-muted-foreground gap-1.5">
                    <Server className="size-3" />{bot?.guildCount ?? 0} servers
                  </Badge>
                </div>
              </>
            )}
          </div>

          {/* Add to server CTA */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Add Umbra Utilities to your Discord server and get access to moderation, reaction roles,
              level roles, welcome messages, invite tracking, tickets, giveaways, and more.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full permissions */}
              <Button
                size="lg"
                className="gap-2 shadow-lg shadow-primary/20 w-full"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                onClick={() => setInviteType("full")}
              >
                <Zap className="size-4" />
                Full Permissions
              </Button>

              {/* Bare minimum */}
              <div className="flex flex-col items-center gap-1.5">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 w-full border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300"
                  onClick={() => setInviteType("min")}
                >
                  <ShieldCheck className="size-4" />
                  Bare Minimum
                </Button>
                <p className="text-[11px] text-muted-foreground/60 text-center leading-snug px-1">
                  Tickets, webhooks &amp; invite tracking won't work
                </p>
              </div>
            </div>
          </div>

          <Separator className="border-border/30" />

          {/* Connect with Discord / personalised section */}
          {visitorLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : !isConnected ? (
            /* ── Not connected ── */
            <div className="rounded-2xl border border-border/40 bg-card/50 p-6 text-center space-y-4">
              <div className="space-y-1">
                <p className="font-medium text-sm">Check your servers</p>
                <p className="text-xs text-muted-foreground">
                  Connect with Discord to see which of your servers have Umbra Utilities
                  and open their dashboards directly.
                </p>
              </div>
            </div>
          ) : (
            /* ── Connected — personalised view ── */
            <div className="space-y-4">
              {/* Visitor header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {visitor.avatar ? (
                    <img
                      src={`https://cdn.discordapp.com/avatars/${visitor.id}/${visitor.avatar}.png?size=32`}
                      alt={visitor.username}
                      className="size-8 rounded-full"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-[#5865F2]">
                        {visitor.username.slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium leading-none">
                      {visitor.globalName ?? visitor.username}
                    </p>
                    <p className="text-xs text-muted-foreground">@{visitor.username}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground gap-1.5"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  <LogOut className="size-3.5" />
                  Disconnect
                </Button>
              </div>

              {/* Matched guilds */}
              {guildsLoading ? (
                <div className="space-y-2.5">
                  {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
              ) : !matchedGuilds?.length ? (
                <div className="rounded-xl border border-border/30 bg-card/30 p-6 text-center text-sm text-muted-foreground">
                  <Server className="size-8 mx-auto mb-2 opacity-30" />
                  None of your servers have NexusBot yet.
                  <br />
                  <a href={bot?.inviteUrl} target="_blank" rel="noopener noreferrer"
                    className="text-primary underline-offset-4 hover:underline mt-1 inline-block">
                    Add it to a server
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">
                    Your servers with NexusBot
                  </p>
                  {matchedGuilds.map(g => (
                    <div
                      key={g.id}
                      className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 px-4 py-3 hover:bg-card/80 transition-colors"
                    >
                      {g.icon ? (
                        <img src={g.icon} alt={g.name} className="size-10 rounded-full flex-shrink-0" />
                      ) : (
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-primary">
                            {g.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{g.name}</p>
                          {g.hasManageGuild && (
                            <Crown className="size-3 text-yellow-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="size-3" />
                          {g.memberCount.toLocaleString()} members
                        </p>
                      </div>
                      {g.hasManageGuild && (
                        <a href={`/guilds/${g.id}`}>
                          <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0">
                            <LayoutDashboard className="size-3.5" />
                            Manage
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border/40 px-6 py-4 text-center text-xs text-muted-foreground">
        NexusBot &mdash; Discord Utility Bot
      </footer>

      <InviteDialog
        open={inviteType !== null}
        onClose={() => setInviteType(null)}
        type={inviteType}
      />
    </div>
  );
}
