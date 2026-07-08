import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { ChannelPicker } from "@/components/channel-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Clock, MessageSquare, Image, Webhook, Plus, Trash2, Copy,
  Bot, Layers, MousePointerClick, ChevronDown, ChevronUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
const genId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

// ── Types ────────────────────────────────────────────────────────────────────

interface WebhookLog {
  id: number;
  channelId: string;
  message: string;
  embedEnabled: boolean;
  embedColor: string;
  embedTitle: string | null;
  embedDescription: string | null;
  imageUrl: string | null;
  sentAt: string;
  sentByUsername: string | null;
}

interface WebhookConfig {
  id: number;
  channelId: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface ExtraEmbed {
  id: string;
  color: string;
  title: string;
  description: string;
  imageUrl: string;
}

interface EmbedButton {
  id: string;
  label: string;
  style: "primary" | "secondary" | "danger";
  response: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const BUTTON_STYLE_COLORS: Record<string, string> = {
  primary: "#5865F2",
  secondary: "#4e5058",
  danger: "#ed4245",
};

const BUTTON_STYLE_LABELS: Record<string, string> = {
  primary: "Blurple",
  secondary: "Grey",
  danger: "Red",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function WebhookSender() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Send mode
  const [sendAs, setSendAs] = useState<"bot" | "webhook">("bot");
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>("");

  // Core message state
  const [channelId, setChannelId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Primary embed
  const [embedEnabled, setEmbedEnabled] = useState(false);
  const [embedColor, setEmbedColor] = useState("#7C3AED");
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedDescription, setEmbedDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Extra embeds
  const [extraEmbeds, setExtraEmbeds] = useState<ExtraEmbed[]>([]);

  // Buttons
  const [buttons, setButtons] = useState<EmbedButton[]>([]);

  // Webhook creation
  const [createOpen, setCreateOpen] = useState(false);
  const [whChannel, setWhChannel] = useState("");
  const [whName, setWhName] = useState("Umbra Utilities");
  const [creating, setCreating] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<WebhookLog[]>({
    queryKey: ["webhook-logs", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/webhook-sender`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });

  const { data: webhooks, isLoading: whLoading, refetch: refetchWebhooks } = useQuery<WebhookConfig[]>({
    queryKey: ["webhooks", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/webhooks`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/guilds/${guildId}/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "Webhook deleted" });
      refetchWebhooks();
    },
    onError: () => toast({ title: "Failed to delete webhook", variant: "destructive" }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!channelId && sendAs === "bot") {
      toast({ title: "Select a channel", variant: "destructive" }); return;
    }
    if (!message.trim() && !embedDescription.trim() && extraEmbeds.length === 0) {
      toast({ title: "Enter a message or add an embed", variant: "destructive" }); return;
    }
    if (sendAs === "webhook" && !selectedWebhookId) {
      toast({ title: "Select a webhook", variant: "destructive" }); return;
    }

    setSending(true);
    try {
      const body = {
        channelId,
        message: message || embedDescription,
        embedEnabled,
        embedColor, embedTitle: embedTitle || null,
        embedDescription: embedDescription || null,
        imageUrl: imageUrl || null,
        extraEmbeds: extraEmbeds.map(({ id: _id, ...e }) => e),
        buttons: buttons.map(b => ({
          customId: `disco_btn_${genId()}`,
          label: b.label,
          style: b.style,
          response: b.response,
        })),
        sendAs,
        webhookId: sendAs === "webhook" ? Number(selectedWebhookId) : undefined,
      };

      const res = await fetch(`/api/guilds/${guildId}/webhook-sender/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed");
      }
      toast({ title: "Message sent!" });
      setMessage(""); setEmbedTitle(""); setEmbedDescription(""); setImageUrl("");
      setExtraEmbeds([]); setButtons([]);
      refetchLogs();
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!whChannel) { toast({ title: "Select a channel", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: whChannel, name: whName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.webhookUrl) {
        await navigator.clipboard.writeText(data.webhookUrl).catch(() => {});
      }
      toast({ title: "Webhook created! URL copied." });
      setCreateOpen(false); setWhChannel(""); setWhName("Umbra Utilities");
      refetchWebhooks();
    } catch (e: any) {
      toast({ title: e.message || "Failed to create webhook", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const addExtraEmbed = () => {
    if (extraEmbeds.length >= 9) {
      toast({ title: "Maximum 10 embeds per message", variant: "destructive" }); return;
    }
    setExtraEmbeds(prev => [...prev, { id: genId(), color: "#5865F2", title: "", description: "", imageUrl: "" }]);
  };

  const removeExtraEmbed = (id: string) => setExtraEmbeds(prev => prev.filter(e => e.id !== id));
  const updateExtraEmbed = (id: string, patch: Partial<ExtraEmbed>) =>
    setExtraEmbeds(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));

  const addButton = () => {
    if (buttons.length >= 5) {
      toast({ title: "Maximum 5 buttons per message", variant: "destructive" }); return;
    }
    setButtons(prev => [...prev, { id: genId(), label: "Click me", style: "primary", response: "Thanks for clicking!" }]);
  };
  const removeButton = (id: string) => setButtons(prev => prev.filter(b => b.id !== id));
  const updateButton = (id: string, patch: Partial<EmbedButton>) =>
    setButtons(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Send className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Disco Hook</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Send rich messages, embeds, and buttons to any channel
            </p>
          </div>
        </div>

        <Tabs defaultValue="compose" className="space-y-4">
          <TabsList className="bg-card/50 border border-border/50">
            <TabsTrigger value="compose" className="gap-2">
              <MessageSquare className="size-3.5" />Compose
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Clock className="size-3.5" />History
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="size-3.5" />Webhooks
            </TabsTrigger>
          </TabsList>

          {/* ── Compose ── */}
          <TabsContent value="compose" className="mt-0">
            <div className="grid lg:grid-cols-2 gap-4 items-start">
              {/* Left: form */}
              <div className="space-y-4">
                {/* Send-As Toggle */}
                <Card className="border-border/50 bg-card/50">
                  <CardContent className="p-4 space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Send As</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSendAs("bot")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm transition-all ${sendAs === "bot" ? "border-primary/60 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"}`}
                      >
                        <Bot className="size-4" />Bot
                      </button>
                      <button
                        type="button"
                        onClick={() => setSendAs("webhook")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm transition-all ${sendAs === "webhook" ? "border-primary/60 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"}`}
                      >
                        <Webhook className="size-4" />Webhook
                      </button>
                    </div>

                    {sendAs === "webhook" ? (
                      <div className="space-y-2">
                        <Label className="text-xs">Select Webhook</Label>
                        {whLoading ? (
                          <Skeleton className="h-10 rounded-lg" />
                        ) : !webhooks?.length ? (
                          <p className="text-xs text-muted-foreground">
                            No webhooks yet — create one in the Webhooks tab.
                          </p>
                        ) : (
                          <Select value={selectedWebhookId} onValueChange={setSelectedWebhookId}>
                            <SelectTrigger className="border-border/50">
                              <SelectValue placeholder="Choose a webhook…" />
                            </SelectTrigger>
                            <SelectContent>
                              {webhooks.map(wh => (
                                <SelectItem key={wh.id} value={String(wh.id)}>
                                  {wh.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-xs">Target Channel</Label>
                        <ChannelPicker value={channelId} onChange={setChannelId} />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Message content */}
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Message Content</CardTitle>
                    <CardDescription>Plain-text message (optional if you have embeds)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="Hello, world! Supports **markdown** and :emoji:"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={3}
                      className="border-border/50 resize-none"
                    />
                  </CardContent>
                </Card>

                {/* Primary Embed */}
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Primary Embed</CardTitle>
                        <CardDescription>Rich embed below the message</CardDescription>
                      </div>
                      <Switch checked={embedEnabled} onCheckedChange={setEmbedEnabled} />
                    </div>
                  </CardHeader>
                  {embedEnabled && (
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <Label className="text-xs mb-1 block">Color</Label>
                          <input type="color" value={embedColor} onChange={e => setEmbedColor(e.target.value)}
                            className="size-9 rounded-lg border border-border/50 cursor-pointer bg-transparent p-0.5" />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs mb-1 block">Title</Label>
                          <Input placeholder="Embed title" value={embedTitle} onChange={e => setEmbedTitle(e.target.value)}
                            className="border-border/50" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Description</Label>
                        <Textarea placeholder="Embed body text…" value={embedDescription}
                          onChange={e => setEmbedDescription(e.target.value)} rows={3}
                          className="border-border/50 resize-none" />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Image URL (optional)</Label>
                        <Input placeholder="https://…" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                          className="border-border/50" />
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Extra Embeds */}
                {extraEmbeds.map((embed, idx) => (
                  <Card key={embed.id} className="border-border/50 bg-card/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Embed #{idx + 2}</CardTitle>
                        <button type="button" onClick={() => removeExtraEmbed(embed.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <Label className="text-xs mb-1 block">Color</Label>
                          <input type="color" value={embed.color}
                            onChange={e => updateExtraEmbed(embed.id, { color: e.target.value })}
                            className="size-9 rounded-lg border border-border/50 cursor-pointer bg-transparent p-0.5" />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs mb-1 block">Title</Label>
                          <Input placeholder="Embed title" value={embed.title}
                            onChange={e => updateExtraEmbed(embed.id, { title: e.target.value })}
                            className="border-border/50" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Description</Label>
                        <Textarea placeholder="Embed body text…" value={embed.description}
                          onChange={e => updateExtraEmbed(embed.id, { description: e.target.value })}
                          rows={2} className="border-border/50 resize-none" />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Image URL (optional)</Label>
                        <Input placeholder="https://…" value={embed.imageUrl}
                          onChange={e => updateExtraEmbed(embed.id, { imageUrl: e.target.value })}
                          className="border-border/50" />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Add Embed button */}
                <Button variant="outline" className="w-full gap-2 border-dashed" onClick={addExtraEmbed}
                  disabled={extraEmbeds.length >= 9}>
                  <Plus className="size-4" />
                  Add Another Embed
                </Button>

                {/* Buttons section */}
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <MousePointerClick className="size-4 text-primary" />
                          Buttons
                        </CardTitle>
                        <CardDescription>
                          Clicking a button shows a private (disappearing) response to the user
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {buttons.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No buttons yet — add one below
                      </p>
                    )}
                    {buttons.map((btn) => (
                      <div key={btn.id} className="p-3 rounded-xl border border-border/50 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Label className="text-xs mb-1 block">Button Label</Label>
                            <Input placeholder="Click me" value={btn.label}
                              onChange={e => updateButton(btn.id, { label: e.target.value })}
                              className="border-border/50" />
                          </div>
                          <div className="w-32">
                            <Label className="text-xs mb-1 block">Style</Label>
                            <Select value={btn.style} onValueChange={v => updateButton(btn.id, { style: v as any })}>
                              <SelectTrigger className="border-border/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(["primary", "secondary", "danger"] as const).map(s => (
                                  <SelectItem key={s} value={s}>
                                    <span className="flex items-center gap-2">
                                      <span className="size-2 rounded-full inline-block" style={{ background: BUTTON_STYLE_COLORS[s] }} />
                                      {BUTTON_STYLE_LABELS[s]}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <button type="button" onClick={() => removeButton(btn.id)}
                            className="self-end pb-0.5 text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">Ephemeral Response (shown only to the clicker)</Label>
                          <Input placeholder="Thanks for clicking! ✅" value={btn.response}
                            onChange={e => updateButton(btn.id, { response: e.target.value })}
                            className="border-border/50" />
                        </div>
                      </div>
                    ))}
                    {buttons.length < 5 && (
                      <Button variant="outline" className="w-full gap-2 border-dashed" size="sm" onClick={addButton}>
                        <Plus className="size-3.5" />
                        Add Button
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Button className="w-full gap-2" onClick={handleSend} disabled={sending}>
                  <Send className="size-4" />
                  {sending ? "Sending…" : "Send Message"}
                </Button>
              </div>

              {/* Right: preview */}
              <div className="space-y-3 sticky top-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
                  Preview
                </p>
                <div
                  className="rounded-xl p-4 min-h-[200px] space-y-2"
                  style={{ background: "#313338" }}
                >
                  {/* Bot avatar + name */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-9 rounded-full bg-primary/30 flex items-center justify-center shrink-0">
                      {sendAs === "webhook" ? <Webhook className="size-4 text-primary" /> : <Bot className="size-4 text-primary" />}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white">
                        {sendAs === "webhook"
                          ? (webhooks?.find(w => String(w.id) === selectedWebhookId)?.name ?? "Webhook")
                          : "Umbra Utilities"
                        }
                      </span>
                      <Badge variant="outline" className="ml-2 text-[10px] border-blue-500/40 text-blue-400 px-1 py-0">BOT</Badge>
                    </div>
                  </div>

                  {/* Message text */}
                  {message && (
                    <p className="text-sm text-[#dbdee1] whitespace-pre-wrap">{message}</p>
                  )}

                  {/* Primary embed preview */}
                  {embedEnabled && (
                    <div className="rounded-r-lg overflow-hidden" style={{ borderLeft: `4px solid ${embedColor}`, background: "#2b2d31" }}>
                      <div className="p-3 space-y-1">
                        {embedTitle && <p className="text-sm font-semibold text-white">{embedTitle}</p>}
                        {embedDescription && <p className="text-sm text-[#dbdee1]">{embedDescription}</p>}
                        {imageUrl && <img src={imageUrl} alt="" className="mt-2 rounded max-w-full max-h-48 object-contain" />}
                      </div>
                    </div>
                  )}

                  {/* Extra embeds preview */}
                  {extraEmbeds.map((embed, idx) => (
                    <div key={embed.id} className="rounded-r-lg overflow-hidden" style={{ borderLeft: `4px solid ${embed.color}`, background: "#2b2d31" }}>
                      <div className="p-3 space-y-1">
                        {embed.title && <p className="text-sm font-semibold text-white">{embed.title}</p>}
                        {embed.description && <p className="text-sm text-[#dbdee1]">{embed.description}</p>}
                        {embed.imageUrl && <img src={embed.imageUrl} alt="" className="mt-2 rounded max-w-full max-h-48 object-contain" />}
                        {!embed.title && !embed.description && (
                          <p className="text-sm text-[#6d6f78] italic">Embed #{idx + 2} (empty)</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Buttons preview */}
                  {buttons.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {buttons.map(btn => (
                        <button
                          key={btn.id}
                          type="button"
                          className="px-4 py-1.5 rounded text-sm font-medium text-white transition-opacity hover:opacity-80"
                          style={{ background: BUTTON_STYLE_COLORS[btn.style] }}
                        >
                          {btn.label || "Button"}
                        </button>
                      ))}
                    </div>
                  )}

                  {!message && !embedEnabled && extraEmbeds.length === 0 && buttons.length === 0 && (
                    <p className="text-sm text-[#6d6f78] italic text-center py-6">
                      Start typing to see a preview…
                    </p>
                  )}
                </div>

                {buttons.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    🔒 Buttons show an ephemeral (private, disappearing) reply to the user who clicks them
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── History ── */}
          <TabsContent value="history" className="mt-0 space-y-2">
            {logsLoading
              ? [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)
              : !logs?.length ? (
                <div className="text-center py-16 border border-dashed border-border/50 rounded-xl text-muted-foreground">
                  <Clock className="size-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No messages sent yet</p>
                </div>
              ) : logs.map(log => (
                <Card key={log.id} className="border-border/50 bg-card/50">
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {log.embedEnabled && (
                          <Badge variant="outline" className="border-primary/30 text-primary text-xs">Embed</Badge>
                        )}
                        {log.embedTitle && (
                          <span className="text-sm font-medium truncate">{log.embedTitle}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {log.embedDescription || log.message || "—"}
                      </p>
                      {log.sentByUsername && (
                        <p className="text-xs text-muted-foreground">by @{log.sentByUsername}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 text-right">
                      {new Date(log.sentAt).toLocaleDateString()}
                      <br />
                      {new Date(log.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </CardContent>
                </Card>
              ))
            }
          </TabsContent>

          {/* ── Webhooks ── */}
          <TabsContent value="webhooks" className="mt-0 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Saved Webhooks</h3>
                <p className="text-sm text-muted-foreground">Create and manage webhooks for custom sender names and avatars</p>
              </div>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" />Create Webhook
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Webhook</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div>
                      <Label>Channel</Label>
                      <ChannelPicker value={whChannel} onChange={setWhChannel} />
                    </div>
                    <div>
                      <Label>Webhook Name</Label>
                      <Input value={whName} onChange={e => setWhName(e.target.value)} className="mt-1" />
                    </div>
                    <Button className="w-full" onClick={handleCreateWebhook} disabled={creating}>
                      {creating ? "Creating…" : "Create & Copy URL"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {whLoading
              ? [1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)
              : !webhooks?.length ? (
                <div className="text-center py-12 border border-dashed border-border/50 rounded-xl text-muted-foreground">
                  <Webhook className="size-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No webhooks yet</p>
                  <p className="text-xs mt-1 opacity-60">Create one to send messages with a custom name and avatar</p>
                </div>
              ) : webhooks.map(wh => (
                <div key={wh.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Webhook className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{wh.name}</p>
                      <p className="text-xs text-muted-foreground">Created {new Date(wh.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => deleteWebhookMutation.mutate(wh.id)}
                    disabled={deleteWebhookMutation.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            }
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
