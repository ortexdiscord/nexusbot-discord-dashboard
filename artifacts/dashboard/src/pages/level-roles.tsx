import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { RolePicker } from "@/components/role-picker";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Plus, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";

interface LevelRole {
  id: number;
  guildId: string;
  level: number;
  roleId: string;
  roleName: string;
  createdAt: string;
}

function useLevelRoles(guildId: string) {
  return useQuery<LevelRole[]>({
    queryKey: ["level-roles", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/level-roles`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!guildId,
  });
}

function useCreateLevelRole(guildId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { level: number; roleId: string; roleName: string }) => {
      const res = await fetch(`/api/guilds/${guildId}/level-roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["level-roles", guildId] }),
  });
}

function useDeleteLevelRole(guildId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/guilds/${guildId}/level-roles/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["level-roles", guildId] }),
  });
}

export default function LevelRoles() {
  const { guildId } = useParams<{ guildId: string }>();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roleName, setRoleName] = useState("");
  const { toast } = useToast();

  const { data: levelRoles, isLoading } = useLevelRoles(guildId!);
  const createLR = useCreateLevelRole(guildId!);
  const deleteLR = useDeleteLevelRole(guildId!);

  const handleCreate = () => {
    const lvl = parseInt(level);
    if (!lvl || lvl < 1) { toast({ title: "Enter a valid level (1+)", variant: "destructive" }); return; }
    if (!roleId) { toast({ title: "Select a role", variant: "destructive" }); return; }
    createLR.mutate({ level: lvl, roleId, roleName }, {
      onSuccess: () => {
        toast({ title: `Level ${lvl} role assigned to ${roleName}` });
        setOpen(false);
        setLevel(""); setRoleId(""); setRoleName("");
      },
      onError: () => toast({ title: "Failed to create level role", variant: "destructive" }),
    });
  };

  const sorted = [...(levelRoles ?? [])].sort((a, b) => a.level - b.level);

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Level Roles</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Automatically assign roles when members reach a level</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setLevel(""); setRoleId(""); setRoleName(""); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="size-4 mr-2" />Add Level Role</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-sm">
              <DialogHeader><DialogTitle>Add Level Role</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <Label>Level Required</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 5"
                    value={level}
                    onChange={e => setLevel(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Members who reach this level receive the role</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Role to Assign</Label>
                  <RolePicker
                    value={roleId}
                    onChange={setRoleId}
                    onChangeWithName={(id, name) => { setRoleId(id); setRoleName(name); }}
                    placeholder="Select a role"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleCreate} disabled={createLR.isPending}>
                    {createLR.isPending ? "Saving..." : "Add Role"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Visual level ladder */}
        {!isLoading && sorted.length > 0 && (
          <div className="bg-card/40 border border-border/40 rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">Level Ladder</p>
            <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
              {sorted.map((lr, i) => (
                <div key={lr.id} className="flex flex-col items-center gap-1 min-w-[52px]">
                  <span className="text-xs text-muted-foreground truncate max-w-[52px] text-center" title={lr.roleName}>
                    {lr.roleName.length > 6 ? lr.roleName.slice(0, 5) + "…" : lr.roleName}
                  </span>
                  <div
                    className="w-10 rounded-t-md bg-primary/70 transition-all"
                    style={{ height: `${Math.min(12 + i * 8, 72)}px` }}
                  />
                  <span className="text-xs font-bold text-primary">Lv {lr.level}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            [1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : sorted.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <TrendingUp className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No level roles configured yet</p>
              <p className="text-xs mt-1 opacity-60">Add a level role to reward active members automatically</p>
            </div>
          ) : sorted.map(lr => (
            <Card key={lr.id} className="border-border/50 bg-card/50 hover:bg-card/80 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Star className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{lr.roleName}</p>
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary mt-0.5">
                        Level {lr.level}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="text-muted-foreground hover:text-destructive -mt-1 -mr-1"
                    onClick={() => deleteLR.mutate(lr.id, {
                      onSuccess: () => toast({ title: "Level role removed" }),
                    })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
