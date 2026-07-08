import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelPicker } from "@/components/channel-picker";
import { RolePicker } from "@/components/role-picker";
import { ShieldCheck, Hash, Ticket, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDirtyState } from "@/hooks/use-dirty-state";
import { UnsavedChangesBadge } from "@/components/unsaved-changes-badge";

interface VerifConfig {
  guildId: string; enabled: boolean; type: string;
  verifiedRoleId: string | null; unverifiedRoleId: string | null;
  channelId: string | null; logChannelId: string | null;
  categoryId: string | null; welcomeMessage: string;
}
interface VerifLog { id: number; username: string; type: string; status: string; createdAt: string; }

export default function Verification() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery<VerifConfig>({
    queryKey: ["verification-config", guildId],
    queryFn: async () => { const r = await fetch(`/api/guilds/${guildId}/verification`); return r.json(); },
    enabled: !!guildId,
  });

  const { data: logs = [] } = useQuery<VerifLog[]>({
    queryKey: ["verification-logs", guildId],
    queryFn: async () => { const r = await fetch(`/api/guilds/${guildId}/verification/logs?limit=50`); return r.json(); },
    enabled: !!guildId,
    refetchInterval: 15_000,
  });

  const save = useMutation({
    mutationFn: async (data: Partial<VerifConfig>) => {
      const r = await fetch(`/api/guilds/${guildId}/verification`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      return r.json();
    },
    onSuccess: () => { toast({ title: "Verification saved" }); qc.invalidateQueries({ queryKey: ["verification-config", guildId] }); markSaved(snapshot); },
  });

  const [enabled, setEnabled] = useState(false);
  const [type, setType] = useState("captcha");
  const [verifiedRoleId, setVerifiedRoleId] = useState("");
  const [unverifiedRoleId, setUnverifiedRoleId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [logChannelId, setLogChannelId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("Please verify yourself to gain access!");

  const snapshot = {
    enabled, type, verifiedRoleId: verifiedRoleId || null, unverifiedRoleId: unverifiedRoleId || null,
    channelId: channelId || null, logChannelId: logChannelId || null, categoryId: categoryId || null, welcomeMessage,
  };
  const { isDirty, markSaved } = useDirtyState(snapshot);

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setType(config.type);
      setVerifiedRoleId(config.verifiedRoleId ?? "");
      setUnverifiedRoleId(config.unverifiedRoleId ?? "");
      setChannelId(config.channelId ?? "");
      setLogChannelId(config.logChannelId ?? "");
      setCategoryId(config.categoryId ?? "");
      setWelcomeMessage(config.welcomeMessage ?? "Please verify yourself to gain access!");
      markSaved({
        enabled: config.enabled, type: config.type, verifiedRoleId: config.verifiedRoleId ?? null,
        unverifiedRoleId: config.unverifiedRoleId ?? null, channelId: config.channelId ?? null,
        logChannelId: config.logChannelId ?? null, categoryId: config.categoryId ?? null,
        welcomeMessage: config.welcomeMessage ?? "Please verify yourself to gain access!",
      });
    }
  }, [config]);

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />Verification System</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Require members to verify before accessing the server</p>
          </div>
          <div className="flex items-center gap-3">
            <UnsavedChangesBadge show={isDirty && !save.isPending} />
            <Button size="sm" onClick={() => save.mutate(snapshot)} disabled={save.isPending || !isDirty}>
              {save.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
        ) : (
          <div className="space-y-4">
            {/* Master toggle */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle className="text-base">Verification Enabled</CardTitle>
                    <CardDescription>New members must verify before accessing channels</CardDescription></div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </CardHeader>
            </Card>

            {/* Type selector */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-base">Verification Type</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "captcha", icon: Hash, label: "Captcha", desc: "Solve a simple math question via DM or channel" },
                    { value: "ticket", icon: Ticket, label: "Ticket", desc: "Open a ticket — staff manually verifies the user" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setType(opt.value)}
                      className={`rounded-xl border p-4 text-left transition-all ${type === opt.value ? "border-primary bg-primary/10" : "border-border/30 bg-background/30 hover:bg-white/5"}`}
                    >
                      <opt.icon className={`size-5 mb-2 ${type === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                {type === "captcha" && (
                  <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300/80 space-y-1">
                    <p className="font-semibold">How Captcha Verification works:</p>
                    <p>When a new member joins, the bot sends them a simple math question in their DMs. They answer it in the verification channel. On success, the Verified role is granted and the verification category is hidden from them.</p>
                  </div>
                )}
                {type === "ticket" && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300/80 space-y-1">
                    <p className="font-semibold">How Ticket Verification works:</p>
                    <p>New members are prompted to open a verification ticket. Staff review and click a "Verify" button inside the ticket to grant the Verified role. The verification category is then hidden.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settings */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Verified Role <span className="text-muted-foreground text-xs">(assigned after passing)</span></Label>
                  <RolePicker value={verifiedRoleId} onChange={setVerifiedRoleId} placeholder="Select verified role" />
                </div>
                <div className="space-y-2">
                  <Label>Unverified Role <span className="text-muted-foreground text-xs">(assigned on join, removed after verify)</span></Label>
                  <RolePicker value={unverifiedRoleId} onChange={setUnverifiedRoleId} placeholder="Select unverified role (optional)" />
                </div>
                <div className="space-y-2">
                  <Label>Verification Channel</Label>
                  <ChannelPicker value={channelId} onChange={setChannelId} />
                </div>
                <div className="space-y-2">
                  <Label>Log Channel</Label>
                  <ChannelPicker value={logChannelId} onChange={setLogChannelId} />
                </div>
                <div className="space-y-2">
                  <Label>Category to Hide After Verification <span className="text-muted-foreground text-xs">(channel category ID)</span></Label>
                  <input
                    className="w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Category ID (right-click category → Copy ID)"
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Welcome / Prompt Message</Label>
                  <Textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} rows={2} placeholder="Please verify yourself to gain access!" />
                </div>
              </CardContent>
            </Card>

            {/* Recent logs */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-base">Recent Verifications</CardTitle></CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No verification attempts yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {logs.map(l => (
                      <div key={l.id} className="flex items-center gap-3 rounded-lg bg-background/50 border border-border/30 px-3 py-2 text-xs">
                        {l.status === "verified" ? <CheckCircle2 className="size-3.5 text-green-400 shrink-0" /> : <XCircle className="size-3.5 text-red-400 shrink-0" />}
                        <span className="font-medium text-white">{l.username}</span>
                        <Badge variant="outline" className="text-[10px]">{l.type}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${l.status === "verified" ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}>{l.status}</Badge>
                        <span className="ml-auto text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
