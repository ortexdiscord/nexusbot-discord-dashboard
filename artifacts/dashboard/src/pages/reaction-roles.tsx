import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { ChannelPicker } from "@/components/channel-picker";
import { RolePicker } from "@/components/role-picker";
import { useListReactionRoles, useCreateReactionRole, useDeleteReactionRole, getListReactionRolesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MousePointer2, Plus, Trash2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PRESETS = ["Gaming", "Pronouns", "Notifications", "Color Roles", "Regions", "Custom"];

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

export default function ReactionRoles() {
  const { guildId } = useParams<{ guildId: string }>();
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<RRForm | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: roles, isLoading } = useListReactionRoles(guildId!, {
    query: { enabled: !!guildId, queryKey: getListReactionRolesQueryKey(guildId!) }
  });
  const createRR = useCreateReactionRole();
  const deleteRR = useDeleteReactionRole();

  const form = useForm<RRForm>({
    resolver: zodResolver(rrSchema),
    defaultValues: { channelId: "", messageId: "", emoji: "", roleId: "", roleName: "", label: "", imageUrl: "", preset: "" },
  });

  const onSubmit = (data: RRForm) => {
    createRR.mutate({
      guildId: guildId!,
      data: {
        channelId: data.channelId, messageId: data.messageId, emoji: data.emoji,
        roleId: data.roleId, roleName: data.roleName, label: data.label,
        imageUrl: data.imageUrl || null, preset: data.preset || null,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Reaction role created" });
        qc.invalidateQueries({ queryKey: getListReactionRolesQueryKey(guildId!) });
        setOpen(false);
        form.reset();
        setShowPreview(false);
        setPreviewData(null);
      },
      onError: () => {
        toast({ title: "Failed to create reaction role", variant: "destructive" });
      },
    });
  };

  const handlePreview = () => {
    const data = form.getValues();
    const valid = rrSchema.safeParse(data);
    if (!valid.success) {
      toast({ title: "Fill all required fields first", variant: "destructive" });
      return;
    }
    setPreviewData(data);
    setShowPreview(true);
  };

  const handleDelete = (id: number) => {
    deleteRR.mutate({ guildId: guildId!, id }, {
      onSuccess: () => {
        toast({ title: "Reaction role deleted" });
        qc.invalidateQueries({ queryKey: getListReactionRolesQueryKey(guildId!) });
      }
    });
  };

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Reaction Roles</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Let users self-assign roles via reactions</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); setShowPreview(false); setPreviewData(null); } }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-rr"><Plus className="size-4 mr-2" />Add Reaction Role</Button>
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
                      <FormControl><Input placeholder="Right-click message > Copy ID" {...field} data-testid="input-rr-messageId" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="emoji" render={({ field }) => (
                      <FormItem><FormLabel>Emoji</FormLabel>
                        <FormControl><Input placeholder="e.g. 🎮" {...field} data-testid="input-rr-emoji" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="label" render={({ field }) => (
                      <FormItem><FormLabel>Label</FormLabel>
                        <FormControl><Input placeholder="Display label" {...field} data-testid="input-rr-label" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    {/* onChangeWithName auto-fills roleName when a role is picked */}
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
                        <FormLabel className="text-xs text-muted-foreground">Role display name (auto-filled)</FormLabel>
                        <FormControl><Input placeholder="Role display name" {...field} data-testid="input-rr-roleName" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="imageUrl" render={({ field }) => (
                    <FormItem><FormLabel>Image URL (optional)</FormLabel>
                      <FormControl><Input placeholder="https://..." {...field} data-testid="input-rr-imageUrl" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <div>
                    <label className="text-sm font-medium">Preset (optional)</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {PRESETS.map(p => (
                        <button type="button" key={p} onClick={() => form.setValue("preset", form.watch("preset") === p ? "" : p)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.watch("preset") === p ? "bg-primary/20 border-primary/50 text-primary" : "border-border/50 text-muted-foreground hover:border-border"}`}
                          data-testid={`badge-preset-${p}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview Section */}
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
                    <Button type="submit" disabled={createRR.isPending} size="sm" data-testid="button-submit-rr">
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
            [1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)
          ) : !roles?.length ? (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <MousePointer2 className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No reaction roles configured yet</p>
            </div>
          ) : roles.map(rr => (
            <Card key={rr.id} className="border-border/50 bg-card/50 hover:bg-card/80 transition-colors" data-testid={`card-rr-${rr.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {rr.imageUrl ? (
                      <img src={rr.imageUrl} alt={rr.label} className="size-10 rounded-lg object-cover" />
                    ) : (
                      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
                        {rr.emoji}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{rr.label}</p>
                      <p className="text-xs text-muted-foreground">{rr.roleName}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive -mt-1 -mr-1"
                    onClick={() => handleDelete(rr.id)} data-testid={`button-delete-rr-${rr.id}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {rr.preset && <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-400">{rr.preset}</Badge>}
                <div className="mt-2 text-xs text-muted-foreground truncate">
                  Msg: {rr.messageId}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
