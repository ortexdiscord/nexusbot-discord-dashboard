import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useGetAutomodConfig, useUpdateAutomodConfig, getGetAutomodConfigQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Settings, X, Plus, Bot, Zap, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDirtyState } from "@/hooks/use-dirty-state";
import { UnsavedChangesBadge } from "@/components/unsaved-changes-badge";

interface AutomodEvent {
  id: number;
  userId: string;
  username: string;
  channelId: string;
  content: string;
  reason: string | null;
  score: number | null;
  action: string;
  createdAt: string;
}

export default function Automod() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useGetAutomodConfig(guildId!, {
    query: { enabled: !!guildId, queryKey: getGetAutomodConfigQueryKey(guildId!) }
  });

  const updateAutomod = useUpdateAutomodConfig();

  const [enabled, setEnabled] = useState(false);
  const [antiSpam, setAntiSpam] = useState(false);
  const [antiLinks, setAntiLinks] = useState(false);
  const [antiProfanity, setAntiProfanity] = useState(false);
  const [maxMentions, setMaxMentions] = useState(5);
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [allowedLinks, setAllowedLinks] = useState<string[]>([]);
  const [newWord, setNewWord] = useState("");
  const [newLink, setNewLink] = useState("");
  const [aiAutomodEnabled, setAiAutomodEnabled] = useState(false);
  const [aiAutomodSensitivity, setAiAutomodSensitivity] = useState("medium");
  const [aiAutomodAction, setAiAutomodAction] = useState("delete");

  // Log section
  const [showLog, setShowLog] = useState(false);
  const [logEvents, setLogEvents] = useState<AutomodEvent[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const snapshot = {
    enabled, antiSpam, antiLinks, antiProfanity, maxMentions, bannedWords, allowedLinks,
    aiAutomodEnabled, aiAutomodSensitivity, aiAutomodAction,
  };
  const { isDirty, markSaved } = useDirtyState(snapshot);

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setAntiSpam(config.antiSpam);
      setAntiLinks(config.antiLinks);
      setAntiProfanity(config.antiProfanity);
      setMaxMentions(config.maxMentions);
      setBannedWords(config.bannedWords ?? []);
      setAllowedLinks(config.allowedLinks ?? []);
      setAiAutomodEnabled(config.aiAutomodEnabled ?? false);
      setAiAutomodSensitivity(config.aiAutomodSensitivity ?? "medium");
      setAiAutomodAction(config.aiAutomodAction ?? "delete");
      markSaved({
        enabled: config.enabled, antiSpam: config.antiSpam, antiLinks: config.antiLinks,
        antiProfanity: config.antiProfanity, maxMentions: config.maxMentions,
        bannedWords: config.bannedWords ?? [], allowedLinks: config.allowedLinks ?? [],
        aiAutomodEnabled: config.aiAutomodEnabled ?? false,
        aiAutomodSensitivity: config.aiAutomodSensitivity ?? "medium",
        aiAutomodAction: config.aiAutomodAction ?? "delete",
      });
    }
  }, [config]);

  const fetchLog = async () => {
    if (!guildId) return;
    setLogLoading(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/automod/events`);
      const data = await res.json();
      setLogEvents(Array.isArray(data) ? data : []);
    } catch { setLogEvents([]); } finally { setLogLoading(false); }
  };

  useEffect(() => {
    if (showLog) fetchLog();
  }, [showLog]);

  const handleSave = () => {
    updateAutomod.mutate({
      guildId: guildId!,
      data: snapshot as any
    }, {
      onSuccess: () => {
        toast({ title: "Automod updated" });
        qc.invalidateQueries({ queryKey: getGetAutomodConfigQueryKey(guildId!) });
        markSaved(snapshot);
      }
    });
  };

  const addWord = () => {
    if (newWord.trim() && !bannedWords.includes(newWord.trim())) {
      setBannedWords(prev => [...prev, newWord.trim()]);
      setNewWord("");
    }
  };

  const addLink = () => {
    if (newLink.trim() && !allowedLinks.includes(newLink.trim())) {
      setAllowedLinks(prev => [...prev, newLink.trim()]);
      setNewLink("");
    }
  };

  return (
    <Layout guildId={guildId}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Automod</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Configure automatic moderation rules</p>
          </div>
          <div className="flex items-center gap-3">
            <UnsavedChangesBadge show={isDirty && !updateAutomod.isPending} />
            <Button onClick={handleSave} disabled={updateAutomod.isPending || isLoading || !isDirty} data-testid="button-save-automod">
              {updateAutomod.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : (
          <div className="space-y-4">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Automod Enabled</CardTitle>
                    <CardDescription>Master toggle for all automod features</CardDescription>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} data-testid="switch-enabled" />
                </div>
              </CardHeader>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-base">Protection Modules</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Anti-Spam", desc: "Detect and prevent message spam", value: antiSpam, onChange: setAntiSpam, testId: "switch-anti-spam" },
                  { label: "Anti-Links", desc: "Block unauthorized links", value: antiLinks, onChange: setAntiLinks, testId: "switch-anti-links" },
                  { label: "Anti-Profanity", desc: "Filter profanity and banned words", value: antiProfanity, onChange: setAntiProfanity, testId: "switch-anti-profanity" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={item.value} onCheckedChange={item.onChange} data-testid={item.testId} />
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-sm font-medium">Max Mentions</p>
                    <p className="text-xs text-muted-foreground">Max @mentions per message</p>
                  </div>
                  <Input type="number" value={maxMentions} onChange={e => setMaxMentions(Number(e.target.value))} className="w-20 text-center" min={1} max={50} data-testid="input-max-mentions" />
                </div>
              </CardContent>
            </Card>

            {/* AI Automod */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bot className="size-4 text-primary" />AI Automod
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Gemini</Badge>
                    </CardTitle>
                    <CardDescription>Use AI to detect toxic, harmful, or inappropriate content</CardDescription>
                  </div>
                  <Switch checked={aiAutomodEnabled} onCheckedChange={setAiAutomodEnabled} />
                </div>
              </CardHeader>
              {aiAutomodEnabled && (
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs text-purple-300/70">
                    Requires <code className="font-mono bg-white/10 px-1 rounded">GEMINI_API_KEY</code> or <code className="font-mono bg-white/10 px-1 rounded">OPENROUTER_API_KEY</code> environment variable. The AI analyzes each message and removes harmful content automatically.
                  </div>
                  <div className="space-y-2">
                    <Label>Sensitivity</Label>
                    <div className="flex rounded-lg overflow-hidden border border-border/50 text-sm">
                      {(["low","medium","high"] as const).map(s => (
                        <button key={s} onClick={() => setAiAutomodSensitivity(s)}
                          className={`flex-1 px-3 py-2 transition-colors capitalize ${aiAutomodSensitivity === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {aiAutomodSensitivity === "low" ? "Only flag extremely toxic content (score ≥ 70%)" :
                       aiAutomodSensitivity === "high" ? "Flag mildly harmful content (score ≥ 30%) — may produce false positives" :
                       "Balanced detection (score ≥ 50%) — recommended for most servers"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Action</Label>
                    <div className="flex rounded-lg overflow-hidden border border-border/50 text-sm">
                      {(["delete","warn","mute"] as const).map(a => (
                        <button key={a} onClick={() => setAiAutomodAction(a)}
                          className={`flex-1 px-3 py-2 transition-colors capitalize ${aiAutomodAction === a ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}>
                          {a}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {aiAutomodAction === "delete" ? "Silently delete the flagged message" :
                       aiAutomodAction === "warn" ? "Delete message and DM the user a warning" :
                       "Delete message and DM the user (mute must be handled manually)"}
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-base">Banned Words</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Add a banned word..." value={newWord} onChange={e => setNewWord(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addWord()} data-testid="input-banned-word" />
                  <Button variant="outline" size="icon" onClick={addWord} data-testid="button-add-word"><Plus className="size-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bannedWords.map(word => (
                    <Badge key={word} variant="outline" className="border-red-500/30 text-red-400 gap-1" data-testid={`badge-word-${word}`}>
                      {word}
                      <button onClick={() => setBannedWords(prev => prev.filter(w => w !== word))} className="hover:text-red-300">
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  {bannedWords.length === 0 && <p className="text-xs text-muted-foreground">No banned words added</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-base">Allowed Links</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="e.g. discord.com" value={newLink} onChange={e => setNewLink(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addLink()} data-testid="input-allowed-link" />
                  <Button variant="outline" size="icon" onClick={addLink} data-testid="button-add-link"><Plus className="size-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allowedLinks.map(link => (
                    <Badge key={link} variant="outline" className="border-green-500/30 text-green-400 gap-1" data-testid={`badge-link-${link}`}>
                      {link}
                      <button onClick={() => setAllowedLinks(prev => prev.filter(l => l !== link))}>
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  {allowedLinks.length === 0 && <p className="text-xs text-muted-foreground">No allowed links added</p>}
                </div>
              </CardContent>
            </Card>

            {/* AI Automod Action Log */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="size-4 text-yellow-400" />
                      AI Action Log
                    </CardTitle>
                    <CardDescription>Recent messages flagged and removed by AI Automod</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {showLog && (
                      <Button variant="ghost" size="icon" className="size-7" onClick={fetchLog} disabled={logLoading}>
                        <RefreshCw className={`size-3.5 ${logLoading ? "animate-spin" : ""}`} />
                      </Button>
                    )}
                    <Switch checked={showLog} onCheckedChange={setShowLog} />
                  </div>
                </div>
              </CardHeader>
              {showLog && (
                <CardContent>
                  {logLoading ? (
                    <div className="space-y-2">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                    </div>
                  ) : !logEvents.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="size-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No AI automod events recorded yet.</p>
                      <p className="text-xs mt-1 opacity-60">Events will appear here when AI Automod flags messages.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {logEvents.map(e => (
                        <div key={e.id} className="rounded-lg border border-border/30 bg-background/30 px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-white">@{e.username}</span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                                  e.action === "delete" ? "border-yellow-500/30 text-yellow-400" :
                                  e.action === "warn" ? "border-orange-500/30 text-orange-400" :
                                  "border-red-500/30 text-red-400"
                                }`}>
                                  {e.action}
                                </Badge>
                                {e.score !== null && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {Math.round((e.score ?? 0) * 100)}% harmful
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.reason ?? "Flagged content"}</p>
                              <p className="text-xs text-white/30 mt-0.5 line-clamp-1 italic">"{e.content}"</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(e.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
