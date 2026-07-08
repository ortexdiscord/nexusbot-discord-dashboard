import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { RolePicker } from "@/components/role-picker";
import { ChannelPicker } from "@/components/channel-picker";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useListReactionRoles, useCreateReactionRole, useDeleteReactionRole, getListReactionRolesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Send, Users, Smartphone, Calendar, Crown, MousePointer2, Layers } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SelfRole {
  id: number;
  guildId: string;
  category: string;
  emoji: string;
  label: string;
  roleId: string;
  roleName: string;
}

// ── Self-role categories ──────────────────────────────────────────────────────

const CATEGORIES = [
  {
    key: "gender",
    label: "Gender Roles",
    icon: Users,
    description: "Let members pick their gender identity role",
    gradient: "from-pink-500/20 to-blue-500/20",
    borderColor: "border-pink-500/30",
    image: "/gender-roles.png",
    imageAlt: "Gender Roles",
    defaults: [
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
    image: "/age-roles.png",
    imageAlt: "Age Roles",
    defaults: [
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
    image: "/device-roles.png",
    imageAlt: "Device Roles",
    defaults: [
      { emoji: "💻", label: "Desktop" },
      { emoji: "📱", label: "Mobile" },
      { emoji: "⌨️", label: "Both" },
    ],
  },
];

const RR_PRESETS = ["Gaming", "Pronouns", "Notifications", "Color Roles", "Regions", "Custom"];

// ── Hooks ─────────────────────────────────────────────────────────────────────

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

// ── Self-role sub-components ──────────────────────────────────────────────────

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
      onAdded();
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

function TemplateSendDialog({ guildId, category, imageFileName, disabled }: {
  guildId: string;
  category: string;
  imageFileName: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState("");
  const { toast } = useToast();

  const bannerImageUrl = `${window.location.origin}/${imageFileName}`;

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/self-roles/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, category, bannerImageUrl }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "Panel sent! ✅" });
      setOpen(false);
      setChannelId("");
    },
    onError: () => toast({ title: "Failed to send panel", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} className="gap-1.5">
          <Send className="size-3.5" />Send Panel
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Send Self-Role Panel</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <p className="text-sm text-muted-foreground">
            The bot will post a styled embed with your branded header image and emoji reactions to the selected channel.
          </p>
          {/* Preview */}
          <div className="rounded-lg border border-border/30 overflow-hidden bg-[#2b2d31]">
            <img src={`/${imageFileName}`} alt="Banner preview" className="w-full object-contain max-h-20 object-left" />
          </div>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <ChannelPicker value={channelId} onChange={setChannelId} />
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

// ── Reaction role form schema ──────────────────────────────────────────────────

const rrSchema = z.object({
  channelId: z.string().min(1, "Channel required"),
  messageId: z.string().min(1, "Message ID required"),
  emoji: z.string().min(1, "Emoji required"),
  roleId: z.string().min(1, "Role required"),
  roleName: z.string().min(1, "Role name required"),
  label: z.string().min(1, "Label required"),
  imageUrl: z.string().url().optional().or(z.literal("")),
  preset: z.string().optional(),
});
type RRForm = z.infer<typeof rrSchema>;

// ── Reaction Roles tab ────────────────────────────────────────────────────────

function ReactionRolesTab({ guildId }: { guildId: string }) {
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<RRForm | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: roles, isLoading } = useListReactionRoles(guildId, {
    query: { enabled: !!guildId, queryKey: getListReactionRolesQueryKey(guildId) }
  });
  const createRR = useCreateReactionRole();
  const deleteRR = useDeleteReactionRole();

  const form = useForm<RRForm>({
    resolver: zodResolver(rrSchema),
    defaultValues: { channelId: "", messageId: "", emoji: "", roleId: "", roleName: "", label: "", imageUrl: "", preset: "" },
  });

  const onSubmit = (data: RRForm) => {
    createRR.mutate({
      guildId,
      data: {
        channelId: data.channelId, messageId: data.messageId, emoji: data.emoji,
        roleId: data.roleId, roleName: data.roleName, label: data.label,
        imageUrl: data.imageUrl || null, preset: data.preset || null,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Reaction role created" });
        qc.invalidateQueries({ queryKey: getListReactionRolesQueryKey(guildId) });
        setOpen(false);
        form.reset();
        setShowPreview(false);
        setPreviewData(null);
      },
      onError: () => toast({ title: "Failed to create reaction role", variant: "destructive" }),
    });
  };

  const handlePreview = () => {
    const data = form.getValues();
    if (!rrSchema.safeParse(data).success) {
      toast({ title: "Fill all required fields first", variant: "destructive" });
      return;
    }
    setPreviewData(data);
    setShowPreview(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Assign roles when members react to a specific message</p>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); setShowPreview(false); setPreviewData(null); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="size-4 mr-2" />Add Reaction Role</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Reaction Role</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <ChannelPicker value={form.watch("channelId")} onChange={v => form.setValue("channelId", v, { shouldValidate: true })} />
                  {form.formState.errors.channelId && <p className="text-xs text-destructive">{form.formState.errors.channelId.message}</p>}
                </div>
                <FormField control={form.control} name="messageId" render={({ field }) => (
                  <FormItem><FormLabel>Message ID</FormLabel>
                    <FormControl><Input placeholder="Right-click message > Copy ID" {...field} /></FormControl>
                    <FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="emoji" render={({ field }) => (
                    <FormItem><FormLabel>Emoji</FormLabel>
                      <FormControl><Input placeholder="e.g. 🎮" {...field} /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="label" render={({ field }) => (
                    <FormItem><FormLabel>Label</FormLabel>
                      <FormControl><Input placeholder="Display label" {...field} /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <RolePicker
                    value={form.watch("roleId")}
                    onChange={v => form.setValue("roleId", v, { shouldValidate: true })}
                    onChangeWithName={(id, name) => {
                      form.setValue("roleId", id, { shouldValidate: true });
                      form.setValue("roleName", name, { shouldValidate: true });
                    }}
                  />
                  {form.formState.errors.roleId && <p className="text-xs text-destructive">{form.formState.errors.roleId.message}</p>}
                  <FormField control={form.control} name="roleName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Role name (auto-filled)</FormLabel>
                      <FormControl><Input placeholder="Role display name" {...field} /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="imageUrl" render={({ field }) => (
                  <FormItem><FormLabel>Image URL (optional)</FormLabel>
                    <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                    <FormMessage /></FormItem>
                )} />
                <div>
                  <label className="text-sm font-medium">Preset (optional)</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {RR_PRESETS.map(p => (
                      <button type="button" key={p} onClick={() => form.setValue("preset", form.watch("preset") === p ? "" : p)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.watch("preset") === p ? "bg-primary/20 border-primary/50 text-primary" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {showPreview && previewData && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">How it will look in Discord</p>
                    <div className="rounded-lg border border-border/30 overflow-hidden">
                      <div className="p-3 bg-[#2b2d31]">
                        <div className="flex items-center gap-2 mb-2">
                          {previewData.imageUrl ? (
                            <img src={previewData.imageUrl} alt="" className="size-8 rounded object-cover" />
                          ) : (
                            <div className="size-8 rounded bg-primary/10 flex items-center justify-center text-lg">{previewData.emoji}</div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">{previewData.label}</p>
                            <p className="text-xs text-[#949ba4]">React with {previewData.emoji} to get the role</p>
                          </div>
                        </div>
                        <p className="text-xs text-[#949ba4]">Role: {previewData.roleName}</p>
                        {previewData.preset && <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-400 mt-2">{previewData.preset}</Badge>}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="button" variant="secondary" size="sm" onClick={handlePreview}>
                    <Send className="size-3.5 mr-1.5" />Preview
                  </Button>
                  <Button type="submit" disabled={createRR.isPending} size="sm">
                    {createRR.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)
        ) : !roles?.length ? (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <MousePointer2 className="size-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No reaction roles configured yet</p>
          </div>
        ) : roles.map(rr => (
          <Card key={rr.id} className="border-border/50 bg-card/50 hover:bg-card/80 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {rr.imageUrl ? (
                    <img src={rr.imageUrl} alt={rr.label} className="size-10 rounded-lg object-cover" />
                  ) : (
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">{rr.emoji}</div>
                  )}
                  <div>
                    <p className="font-medium text-sm">{rr.label}</p>
                    <p className="text-xs text-muted-foreground">{rr.roleName}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive -mt-1 -mr-1"
                  onClick={() => deleteRR.mutate({ guildId, id: rr.id }, {
                    onSuccess: () => {
                      toast({ title: "Reaction role deleted" });
                      qc.invalidateQueries({ queryKey: getListReactionRolesQueryKey(guildId) });
                    }
                  })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {rr.preset && <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-400">{rr.preset}</Badge>}
              <div className="mt-2 text-xs text-muted-foreground truncate">Msg: {rr.messageId}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Premium Templates tab ─────────────────────────────────────────────────────

function TemplatesTab({ guildId }: { guildId: string }) {
  const { data: allRoles, isLoading } = useSelfRoles(guildId);
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
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Pre-built self-role panels with branded header images. Configure the roles for each category then send the panel to your server.
      </p>

      {CATEGORIES.map(cat => {
        const catRoles = allRoles?.filter(r => r.category === cat.key) ?? [];

        return (
          <div key={cat.key} className={`rounded-xl border ${cat.borderColor} bg-gradient-to-br ${cat.gradient} overflow-hidden`}>
            {/* Branded header image */}
            <div className="bg-black/40 px-5 pt-4 pb-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <img
                  src={cat.image}
                  alt={cat.imageAlt}
                  className="h-10 object-contain object-left mb-2"
                />
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
                  <Crown className="size-3" />Premium Template
                </Badge>
                <div className="flex gap-2">
                  <AddRoleDialog guildId={guildId} category={cat.key} defaults={cat.defaults} onAdded={() => {}} />
                  <TemplateSendDialog
                    guildId={guildId}
                    category={cat.key}
                    imageFileName={cat.image.replace("/", "")}
                    disabled={catRoles.length === 0}
                  />
                </div>
              </div>
            </div>

            {/* Roles list */}
            <div className="px-5 py-4">
              {isLoading ? (
                <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              ) : catRoles.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border border-dashed border-border/40 rounded-lg">
                  <cat.icon className="size-6 mx-auto mb-1.5 opacity-30" />
                  <p className="text-xs">No roles added yet — click "Add Role" to configure</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {catRoles.map(role => (
                    <div key={role.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/30 px-3 py-2.5">
                      <span className="text-xl">{role.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{role.label}</p>
                        <Badge variant="outline" className="text-xs mt-0.5">{role.roleName}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteRole.mutate(role.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoleManagement() {
  const { guildId } = useParams<{ guildId: string }>();

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Layers className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Role Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Premium self-role templates and custom reaction roles</p>
          </div>
        </div>

        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList className="bg-card/50 border border-border/50">
            <TabsTrigger value="templates" className="gap-2">
              <Crown className="size-3.5 text-yellow-500" />Templates
            </TabsTrigger>
            <TabsTrigger value="reaction-roles" className="gap-2">
              <MousePointer2 className="size-3.5" />Reaction Roles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-0">
            <TemplatesTab guildId={guildId!} />
          </TabsContent>

          <TabsContent value="reaction-roles" className="mt-0">
            <ReactionRolesTab guildId={guildId!} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
