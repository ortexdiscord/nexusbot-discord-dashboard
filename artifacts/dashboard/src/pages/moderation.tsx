import { useParams } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import {
  useListModerationLogs, useBanUser, useKickUser, useMuteUser,
  getListModerationLogsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldBan, UserX, Volume2, Clock, Search, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

interface GuildMember {
  id: string;
  username: string;
  globalName: string | null;
  displayName: string;
  avatar: string | null;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function MemberPicker({
  guildId,
  value,
  onChange,
}: {
  guildId: string;
  value: string;
  onChange: (id: string, name?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 350);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (debouncedQuery.length < 2) { setMembers([]); setOpen(false); return; }
    setLoading(true);
    fetch(`${BASE}/api/guilds/${guildId}/members?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then((data: GuildMember[]) => { setMembers(data); setOpen(data.length > 0); })
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, guildId]);

  const avatarUrl = (m: GuildMember) =>
    m.avatar
      ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png?size=32`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(m.id.slice(-1)) % 5}.png`;

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-purple-300/40 pointer-events-none" />
        <input
          className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border text-white placeholder:text-purple-300/30 focus:outline-none focus:ring-2 focus:ring-[#f5c400]/40"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
          placeholder="Search member by name…"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedName(null); }}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 border-2 border-[#f5c400]/60 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Selected badge */}
      {selectedName && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#f5c400]">
          <User className="size-3" />
          <span>Selected: <strong>{selectedName}</strong></span>
          <span className="text-purple-300/40 font-mono">({value})</span>
        </div>
      )}

      {/* Dropdown results */}
      {open && members.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-xl"
          style={{ background: "#1a0838", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          {members.map(m => (
            <button
              key={m.id}
              type="button"
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left text-sm hover:bg-white/[0.06] transition-colors"
              onClick={() => {
                onChange(m.id, m.displayName || m.username);
                setSelectedName(m.displayName || m.username);
                setQuery(m.displayName || m.username);
                setOpen(false);
              }}
            >
              <img src={avatarUrl(m)} className="size-7 rounded-full shrink-0" alt="" />
              <div className="min-w-0">
                <p className="font-medium text-white truncate">{m.displayName || m.globalName || m.username}</p>
                <p className="text-xs text-purple-300/40 truncate">@{m.username}</p>
              </div>
              <span className="ml-auto text-xs font-mono text-purple-300/30 shrink-0">{m.id.slice(-6)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Raw ID fallback */}
      <div className="mt-2">
        <p className="text-xs text-purple-300/40 mb-1">Or paste a User ID directly:</p>
        <Input
          placeholder="000000000000000000"
          value={value}
          onChange={e => { onChange(e.target.value); setSelectedName(null); setQuery(""); }}
          className="font-mono text-xs"
          data-testid="input-user-id"
        />
      </div>
    </div>
  );
}

const actionSchema = z.object({
  userId: z.string().min(1, "User required"),
  reason: z.string().min(1, "Reason required"),
  duration: z.coerce.number().optional(),
});
type ActionForm = z.infer<typeof actionSchema>;

const typeColors: Record<string, string> = {
  ban:    "bg-red-500/10 text-red-400 border-red-500/20",
  kick:   "bg-orange-500/10 text-orange-400 border-orange-500/20",
  mute:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  unmute: "bg-green-500/10 text-green-400 border-green-500/20",
  warn:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

function ActionDialog({ guildId, action, trigger }: { guildId: string; action: "ban" | "kick" | "mute"; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const ban = useBanUser();
  const kick = useKickUser();
  const mute = useMuteUser();

  const form = useForm<ActionForm>({
    resolver: zodResolver(actionSchema),
    defaultValues: { userId: "", reason: "", duration: undefined },
  });

  const onSubmit = (data: ActionForm) => {
    const afterSuccess = () => {
      toast({ title: `User ${action}ned`, description: `Successfully ${action}ned user` });
      qc.invalidateQueries({ queryKey: getListModerationLogsQueryKey(guildId) });
      setOpen(false);
      form.reset();
    };

    if (action === "ban") {
      ban.mutate({ guildId, data: { userId: data.userId, reason: data.reason } }, { onSuccess: afterSuccess });
    } else if (action === "kick") {
      kick.mutate({ guildId, data: { userId: data.userId, reason: data.reason } }, { onSuccess: afterSuccess });
    } else {
      mute.mutate({ guildId, data: { userId: data.userId, reason: data.reason, duration: data.duration ?? 60 } }, { onSuccess: afterSuccess });
    }
  };

  const isPending = ban.isPending || kick.isPending || mute.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">{action} User</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Member picker — sets userId field */}
            <div>
              <p className="text-sm font-medium mb-1.5">Find Member</p>
              <MemberPicker
                guildId={guildId}
                value={form.watch("userId")}
                onChange={(id) => form.setValue("userId", id, { shouldValidate: true })}
              />
              {form.formState.errors.userId && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.userId.message}</p>
              )}
            </div>

            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Reason</FormLabel>
                <FormControl><Input placeholder="Reason for action" {...field} data-testid="input-reason" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {action === "mute" && (
              <FormField control={form.control} name="duration" render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (minutes)</FormLabel>
                  <FormControl><Input type="number" placeholder="60" {...field} data-testid="input-duration" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={isPending} data-testid={`button-${action}`}>
                {isPending ? "Processing…" : `${action.charAt(0).toUpperCase() + action.slice(1)} User`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Moderation() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: logs, isLoading } = useListModerationLogs(guildId!, {
    query: { enabled: !!guildId, queryKey: getListModerationLogsQueryKey(guildId!) }
  });

  return (
    <Layout guildId={guildId}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Moderation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage bans, kicks, and mutes</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <ActionDialog guildId={guildId!} action="ban" trigger={
              <Button variant="destructive" size="sm" data-testid="button-open-ban">
                <ShieldBan className="size-4 mr-2" />Ban
              </Button>
            } />
            <ActionDialog guildId={guildId!} action="kick" trigger={
              <Button variant="outline" size="sm" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10" data-testid="button-open-kick">
                <UserX className="size-4 mr-2" />Kick
              </Button>
            } />
            <ActionDialog guildId={guildId!} action="mute" trigger={
              <Button variant="outline" size="sm" className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" data-testid="button-open-mute">
                <Volume2 className="size-4 mr-2" />Mute
              </Button>
            } />
          </div>
        </div>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Moderation Log</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : !logs?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShieldBan className="size-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No moderation actions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-4 rounded-lg border border-border/30 bg-background/30 px-4 py-3" data-testid={`row-log-${log.id}`}>
                    <Badge variant="outline" className={`capitalize shrink-0 ${typeColors[log.type] ?? ""}`}>
                      {log.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{log.targetUsername}</p>
                      <p className="text-xs text-muted-foreground truncate">{log.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">by {log.moderatorUsername}</p>
                      {log.duration && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Clock className="size-3" />{log.duration}m
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{new Date(log.createdAt).toLocaleDateString()}</p>
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
