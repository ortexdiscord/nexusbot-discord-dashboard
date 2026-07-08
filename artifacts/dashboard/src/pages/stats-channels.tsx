import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { ChannelPicker } from "@/components/channel-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Users, Bot, Zap, Clock, BarChart2 } from "lucide-react";
import { useDirtyState } from "@/hooks/use-dirty-state";
import { UnsavedChangesBadge } from "@/components/unsaved-changes-badge";

interface StatsChannelsConfig {
  guildId: string;
  enabled: boolean;
  membersChannelId: string | null;
  onlineChannelId: string | null;
  botsChannelId: string | null;
  boostsChannelId: string | null;
}

const STAT_TYPES = [
  {
    key: "membersChannelId" as const,
    label: "Members Channel",
    icon: Users,
    description: "Shows total member count",
    example: "👥 Members: 1,247",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    key: "onlineChannelId" as const,
    label: "Online Channel",
    icon: Zap,
    description: "Shows online member count (requires Server Members + Presence intents)",
    example: "🟢 Online: 342",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    key: "botsChannelId" as const,
    label: "Bots Channel",
    icon: Bot,
    description: "Shows number of bots in the server",
    example: "🤖 Bots: 12",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    key: "boostsChannelId" as const,
    label: "Boosts Channel",
    icon: Zap,
    description: "Shows server boost count",
    example: "✨ Boosts: 7",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
];

export default function StatsChannels() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading, isError, error } = useQuery<StatsChannelsConfig>({
    queryKey: ["stats-channels", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/stats-channels`);
      if (!res.ok) throw new Error(`Failed to load stats channels config (${res.status})`);
      return res.json();
    },
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: async (data: Partial<StatsChannelsConfig>) => {
      const res = await fetch(`/api/guilds/${guildId}/stats-channels`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Stats channels saved" });
      qc.invalidateQueries({ queryKey: ["stats-channels", guildId] });
      markSaved(snapshot);
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [membersChannelId, setMembersChannelId] = useState("");
  const [onlineChannelId, setOnlineChannelId] = useState("");
  const [botsChannelId, setBotsChannelId] = useState("");
  const [boostsChannelId, setBoostsChannelId] = useState("");

  const snapshot = {
    enabled, membersChannelId: membersChannelId || null, onlineChannelId: onlineChannelId || null,
    botsChannelId: botsChannelId || null, boostsChannelId: boostsChannelId || null,
  };
  const { isDirty, markSaved } = useDirtyState(snapshot);

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setMembersChannelId(config.membersChannelId ?? "");
      setOnlineChannelId(config.onlineChannelId ?? "");
      setBotsChannelId(config.botsChannelId ?? "");
      setBoostsChannelId(config.boostsChannelId ?? "");
      markSaved({
        enabled: config.enabled, membersChannelId: config.membersChannelId ?? null,
        onlineChannelId: config.onlineChannelId ?? null, botsChannelId: config.botsChannelId ?? null,
        boostsChannelId: config.boostsChannelId ?? null,
      });
    }
  }, [config]);

  const getChannel = (key: keyof StatsChannelsConfig) => {
    const map: Record<string, [string, (v: string) => void]> = {
      membersChannelId: [membersChannelId, setMembersChannelId],
      onlineChannelId: [onlineChannelId, setOnlineChannelId],
      botsChannelId: [botsChannelId, setBotsChannelId],
      boostsChannelId: [boostsChannelId, setBoostsChannelId],
    };
    return map[key as string] ?? ["", () => {}];
  };

  const handleSave = () => {
    mutation.mutate(snapshot);
  };

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Server Stats Channels</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Auto-maintained voice channels showing live server counts</p>
          </div>
          <div className="flex items-center gap-3">
            <UnsavedChangesBadge show={isDirty && !mutation.isPending} />
            <Button onClick={handleSave} disabled={mutation.isPending || isLoading || !isDirty} size="sm">
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load stats channels config</p>
            <p className="text-xs text-muted-foreground mt-1">{(error as Error)?.message}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Enable toggle */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart2 className="size-4 text-primary" />Stats Channels
                    </CardTitle>
                    <CardDescription>Bot updates selected voice channels with live counts every 10 minutes</CardDescription>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </CardHeader>
            </Card>

            {/* How it works */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
              <Clock className="size-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-300">How it works</p>
                <p className="text-blue-300/70 text-xs mt-1">
                  Create voice channels in your server (e.g. "Members: 0"), then select them here. The bot will rename them with live counts every 10 minutes to respect Discord's rate limits.
                  Voice channels appear as read-only to members — perfect for stats.
                </p>
              </div>
            </div>

            {/* Stat pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STAT_TYPES.map(stat => {
                const [val, setter] = getChannel(stat.key);
                return (
                  <Card key={stat.key} className="border-border/50 bg-card/50">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`rounded-lg p-2 ${stat.bg}`}>
                          <stat.icon className={`size-4 ${stat.color}`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{stat.label}</p>
                          <p className="text-xs text-muted-foreground">{stat.description}</p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#313338] border border-border/30 px-3 py-2 font-mono text-xs text-gray-300">
                        {stat.example}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Voice Channel</Label>
                        <ChannelPicker
                          value={val}
                          onChange={setter}
                          placeholder="Select voice channel"
                          filter={(ch: any) => ch.type === "voice"}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
