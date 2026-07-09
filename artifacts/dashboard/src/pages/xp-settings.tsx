import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { RolePicker } from "@/components/role-picker";
import { ChannelPicker } from "@/components/channel-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, Star, Zap, Trophy, Settings, Plus, Trash2, Hash, Users, ChevronUp, BarChart2
} from "lucide-react";
import { useDirtyState } from "@/hooks/use-dirty-state";
import { UnsavedChangesBadge } from "@/components/unsaved-changes-badge";

interface XpSettings {
  id: number;
  guildId: string;
  enabled: boolean;
  minXpPerMessage: number;
  maxXpPerMessage: number;
  cooldownSeconds: number;
  levelUpChannelId: string | null;
  levelUpMessage: string;
  stackRoles: boolean;
  noXpRoles: string[];
  noXpChannels: string[];
  multipliers: Array<{ type: "role" | "channel"; id: string; name: string; multiplier: number }>;
}

interface UserXp {
  id: number;
  guildId: string;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  xp: number;
  level: number;
  messages: number;
  lastMessage: string | null;
}

interface LevelRole {
  id: number;
  level: number;
  roleId: string;
  roleName: string;
}

function xpForLevel(lvl: number) { return 5 * lvl * lvl + 50 * lvl + 100; }
function totalXpForLevel(lvl: number) {
  let t = 0; for (let i = 0; i < lvl; i++) t += xpForLevel(i); return t;
}

function XpBar({ xp, level }: { xp: number; level: number }) {
  const needed = xpForLevel(level);
  const pct = Math.min(100, Math.round((xp / needed) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{xp} / {needed} XP</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function XpSettingsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery<XpSettings | null>({
    queryKey: ["xp-settings", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/xp-settings`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });

  const { data: leaderboard, isLoading: lbLoading } = useQuery<UserXp[]>({
    queryKey: ["xp-leaderboard", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/xp-leaderboard`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });

  const { data: levelRoles, isLoading: lrLoading } = useQuery<LevelRole[]>({
    queryKey: ["level-roles", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/level-roles`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });

  const [form, setForm] = useState<XpSettings>({
    id: 0, guildId: guildId ?? "",
    enabled: true,
    minXpPerMessage: 15,
    maxXpPerMessage: 40,
    cooldownSeconds: 60,
    levelUpChannelId: null,
    levelUpMessage: "🎉 {user} has reached **level {level}**!",
    stackRoles: true,
    noXpRoles: [],
    noXpChannels: [],
    multipliers: [],
  });

  // Role reward form
  const [addLvlOpen, setAddLvlOpen] = useState(false);
  const [newLevel, setNewLevel] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [newRoleName, setNewRoleName] = useState("");

  // Multiplier form
  const [addMultiOpen, setAddMultiOpen] = useState(false);
  const [multiType, setMultiType] = useState<"role" | "channel">("role");
  const [multiId, setMultiId] = useState("");
  const [multiName, setMultiName] = useState("");
  const [multiValue, setMultiValue] = useState("2");

  const { isDirty, markSaved } = useDirtyState(form);

  useEffect(() => {
    if (settings) {
      const normalized = { ...settings, noXpRoles: (settings.noXpRoles ?? []) as string[], noXpChannels: (settings.noXpChannels ?? []) as string[], multipliers: (settings.multipliers ?? []) as any[] };
      setForm(normalized);
      markSaved(normalized);
    }
  }, [settings]);

  const set = (k: keyof XpSettings, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/xp-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["xp-settings", guildId] });
      toast({ title: "XP settings saved!" });
      markSaved(form);
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const createLR = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/level-roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: parseInt(newLevel), roleId: newRoleId, roleName: newRoleName }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["level-roles", guildId] });
      toast({ title: "Role reward added!" });
      setAddLvlOpen(false); setNewLevel(""); setNewRoleId(""); setNewRoleName("");
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const deleteLR = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/guilds/${guildId}/level-roles/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["level-roles", guildId] }),
  });

  const addNoXpChannel = (id: string) => { if (id && !form.noXpChannels.includes(id)) set("noXpChannels", [...form.noXpChannels, id]); };
  const removeNoXpChannel = (id: string) => set("noXpChannels", form.noXpChannels.filter(c => c !== id));
  const addNoXpRole = (id: string) => { if (id && !form.noXpRoles.includes(id)) set("noXpRoles", [...form.noXpRoles, id]); };
  const removeNoXpRole = (id: string) => set("noXpRoles", form.noXpRoles.filter(r => r !== id));

  const addMultiplier = () => {
    if (!multiId || !multiName) return;
    const m = { type: multiType, id: multiId, name: multiName, multiplier: parseFloat(multiValue) || 2 };
    set("multipliers", [...form.multipliers, m]);
    setAddMultiOpen(false); setMultiId(""); setMultiName(""); setMultiValue("2");
  };
  const removeMultiplier = (i: number) => set("multipliers", form.multipliers.filter((_, idx) => idx !== i));

  const sorted = [...(levelRoles ?? [])].sort((a, b) => a.level - b.level);

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />XP & Levels
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Arcane-style leveling — members earn XP by chatting</p>
          </div>
          <div className="flex items-center gap-3">
            <UnsavedChangesBadge show={isDirty && !save.isPending} />
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !isDirty}>
              {save.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        {leaderboard && leaderboard.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card/50 border border-border/40 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{leaderboard.length}</p>
              <p className="text-xs text-muted-foreground">Ranked Members</p>
            </div>
            <div className="bg-card/50 border border-border/40 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{leaderboard[0]?.level ?? 0}</p>
              <p className="text-xs text-muted-foreground">Highest Level</p>
            </div>
            <div className="bg-card/50 border border-border/40 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{leaderboard.reduce((a, b) => a + (b.messages ?? 0), 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Messages</p>
            </div>
          </div>
        )}

        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList className="bg-card/50 border border-border/50 flex overflow-x-auto h-auto gap-1 w-full scrollbar-hide">
            <TabsTrigger value="settings" className="gap-1.5"><Settings className="size-3.5" />XP Settings</TabsTrigger>
            <TabsTrigger value="rewards" className="gap-1.5"><Star className="size-3.5" />Role Rewards</TabsTrigger>
            <TabsTrigger value="zones" className="gap-1.5"><Hash className="size-3.5" />No-XP Zones</TabsTrigger>
            <TabsTrigger value="multipliers" className="gap-1.5"><Zap className="size-3.5" />Multipliers</TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-1.5"><Trophy className="size-3.5" />Leaderboard</TabsTrigger>
          </TabsList>

          {/* ── XP Settings ── */}
          <TabsContent value="settings" className="mt-0 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">XP System</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{form.enabled ? "Enabled" : "Disabled"}</span>
                      <Switch checked={form.enabled} onCheckedChange={v => set("enabled", v)} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Min XP per Message</Label>
                      <Input type="number" min={1} value={form.minXpPerMessage}
                        onChange={e => set("minXpPerMessage", parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Max XP per Message</Label>
                      <Input type="number" min={1} value={form.maxXpPerMessage}
                        onChange={e => set("maxXpPerMessage", parseInt(e.target.value) || 1)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cooldown (seconds)</Label>
                    <Input type="number" min={1} value={form.cooldownSeconds}
                      onChange={e => set("cooldownSeconds", parseInt(e.target.value) || 1)} />
                    <p className="text-xs text-muted-foreground">Minimum time between XP gains per user</p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
                    <div>
                      <p className="text-sm font-medium">Stack Roles</p>
                      <p className="text-xs text-muted-foreground">Keep all earned level roles (vs only highest)</p>
                    </div>
                    <Switch checked={form.stackRoles} onCheckedChange={v => set("stackRoles", v)} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3"><CardTitle className="text-base">Level-Up Notification</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Notification Channel</Label>
                    <ChannelPicker value={form.levelUpChannelId ?? ""} onChange={v => set("levelUpChannelId", v || null)}
                      placeholder="Same channel (leave empty)" />
                    <p className="text-xs text-muted-foreground">Leave empty = same channel. Type "dm" to send in DMs</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Level-Up Message</Label>
                    <Input value={form.levelUpMessage} onChange={e => set("levelUpMessage", e.target.value)} />
                    <p className="text-xs text-muted-foreground">Variables: <code className="text-primary">{"{user}"}</code> <code className="text-primary">{"{level}"}</code> <code className="text-primary">{"{username}"}</code></p>
                  </div>

                  {/* XP formula reference */}
                  <div className="rounded-lg bg-background/50 border border-border/30 p-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">XP Required Per Level</p>
                    <div className="grid grid-cols-2 gap-1">
                      {[1,2,3,4,5,10,20,30].map(lvl => (
                        <div key={lvl} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Level {lvl}</span>
                          <span className="font-mono text-primary">{xpForLevel(lvl)} XP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Role Rewards ── */}
          <TabsContent value="rewards" className="mt-0 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Assign roles automatically when members reach a level</p>
              <Dialog open={addLvlOpen} onOpenChange={setAddLvlOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><Plus className="size-3.5" />Add Reward</Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-sm">
                  <DialogHeader><DialogTitle>Add Role Reward</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <Label>Level Required</Label>
                      <Input type="number" min={1} placeholder="e.g. 5" value={newLevel} onChange={e => setNewLevel(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role to Grant</Label>
                      <RolePicker value={newRoleId} onChange={setNewRoleId}
                        onChangeWithName={(id, name) => { setNewRoleId(id); setNewRoleName(name); }} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setAddLvlOpen(false)}>Cancel</Button>
                      <Button size="sm" onClick={() => createLR.mutate()} disabled={!newLevel || !newRoleId || createLR.isPending}>
                        {createLR.isPending ? "Adding..." : "Add"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {lrLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/50 rounded-xl text-muted-foreground">
                <Star className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No role rewards yet</p>
              </div>
            ) : (
              <>
                {/* Level bar visualization */}
                <div className="bg-card/40 border border-border/40 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Level Ladder</p>
                  <div className="flex items-end gap-2 overflow-x-auto pb-1">
                    {sorted.map((lr, i) => (
                      <div key={lr.id} className="flex flex-col items-center gap-1 min-w-[56px]">
                        <span className="text-xs text-muted-foreground truncate max-w-[56px] text-center" title={lr.roleName}>
                          {lr.roleName.length > 6 ? lr.roleName.slice(0, 5) + "…" : lr.roleName}
                        </span>
                        <div className="w-10 rounded-t-md bg-primary/70" style={{ height: `${Math.min(16 + i * 10, 80)}px` }} />
                        <span className="text-xs font-bold text-primary">Lv {lr.level}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sorted.map(lr => (
                    <div key={lr.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/50">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Star className="size-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{lr.roleName}</p>
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary">Level {lr.level}</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteLR.mutate(lr.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* ── No-XP Zones ── */}
          <TabsContent value="zones" className="mt-0 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Hash className="size-4" />Excluded Channels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ChannelPicker value="" onChange={addNoXpChannel} placeholder="Add channel to exclude" />
                  <div className="space-y-1.5">
                    {form.noXpChannels.map(id => (
                      <div key={id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/30">
                        <span className="text-xs font-mono text-muted-foreground"><Hash className="size-3 inline mr-1" />{id}</span>
                        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => removeNoXpChannel(id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}
                    {form.noXpChannels.length === 0 && <p className="text-xs text-muted-foreground">No channels excluded</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Users className="size-4" />Excluded Roles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RolePicker value="" onChange={addNoXpRole} placeholder="Add role to exclude" />
                  <div className="space-y-1.5">
                    {form.noXpRoles.map(id => (
                      <div key={id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/30">
                        <span className="text-xs font-mono text-muted-foreground">@{id}</span>
                        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => removeNoXpRole(id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}
                    {form.noXpRoles.length === 0 && <p className="text-xs text-muted-foreground">No roles excluded</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Multipliers ── */}
          <TabsContent value="multipliers" className="mt-0 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Give extra XP in certain channels or to certain roles</p>
              <Dialog open={addMultiOpen} onOpenChange={setAddMultiOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><Plus className="size-3.5" />Add Multiplier</Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-sm">
                  <DialogHeader><DialogTitle>Add XP Multiplier</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <div className="flex gap-2">
                        {(["role", "channel"] as const).map(t => (
                          <button key={t} onClick={() => setMultiType(t)}
                            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${multiType === t ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}>
                            {t === "role" ? "👥 Role" : "# Channel"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{multiType === "role" ? "Role" : "Channel"}</Label>
                      {multiType === "role"
                        ? <RolePicker value={multiId} onChange={setMultiId} onChangeWithName={(id, name) => { setMultiId(id); setMultiName(name); }} />
                        : <ChannelPicker value={multiId} onChange={(id) => { setMultiId(id); setMultiName(id); }} />
                      }
                    </div>
                    <div className="space-y-1.5">
                      <Label>Multiplier</Label>
                      <Input type="number" min={1.1} max={10} step={0.1} value={multiValue} onChange={e => setMultiValue(e.target.value)} />
                      <p className="text-xs text-muted-foreground">e.g. 2 = double XP, 1.5 = 50% bonus</p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setAddMultiOpen(false)}>Cancel</Button>
                      <Button size="sm" onClick={addMultiplier} disabled={!multiId}>Add</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {form.multipliers.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/50 rounded-xl text-muted-foreground">
                <Zap className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No multipliers configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {form.multipliers.map((m, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/50">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                        <Zap className="size-4 text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          <Badge variant="outline" className="text-xs">{m.type}</Badge>
                          <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">×{m.multiplier}</Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => removeMultiplier(i)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Leaderboard ── */}
          <TabsContent value="leaderboard" className="mt-0">
            {lbLoading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : !leaderboard?.length ? (
              <div className="text-center py-16 border border-dashed border-border/50 rounded-xl text-muted-foreground">
                <Trophy className="size-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No data yet</p>
                <p className="text-xs mt-1 opacity-60">Members need to chat to earn XP first</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((u, i) => (
                  <div key={u.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${i === 0 ? "border-yellow-500/30 bg-yellow-500/5" : i === 1 ? "border-gray-400/30 bg-gray-400/5" : i === 2 ? "border-orange-500/30 bg-orange-500/5" : "border-border/40 bg-card/30"}`}>
                    <div className="w-8 text-center font-bold text-sm">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </div>
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} className="size-9 rounded-full" alt={u.username ?? ""} />
                    ) : (
                      <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {(u.username ?? "?").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{u.username ?? `User ${u.userId.slice(0, 6)}`}</p>
                      <XpBar xp={u.xp} level={u.level} />
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <TrendingUp className="size-3.5 text-primary" />
                        <span className="text-sm font-bold text-primary">Lv {u.level}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{(u.messages ?? 0).toLocaleString()} msgs</p>
                    </div>
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
