import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useListWarnings, useCreateWarning, useDeleteWarning, getListWarningsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Plus, Trash2, Search, User, ChevronDown, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface GuildMember {
  id: string;
  username: string;
  globalName: string | null;
  displayName: string;
  avatar: string | null;
}

interface ThresholdRule {
  count: number;
  action: "mute" | "kick" | "ban";
  duration?: number;
}

const warnSchema = z.object({
  userId: z.string().min(1, "Select a user"),
  username: z.string().min(1),
  reason: z.string().min(1, "Reason required"),
});
type WarnForm = z.infer<typeof warnSchema>;

function MemberPicker({ value, onChange, guildId }: {
  value: { id: string; username: string } | null;
  onChange: (m: { id: string; username: string }) => void;
  guildId: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/guilds/${guildId}/members`)
      .then(r => r.json())
      .then(d => setMembers(Array.isArray(d) ? d : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [open, guildId]);

  const filtered = members.filter(m =>
    m.username.toLowerCase().includes(search.toLowerCase()) ||
    (m.globalName ?? "").toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors",
          "border-input bg-background hover:bg-accent hover:text-accent-foreground",
          !value && "text-muted-foreground"
        )}
      >
        {value ? (
          <>
            <User className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{value.username}</span>
          </>
        ) : (
          <>
            <Search className="size-4 shrink-0" />
            <span className="flex-1">Search members...</span>
          </>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-lg border border-border bg-card shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                autoFocus
                placeholder="Search by username..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-background rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="p-3 space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : !filtered.length ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {members.length === 0 ? "No members cached (bot may be offline)" : "No members match"}
              </div>
            ) : (
              filtered.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { onChange({ id: m.id, username: m.username }); setOpen(false); setSearch(""); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.05] text-left text-sm transition-colors"
                >
                  {m.avatar ? (
                    <img
                      src={`https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png?size=32`}
                      className="size-6 rounded-full shrink-0"
                      alt=""
                    />
                  ) : (
                    <div className="size-6 rounded-full bg-purple-900/60 shrink-0 flex items-center justify-center text-[10px] text-purple-300">
                      {m.username.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 truncate">{m.globalName || m.username}</span>
                  <span className="text-muted-foreground text-xs truncate">@{m.username}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Warnings() {
  const { guildId } = useParams<{ guildId: string }>();
  const [open, setOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: string; username: string } | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Punishment thresholds state
  const [threshEnabled, setThreshEnabled] = useState(false);
  const [thresholds, setThresholds] = useState<ThresholdRule[]>([]);
  const [threshSaving, setThreshSaving] = useState(false);

  const { data: warnings, isLoading } = useListWarnings(guildId!, {
    query: { enabled: !!guildId, queryKey: getListWarningsQueryKey(guildId!) }
  });
  const createWarning = useCreateWarning();
  const deleteWarning = useDeleteWarning();

  const form = useForm<WarnForm>({
    resolver: zodResolver(warnSchema),
    defaultValues: { userId: "", username: "", reason: "" },
  });

  // Load punishment thresholds
  useEffect(() => {
    if (!guildId) return;
    fetch(`/api/guilds/${guildId}/punishment-thresholds`)
      .then(r => r.json())
      .then(d => {
        setThreshEnabled(d.enabled ?? false);
        setThresholds(d.thresholds ?? []);
      })
      .catch(() => {});
  }, [guildId]);

  const saveThresholds = async () => {
    if (!guildId) return;
    setThreshSaving(true);
    try {
      await fetch(`/api/guilds/${guildId}/punishment-thresholds`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: threshEnabled, thresholds }),
      });
      toast({ title: "Auto-punishment thresholds saved" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setThreshSaving(false); }
  };

  const addThreshold = () => {
    const usedCounts = new Set(thresholds.map(t => t.count));
    let count = 3;
    while (usedCounts.has(count)) count++;
    setThresholds(prev => [...prev, { count, action: "mute", duration: 60 }]);
  };

  const updateThreshold = (idx: number, patch: Partial<ThresholdRule>) => {
    setThresholds(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  };

  const removeThreshold = (idx: number) => {
    setThresholds(prev => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = (data: WarnForm) => {
    createWarning.mutate({
      guildId: guildId!,
      data: { ...data, moderatorId: "system", moderatorUsername: "Dashboard" }
    }, {
      onSuccess: () => {
        toast({ title: "Warning issued" });
        qc.invalidateQueries({ queryKey: getListWarningsQueryKey(guildId!) });
        setOpen(false);
        setSelectedMember(null);
        form.reset();
      }
    });
  };

  const handleDelete = (warningId: number) => {
    deleteWarning.mutate({ guildId: guildId!, warningId }, {
      onSuccess: () => {
        toast({ title: "Warning removed" });
        qc.invalidateQueries({ queryKey: getListWarningsQueryKey(guildId!) });
      }
    });
  };

  return (
    <Layout guildId={guildId}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Warnings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage user warnings</p>
          </div>
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setSelectedMember(null); form.reset(); } }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-warning">
                <Plus className="size-4 mr-2" />Issue Warning
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Issue Warning</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Member</label>
                    <MemberPicker
                      guildId={guildId!}
                      value={selectedMember}
                      onChange={m => {
                        setSelectedMember(m);
                        form.setValue("userId", m.id);
                        form.setValue("username", m.username);
                      }}
                    />
                    {form.formState.errors.userId && (
                      <p className="text-xs text-destructive">{form.formState.errors.userId.message}</p>
                    )}
                    {selectedMember && (
                      <p className="text-xs text-muted-foreground">ID: {selectedMember.id}</p>
                    )}
                  </div>
                  <FormField control={form.control} name="reason" render={({ field }) => (
                    <FormItem><FormLabel>Reason</FormLabel>
                      <FormControl><Input placeholder="Reason for warning" {...field} data-testid="input-warn-reason" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createWarning.isPending} data-testid="button-submit-warning">
                      {createWarning.isPending ? "Issuing..." : "Issue Warning"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Warning Records ({warnings?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
            ) : !warnings?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="size-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No warnings issued</p>
              </div>
            ) : (
              <div className="space-y-2">
                {warnings.map(w => (
                  <div key={w.id} className="flex items-center gap-4 rounded-lg border border-border/30 bg-background/30 px-4 py-3" data-testid={`row-warning-${w.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{w.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{w.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">by {w.moderatorUsername}</p>
                      <p className="text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleDateString()}</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" data-testid={`button-delete-warning-${w.id}`}>
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Warning?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove this warning from {w.username}.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(w.id)} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto-Punishment Thresholds */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="size-4 text-orange-400" />
                  Auto-Punishment Thresholds
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Automatically punish users when they reach a warning count</p>
              </div>
              <Switch checked={threshEnabled} onCheckedChange={setThreshEnabled} />
            </div>
          </CardHeader>
          {threshEnabled && (
            <CardContent className="space-y-3">
              {thresholds.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No thresholds set. Add one below.</p>
              )}
              {thresholds.map((t, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-border/30 bg-background/30">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">At</div>
                  <Input
                    type="number" min={1} max={100}
                    value={t.count}
                    onChange={e => updateThreshold(i, { count: Number(e.target.value) })}
                    className="w-16 text-center h-8 text-sm"
                  />
                  <div className="text-xs text-muted-foreground shrink-0">warnings →</div>
                  <select
                    value={t.action}
                    onChange={e => updateThreshold(i, { action: e.target.value as any })}
                    className="flex-1 h-8 px-2 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="mute">Mute</option>
                    <option value="kick">Kick</option>
                    <option value="ban">Ban</option>
                  </select>
                  {t.action === "mute" && (
                    <>
                      <Input
                        type="number" min={1}
                        value={t.duration ?? 60}
                        onChange={e => updateThreshold(i, { duration: Number(e.target.value) })}
                        className="w-20 text-center h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">min</span>
                    </>
                  )}
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeThreshold(i)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addThreshold} className="gap-1.5">
                  <Plus className="size-3.5" />Add Threshold
                </Button>
                <Button size="sm" onClick={saveThresholds} disabled={threshSaving}>
                  {threshSaving ? "Saving..." : "Save Thresholds"}
                </Button>
              </div>
            </CardContent>
          )}
          {!threshEnabled && thresholds.length === 0 && null}
          {!threshEnabled && (
            <CardContent className="pt-0">
              <div className="flex justify-end">
                <Button size="sm" onClick={saveThresholds} disabled={threshSaving}>
                  {threshSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </Layout>
  );
}
