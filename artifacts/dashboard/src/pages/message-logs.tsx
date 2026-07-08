import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelPicker } from "@/components/channel-picker";
import { ScrollText, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDirtyState } from "@/hooks/use-dirty-state";
import { UnsavedChangesBadge } from "@/components/unsaved-changes-badge";

interface LogConfig { guildId: string; enabled: boolean; logChannelId: string | null; logEdits: boolean; logDeletes: boolean; }
interface MessageLog { id: number; channelName: string; username: string; type: string; oldContent: string | null; newContent: string | null; createdAt: string; }

export default function MessageLogs() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery<LogConfig>({
    queryKey: ["msg-log-config", guildId],
    queryFn: async () => {
      const r = await fetch(`/api/guilds/${guildId}/message-logs/config`);
      return r.json();
    },
    enabled: !!guildId,
  });

  const { data: logs = [], isLoading: logsLoading, refetch } = useQuery<MessageLog[]>({
    queryKey: ["msg-logs", guildId],
    queryFn: async () => {
      const r = await fetch(`/api/guilds/${guildId}/message-logs?limit=100`);
      return r.json();
    },
    enabled: !!guildId,
    refetchInterval: 15_000,
  });

  const save = useMutation({
    mutationFn: async (data: Partial<LogConfig>) => {
      const r = await fetch(`/api/guilds/${guildId}/message-logs/config`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      return r.json();
    },
    onSuccess: () => { toast({ title: "Message Logs saved" }); qc.invalidateQueries({ queryKey: ["msg-log-config", guildId] }); markSaved(snapshot); },
  });

  const [enabled, setEnabled] = useState(false);
  const [logChannelId, setLogChannelId] = useState("");
  const [logEdits, setLogEdits] = useState(true);
  const [logDeletes, setLogDeletes] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "edit" | "delete">("all");

  const snapshot = { enabled, logChannelId: logChannelId || null, logEdits, logDeletes };
  const { isDirty, markSaved } = useDirtyState(snapshot);

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setLogChannelId(config.logChannelId ?? "");
      setLogEdits(config.logEdits);
      setLogDeletes(config.logDeletes);
      markSaved({ enabled: config.enabled, logChannelId: config.logChannelId ?? null, logEdits: config.logEdits, logDeletes: config.logDeletes });
    }
  }, [config]);

  const filtered = logs.filter(l => typeFilter === "all" || l.type === typeFilter);

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2"><ScrollText className="size-5 text-primary" />Message Logs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track edited and deleted messages</p>
          </div>
          <div className="flex items-center gap-3">
            <UnsavedChangesBadge show={isDirty && !save.isPending} />
            <Button size="sm" onClick={() => save.mutate(snapshot)} disabled={save.isPending || isLoading || !isDirty}>
              {save.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle className="text-base">Message Logging</CardTitle>
                  <CardDescription>Log edited and deleted messages to a channel</CardDescription></div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </CardHeader>
            {enabled && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Log Channel</Label>
                  <ChannelPicker value={logChannelId} onChange={setLogChannelId} />
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/30">
                  <div><p className="text-sm font-medium">Log Edits</p><p className="text-xs text-muted-foreground">Track when messages are edited</p></div>
                  <Switch checked={logEdits} onCheckedChange={setLogEdits} />
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Log Deletes</p><p className="text-xs text-muted-foreground">Track when messages are deleted</p></div>
                  <Switch checked={logDeletes} onCheckedChange={setLogDeletes} />
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Live log feed */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Logs</CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-border/50 text-xs">
                  {(["all","edit","delete"] as const).map(t => (
                    <button key={t} onClick={() => setTypeFilter(t)}
                      className={`px-3 py-1.5 transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => refetch()}><RefreshCw className="size-3.5" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No logs yet. Enable message logging and activity will appear here.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filtered.map(log => (
                  <div key={log.id} className="rounded-lg bg-background/50 border border-border/30 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      {log.type === "edit"
                        ? <Pencil className="size-3 text-yellow-400" />
                        : <Trash2 className="size-3 text-red-400" />}
                      <span className="font-medium text-white">{log.username}</span>
                      <span className="text-muted-foreground">in #{log.channelName}</span>
                      <Badge variant="outline" className={`ml-auto text-[10px] ${log.type === "edit" ? "border-yellow-500/30 text-yellow-400" : "border-red-500/30 text-red-400"}`}>
                        {log.type}
                      </Badge>
                      <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    {log.oldContent && (
                      <p className="text-xs text-red-400/80 line-through truncate">{log.oldContent}</p>
                    )}
                    {log.newContent && (
                      <p className="text-xs text-green-400/80 truncate">{log.newContent}</p>
                    )}
                    {log.type === "delete" && log.oldContent && (
                      <p className="text-xs text-muted-foreground truncate">{log.oldContent}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
