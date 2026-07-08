import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { ChannelPicker } from "@/components/channel-picker";
import { RolePicker } from "@/components/role-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Gift, Trophy, RefreshCw, Square, Trash2, Clock } from "lucide-react";

interface Giveaway {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  prize: string;
  winnerCount: number;
  requiredRoleId: string | null;
  endsAt: string;
  ended: boolean;
  winners: Array<{ userId: string; username: string }>;
  createdAt: string;
}

function useGiveaways(guildId: string) {
  return useQuery<Giveaway[]>({
    queryKey: ["giveaways", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/giveaways`);
      if (!res.ok) throw new Error(`Failed to load giveaways (${res.status})`);
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 30_000,
  });
}

function formatTimeLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function CreateGiveawayDialog({ guildId, onCreated }: { guildId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [prize, setPrize] = useState("");
  const [channelId, setChannelId] = useState("");
  const [winnerCount, setWinnerCount] = useState(1);
  const [durationHours, setDurationHours] = useState(24);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [requiredRoleId, setRequiredRoleId] = useState("");
  const { toast } = useToast();

  const create = useMutation({
    mutationFn: async () => {
      const durationMs = (durationHours * 3600 + durationMinutes * 60) * 1000;
      const res = await fetch(`/api/guilds/${guildId}/giveaways`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId, prize,
          winnerCount: Math.max(1, winnerCount),
          requiredRoleId: requiredRoleId || null,
          durationMs,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "🎉 Giveaway created!" });
      setOpen(false);
      setPrize(""); setChannelId(""); setWinnerCount(1); setDurationHours(24); setDurationMinutes(0); setRequiredRoleId("");
      onCreated();
    },
    onError: () => toast({ title: "Failed to create giveaway", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="size-3.5" />Create Giveaway</Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Gift className="size-4 text-primary" />New Giveaway</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Prize</Label>
            <Input placeholder="e.g. Discord Nitro, Steam Gift Card..." value={prize} onChange={e => setPrize(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <ChannelPicker value={channelId} onChange={setChannelId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Winners</Label>
              <Input type="number" min={1} max={20} value={winnerCount} onChange={e => setWinnerCount(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <div className="flex gap-1.5">
                <Input type="number" min={0} placeholder="h" value={durationHours} onChange={e => setDurationHours(parseInt(e.target.value) || 0)} className="text-center" />
                <span className="self-center text-muted-foreground text-sm">h</span>
                <Input type="number" min={0} max={59} placeholder="m" value={durationMinutes} onChange={e => setDurationMinutes(parseInt(e.target.value) || 0)} className="text-center" />
                <span className="self-center text-muted-foreground text-sm">m</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Required Role <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <RolePicker value={requiredRoleId} onChange={setRequiredRoleId} placeholder="No role required" />
          </div>

          {/* Preview */}
          <div className="rounded-xl bg-[#313338] p-3 border border-border/30">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Discord Preview</p>
            <div className="bg-[#2b2d31] rounded-lg p-3 border-l-4 border-purple-500">
              <p className="text-white font-bold text-sm">🎉 GIVEAWAY 🎉</p>
              <p className="text-gray-300 text-xs mt-1">
                <strong>Prize:</strong> {prize || "Your prize"}<br />
                React with 🎉 to enter!<br />
                <strong>Winners:</strong> {winnerCount}<br />
                <strong>Duration:</strong> {durationHours}h {durationMinutes}m
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => create.mutate()} disabled={!prize || !channelId || create.isPending || (durationHours === 0 && durationMinutes === 0)}>
              {create.isPending ? "Creating..." : "Create Giveaway"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Giveaways() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: giveaways, isLoading, isError, error, refetch } = useGiveaways(guildId!);
  const { toast } = useToast();
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["giveaways", guildId] });

  const endGiveaway = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/guilds/${guildId}/giveaways/${id}/end`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast({ title: "Giveaway ended — winners picked!" }); invalidate(); },
    onError: () => toast({ title: "Failed to end giveaway", variant: "destructive" }),
  });

  const rerollGiveaway = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/guilds/${guildId}/giveaways/${id}/reroll`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast({ title: "Rerolled! New winners picked." }); invalidate(); },
    onError: () => toast({ title: "Failed to reroll", variant: "destructive" }),
  });

  const deleteGiveaway = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/guilds/${guildId}/giveaways/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { toast({ title: "Giveaway deleted" }); invalidate(); },
  });

  const active = giveaways?.filter(g => !g.ended) ?? [];
  const ended = giveaways?.filter(g => g.ended) ?? [];

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Giveaways</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create and manage server giveaways</p>
          </div>
          <CreateGiveawayDialog guildId={guildId!} onCreated={invalidate} />
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load giveaways</p>
            <p className="text-xs text-muted-foreground mt-1">{(error as Error)?.message}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : (
          <>
            {/* Active */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <span className="size-2 rounded-full bg-green-400 animate-pulse inline-block" />
                Active Giveaways ({active.length})
              </h2>
              {active.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border/50 rounded-xl text-muted-foreground">
                  <Gift className="size-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No active giveaways</p>
                  <p className="text-xs mt-1 opacity-60">Click "Create Giveaway" to get started</p>
                </div>
              ) : (
                active.map(g => (
                  <Card key={g.id} className="border-border/50 bg-card/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
                            <Gift className="size-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-base truncate">{g.prize}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1"><Trophy className="size-3" />{g.winnerCount} winner{g.winnerCount !== 1 ? "s" : ""}</span>
                              <span className="flex items-center gap-1 text-green-400 font-medium">
                                <Clock className="size-3" />{formatTimeLeft(g.endsAt)}
                              </span>
                              {g.requiredRoleId && <Badge variant="outline" className="text-xs py-0">Role required</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => endGiveaway.mutate(g.id)} disabled={endGiveaway.isPending}>
                            <Square className="size-3" />End
                          </Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground"
                            onClick={() => deleteGiveaway.mutate(g.id)} disabled={deleteGiveaway.isPending}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Ended */}
            {ended.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="size-2 rounded-full bg-gray-500 inline-block" />
                  Past Giveaways ({ended.length})
                </h2>
                {ended.map(g => (
                  <Card key={g.id} className="border-border/30 bg-card/30 opacity-80">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="rounded-xl bg-muted/30 p-2.5 shrink-0">
                            <Trophy className="size-5 text-yellow-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-base truncate">{g.prize}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {(g.winners as Array<{ userId: string; username: string }>).length > 0 ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs text-yellow-500 font-medium">🏆 Winners:</span>
                                  {(g.winners as Array<{ userId: string; username: string }>).map(w => (
                                    <Badge key={w.userId} variant="outline" className="text-xs">{w.username}</Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No valid entries</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => rerollGiveaway.mutate(g.id)} disabled={rerollGiveaway.isPending}>
                            <RefreshCw className="size-3" />Reroll
                          </Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground"
                            onClick={() => deleteGiveaway.mutate(g.id)} disabled={deleteGiveaway.isPending}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
