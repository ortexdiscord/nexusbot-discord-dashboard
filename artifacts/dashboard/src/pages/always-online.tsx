import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { ChannelPicker } from "@/components/channel-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Radio, Clock, Zap, RefreshCw, Activity, Wifi } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DiscordEmbedPreview } from "@/components/discord-embed-preview";
import { useDirtyState } from "@/hooks/use-dirty-state";
import { UnsavedChangesBadge } from "@/components/unsaved-changes-badge";

interface AlwaysOnlineConfig {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  intervalMinutes: number;
  message: string;
  embedEnabled: boolean;
  embedColor: string;
  embedTitle: string | null;
  embedDescription: string | null;
  lastSentAt: string | null;
}

async function fetchConfig(guildId: string): Promise<AlwaysOnlineConfig> {
  const res = await fetch(`/api/guilds/${guildId}/always-online`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function updateConfig(guildId: string, data: Partial<AlwaysOnlineConfig>): Promise<AlwaysOnlineConfig> {
  const res = await fetch(`/api/guilds/${guildId}/always-online`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update");
  return res.json();
}

export default function AlwaysOnlinePage() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["always-online", guildId],
    queryFn: () => fetchConfig(guildId!),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<AlwaysOnlineConfig>) => updateConfig(guildId!, data),
    onSuccess: () => {
      toast({ title: "Always Online saved" });
      qc.invalidateQueries({ queryKey: ["always-online", guildId] });
      markSaved(snapshot);
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [message, setMessage] = useState("Umbra Utilities is online and ready!");
  const [embedEnabled, setEmbedEnabled] = useState(false);
  const [embedColor, setEmbedColor] = useState("#7C3AED");
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedDescription, setEmbedDescription] = useState("");

  const snapshot = {
    enabled, channelId: channelId || null, intervalMinutes,
    message, embedEnabled, embedColor,
    embedTitle: embedTitle || null, embedDescription: embedDescription || null,
  };
  const { isDirty, markSaved } = useDirtyState(snapshot);

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setChannelId(config.channelId ?? "");
      setIntervalMinutes(config.intervalMinutes);
      setMessage(config.message);
      setEmbedEnabled(config.embedEnabled);
      setEmbedColor(config.embedColor);
      setEmbedTitle(config.embedTitle ?? "");
      setEmbedDescription(config.embedDescription ?? "");
      markSaved({
        enabled: config.enabled, channelId: config.channelId ?? null, intervalMinutes: config.intervalMinutes,
        message: config.message, embedEnabled: config.embedEnabled, embedColor: config.embedColor,
        embedTitle: config.embedTitle ?? null, embedDescription: config.embedDescription ?? null,
      });
    }
  }, [config]);

  const handleSave = () => {
    mutation.mutate(snapshot);
  };

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Always Online</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Keep the bot active with periodic messages</p>
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
        ) : (
          <div className="space-y-4">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Always Online</CardTitle>
                    <CardDescription>Post periodic status messages to stay active</CardDescription>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <ChannelPicker value={channelId} onChange={setChannelId} />
                </div>
                <div className="space-y-2">
                  <Label>Interval (minutes)</Label>
                  <Input type="number" value={intervalMinutes} onChange={e => setIntervalMinutes(Number(e.target.value))}
                    min={5} max={1440} placeholder="60" />
                  <p className="text-xs text-muted-foreground">Minimum 5 minutes. Sends a message every {intervalMinutes} minutes.</p>
                </div>
                <div className="space-y-2">
                  <Label>Status Message</Label>
                  <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
                    placeholder="NexusBot is online and ready!" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Send as Embed</p>
                    <p className="text-xs text-muted-foreground">Use styled embeds instead of plain text</p>
                  </div>
                  <Switch checked={embedEnabled} onCheckedChange={setEmbedEnabled} />
                </div>
                {embedEnabled && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label>Embed Color</Label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={embedColor} onChange={e => setEmbedColor(e.target.value)}
                          className="size-10 rounded cursor-pointer border border-border/50 bg-transparent" />
                        <Input value={embedColor} onChange={e => setEmbedColor(e.target.value)} className="font-mono" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Embed Title</Label>
                      <Input value={embedTitle} onChange={e => setEmbedTitle(e.target.value)} placeholder="NexusBot Status" />
                    </div>
                    <div className="space-y-2">
                      <Label>Embed Description</Label>
                      <Textarea value={embedDescription} onChange={e => setEmbedDescription(e.target.value)} rows={2}
                        placeholder="I'm online and monitoring the server..." />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
              <CardContent>
                {embedEnabled ? (
                  <DiscordEmbedPreview
                    color={embedColor}
                    title={embedTitle || undefined}
                    description={embedDescription || message}
                    authorName="NexusBot"
                    authorAvatar="https://cdn.discordapp.com/embed/avatars/0.png"
                    footer={`Repeats every ${intervalMinutes} min`}
                  />
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="" className="size-8 rounded-full" />
                      <div>
                        <p className="text-sm font-medium text-[#f2f3f5]">NexusBot</p>
                        <p className="text-xs text-[#949ba4]">Today at {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                    <p className="text-sm text-[#dbdee1] pl-10">{message}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status summary */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5"><Radio className="size-5 text-primary" /></div>
                  <div>
                    <p className="text-sm font-medium">Channel messages</p>
                    <p className="text-xs text-muted-foreground">
                      {enabled ? `Posting every ${intervalMinutes} min to <#${channelId || "?"}>` : "Disabled — enable to start auto-posting"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* HTTP self-ping info */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-blue-500/10 p-2.5"><Wifi className="size-5 text-blue-400" /></div>
                  <div>
                    <CardTitle className="text-base">HTTP Self-Ping</CardTitle>
                    <CardDescription>Automatic — always active</CardDescription>
                  </div>
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">ON</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The server pings itself every <strong className="text-foreground">4 minutes</strong> via HTTP to prevent Replit from sleeping it. This runs automatically and requires no configuration.
                </p>
                <div className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                  GET /api/ping — every 240s
                </div>
              </CardContent>
            </Card>

            {/* Presence cycling info */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-purple-500/10 p-2.5"><Activity className="size-5 text-purple-400" /></div>
                  <div>
                    <CardTitle className="text-base">Presence Cycling</CardTitle>
                    <CardDescription>Rotates bot status every 20 min</CardDescription>
                  </div>
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">ON</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The bot cycles through different Discord statuses to signal it's alive and keep the connection active.
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {[
                    "👁️ Watching over your server",
                    "⚡ Playing with slash commands",
                    "🎧 Listening to your commands",
                    "🛡️ Watching for rule breakers",
                    "🚀 Playing Umbra Utilities v2",
                  ].map(s => (
                    <div key={s} className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1 rounded-md bg-muted/30">
                      <RefreshCw className="size-3 shrink-0 text-purple-400" />
                      {s}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reconnect watchdog info */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-yellow-500/10 p-2.5"><Zap className="size-5 text-yellow-400" /></div>
                  <div>
                    <CardTitle className="text-base">Reconnect Watchdog</CardTitle>
                    <CardDescription>Auto-reconnects on disconnect</CardDescription>
                  </div>
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">ON</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Discord.js automatically handles reconnection on shard drops. The watchdog logs disconnect and resume events so you can see if the bot had any connectivity issues.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
