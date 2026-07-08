import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { RolePicker } from "@/components/role-picker";
import { ChannelPicker } from "@/components/channel-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Send, XCircle, Settings, Hash } from "lucide-react";

interface TicketSettings {
  id: number;
  guildId: string;
  enabled: boolean;
  panelChannelId: string | null;
  categoryId: string | null;
  supportRoleId: string | null;
  supportRoleName: string | null;
  logChannelId: string | null;
  panelTitle: string;
  panelDescription: string;
  panelColor: string;
  ticketMessage: string;
  maxOpenTickets: number;
  panelMessageId: string | null;
}

interface OpenTicket {
  id: number;
  guildId: string;
  channelId: string;
  userId: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
}

export default function TicketsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<TicketSettings | null>({
    queryKey: ["ticket-settings", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/tickets/settings`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });

  const { data: openTickets } = useQuery<OpenTicket[]>({
    queryKey: ["tickets-open", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/tickets/open`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });

  const [form, setForm] = useState({
    enabled: false,
    panelChannelId: "",
    categoryId: "",
    supportRoleId: "",
    supportRoleName: "",
    logChannelId: "",
    panelTitle: "Support Tickets",
    panelDescription: "Click the button below to open a support ticket.",
    panelColor: "#7C3AED",
    ticketMessage: "Thank you for opening a ticket. A staff member will be with you shortly.",
    maxOpenTickets: 1,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: settings.enabled,
        panelChannelId: settings.panelChannelId ?? "",
        categoryId: settings.categoryId ?? "",
        supportRoleId: settings.supportRoleId ?? "",
        supportRoleName: settings.supportRoleName ?? "",
        logChannelId: settings.logChannelId ?? "",
        panelTitle: settings.panelTitle,
        panelDescription: settings.panelDescription,
        panelColor: settings.panelColor,
        ticketMessage: settings.ticketMessage,
        maxOpenTickets: settings.maxOpenTickets,
      });
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/tickets/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, panelChannelId: form.panelChannelId || null, categoryId: form.categoryId || null, supportRoleId: form.supportRoleId || null, logChannelId: form.logChannelId || null }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-settings", guildId] });
      toast({ title: "Settings saved!" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const sendPanel = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/tickets/send-panel`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-settings", guildId] });
      toast({ title: "Panel sent to channel! ✅" });
    },
    onError: () => toast({ title: "Failed to send panel", variant: "destructive" }),
  });

  const closeTicket = useMutation({
    mutationFn: async (ticketId: number) => {
      const res = await fetch(`/api/guilds/${guildId}/tickets/open/${ticketId}/close`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets-open", guildId] });
      toast({ title: "Ticket closed" });
    },
    onError: () => toast({ title: "Failed to close ticket", variant: "destructive" }),
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Ticket System</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Let members open support tickets with a button click</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => sendPanel.mutate()} disabled={!form.panelChannelId || sendPanel.isPending}>
              <Send className="size-3.5 mr-1.5" />{sendPanel.isPending ? "Sending..." : "Send Panel"}
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Config */}
          <div className="space-y-4">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><Settings className="size-4" />Configuration</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{form.enabled ? "Enabled" : "Disabled"}</span>
                    <Switch checked={form.enabled} onCheckedChange={v => set("enabled", v)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <Label>Panel Channel</Label>
                    <ChannelPicker value={form.panelChannelId} onChange={v => set("panelChannelId", v)} placeholder="Where to send the panel" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ticket Category <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <ChannelPicker value={form.categoryId} onChange={v => set("categoryId", v)} placeholder="Category for ticket channels" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Support Role <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <RolePicker value={form.supportRoleId} onChange={v => set("supportRoleId", v)}
                      onChangeWithName={(id, name) => { set("supportRoleId", id); set("supportRoleName", name); }}
                      placeholder="Role to ping on new tickets" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Log Channel <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <ChannelPicker value={form.logChannelId} onChange={v => set("logChannelId", v)} placeholder="Log ticket events here" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max Open Tickets per User</Label>
                    <Input type="number" min={1} max={10} value={form.maxOpenTickets} onChange={e => set("maxOpenTickets", parseInt(e.target.value) || 1)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3"><CardTitle className="text-base">Panel Customization</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Panel Title</Label>
                  <Input value={form.panelTitle} onChange={e => set("panelTitle", e.target.value)} placeholder="Support Tickets" />
                </div>
                <div className="space-y-1.5">
                  <Label>Panel Description</Label>
                  <Textarea value={form.panelDescription} onChange={e => set("panelDescription", e.target.value)} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ticket Welcome Message</Label>
                  <Textarea value={form.ticketMessage} onChange={e => set("ticketMessage", e.target.value)} rows={2} />
                </div>
                <div className="flex items-center gap-3">
                  <Label>Embed Color</Label>
                  <input type="color" value={form.panelColor} onChange={e => set("panelColor", e.target.value)} className="w-10 h-8 rounded cursor-pointer border-0" />
                  <span className="text-xs text-muted-foreground font-mono">{form.panelColor}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview + Active Tickets */}
          <div className="space-y-4">
            {/* Panel preview */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3"><CardTitle className="text-base">Panel Preview</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-[#313338] rounded-xl p-4">
                  <div className="bg-[#2b2d31] rounded-lg p-4 border-l-4" style={{ borderColor: form.panelColor }}>
                    <p className="text-white font-bold text-sm">🎫 {form.panelTitle}</p>
                    <p className="text-gray-400 text-xs mt-1">{form.panelDescription}</p>
                    <div className="mt-3">
                      <button className="bg-primary text-white text-xs px-4 py-1.5 rounded-md font-medium">🎫 Open Ticket</button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active tickets */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Ticket className="size-4" />Active Tickets
                  {openTickets && openTickets.filter(t => t.status === "open").length > 0 && (
                    <Badge variant="outline" className="text-xs">{openTickets.filter(t => t.status === "open").length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!openTickets || openTickets.filter(t => t.status === "open").length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No open tickets</p>
                ) : (
                  <div className="space-y-2">
                    {openTickets.filter(t => t.status === "open").map(t => (
                      <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/30">
                        <div className="flex items-center gap-2">
                          <Hash className="size-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-xs font-medium">User {t.userId.slice(0, 8)}…</p>
                            <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                          onClick={() => closeTicket.mutate(t.id)}>
                          <XCircle className="size-3.5 mr-1" />Close
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
