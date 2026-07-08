import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { RolePicker } from "@/components/role-picker";
import { ChannelPicker } from "@/components/channel-picker";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Send, Users, Smartphone, Calendar, Image } from "lucide-react";

interface SelfRole {
  id: number;
  guildId: string;
  category: string;
  emoji: string;
  label: string;
  roleId: string;
  roleName: string;
  description: string | null;
}

const CATEGORIES = [
  {
    key: "gender",
    label: "Gender Roles",
    icon: Users,
    description: "Let members pick their gender role",
    gradient: "from-pink-500/20 to-blue-500/20",
    borderColor: "border-pink-500/30",
    defaultOptions: [
      { emoji: "🚹", label: "Male" },
      { emoji: "🚺", label: "Female" },
      { emoji: "🚫", label: "Rather Not Say" },
    ],
  },
  {
    key: "age",
    label: "Age Roles",
    icon: Calendar,
    description: "Let members select their age group",
    gradient: "from-purple-500/20 to-indigo-500/20",
    borderColor: "border-purple-500/30",
    defaultOptions: [
      { emoji: "🔞", label: "-18" },
      { emoji: "✅", label: "18+" },
    ],
  },
  {
    key: "device",
    label: "Device Roles",
    icon: Smartphone,
    description: "Let members show what device they use",
    gradient: "from-gray-500/20 to-slate-500/20",
    borderColor: "border-gray-500/30",
    defaultOptions: [
      { emoji: "💻", label: "Desktop" },
      { emoji: "📱", label: "Mobile" },
      { emoji: "⌨️", label: "Both" },
    ],
  },
];

function useSelfRoles(guildId: string) {
  return useQuery<SelfRole[]>({
    queryKey: ["self-roles", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/self-roles`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });
}

function AddRoleDialog({ guildId, category, defaults, onAdded }: {
  guildId: string;
  category: string;
  defaults: Array<{ emoji: string; label: string }>;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [emoji, setEmoji] = useState("");
  const [label, setLabel] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roleName, setRoleName] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/self-roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, emoji, label, roleId, roleName }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["self-roles", guildId] });
      toast({ title: "Role added!" });
      setOpen(false);
      setEmoji(""); setLabel(""); setRoleId(""); setRoleName("");
    },
    onError: () => toast({ title: "Failed to add role", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><Plus className="size-3.5" />Add Role</Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Add Self Role</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>Emoji</Label>
            <div className="flex gap-2 flex-wrap">
              {defaults.map(d => (
                <button key={d.emoji} onClick={() => { setEmoji(d.emoji); setLabel(d.label); }}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${emoji === d.emoji ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
                  {d.emoji} {d.label}
                </button>
              ))}
            </div>
            <Input placeholder="Or type custom emoji" value={emoji} onChange={e => setEmoji(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input placeholder="e.g. Male" value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Role to Assign</Label>
            <RolePicker value={roleId} onChange={setRoleId} onChangeWithName={(id, name) => { setRoleId(id); setRoleName(name); }} placeholder="Select role" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => create.mutate()} disabled={!emoji || !label || !roleId || create.isPending}>
              {create.isPending ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SendDialog({ guildId, category, disabled }: { guildId: string; category: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const { toast } = useToast();

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/self-roles/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, category, bannerImageUrl: bannerImageUrl || undefined }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "Sent to channel! ✅" });
      setOpen(false);
      setChannelId("");
      setBannerImageUrl("");
    },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} className="gap-1.5"><Send className="size-3.5" />Send to Channel</Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Send Self Role Message</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <p className="text-sm text-muted-foreground">The bot will send a formatted embed with reaction emojis to the selected channel.</p>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <ChannelPicker value={channelId} onChange={setChannelId} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Image className="size-3.5" />Banner Image URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              placeholder="https://example.com/banner.png"
              value={bannerImageUrl}
              onChange={e => setBannerImageUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Appears as a large image inside the Discord embed.</p>
            {bannerImageUrl && (
              <div className="rounded-lg overflow-hidden border border-border/50 mt-1">
                <img src={bannerImageUrl} alt="Banner preview" className="w-full h-24 object-cover" onError={e => (e.currentTarget.style.display = "none")} />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => send.mutate()} disabled={!channelId || send.isPending}>
              {send.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SelfRoles() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: allRoles, isLoading } = useSelfRoles(guildId!);
  const { toast } = useToast();
  const qc = useQueryClient();

  const deleteRole = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/guilds/${guildId}/self-roles/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["self-roles", guildId] });
      toast({ title: "Role removed" });
    },
  });

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Self Roles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Members pick their own roles by clicking emoji reactions</p>
        </div>

        <Tabs defaultValue="gender" className="space-y-4">
          <TabsList className="bg-card/50 border border-border/50">
            {CATEGORIES.map(cat => (
              <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5">
                <cat.icon className="size-3.5" />{cat.label.split(" ")[0]}
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map(cat => {
            const catRoles = allRoles?.filter(r => r.category === cat.key) ?? [];
            return (
              <TabsContent key={cat.key} value={cat.key} className="space-y-4 mt-0">
                <div className={`rounded-xl border ${cat.borderColor} bg-gradient-to-r ${cat.gradient} p-5`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-bold text-lg">{cat.label}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">{cat.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <AddRoleDialog guildId={guildId!} category={cat.key} defaults={cat.defaultOptions} onAdded={() => {}} />
                      <SendDialog guildId={guildId!} category={cat.key} disabled={catRoles.length === 0} />
                    </div>
                  </div>
                </div>

                {isLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
                ) : catRoles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-xl">
                    <cat.icon className="size-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No roles configured for {cat.label}</p>
                    <p className="text-xs mt-1 opacity-60">Click "Add Role" to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {catRoles.map(role => (
                      <Card key={role.id} className="border-border/50 bg-card/50">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{role.emoji}</span>
                            <div>
                              <p className="font-medium text-sm">{role.label}</p>
                              <Badge variant="outline" className="text-xs mt-0.5">{role.roleName}</Badge>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive size-8"
                            onClick={() => deleteRole.mutate(role.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {catRoles.length > 0 && (
                  <div className="rounded-xl border border-border/40 bg-[#313338] p-4">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">DISCORD PREVIEW</p>
                    <div className="bg-[#2b2d31] rounded-lg p-3 border-l-4 border-primary/70">
                      <p className="text-white text-sm font-semibold mb-1">
                        {cat.key === "gender" && "🚹🚫🚺 | What is your gender?"}
                        {cat.key === "age" && "| What's your age?"}
                        {cat.key === "device" && "💻📱⌨️ | What device do you use?"}
                      </p>
                      <p className="text-gray-400 text-xs mb-2">{cat.description}</p>
                      {catRoles.map(r => (
                        <p key={r.id} className="text-gray-300 text-xs">{r.emoji}  <span className="text-gray-500">→</span>  {r.label}</p>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </Layout>
  );
}
