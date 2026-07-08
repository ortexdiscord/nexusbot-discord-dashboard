import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListCustomCommands, useCreateCustomCommand, useUpdateCustomCommand, useDeleteCustomCommand, getListCustomCommandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Terminal, Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const cmdSchema = z.object({
  trigger: z.string().min(1, "Trigger required"),
  response: z.string().min(1, "Response required"),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
});
type CmdForm = z.infer<typeof cmdSchema>;

export default function Commands() {
  const { guildId } = useParams<{ guildId: string }>();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: commands, isLoading } = useListCustomCommands(guildId!, {
    query: { enabled: !!guildId, queryKey: getListCustomCommandsQueryKey(guildId!) }
  });
  const createCmd = useCreateCustomCommand();
  const updateCmd = useUpdateCustomCommand();
  const deleteCmd = useDeleteCustomCommand();

  const form = useForm<CmdForm>({
    resolver: zodResolver(cmdSchema),
    defaultValues: { trigger: "", response: "", description: "", enabled: true },
  });

  const openCreate = () => { setEditingId(null); form.reset(); setOpen(true); };
  const openEdit = (cmd: typeof commands extends (infer T)[] | undefined ? T : never) => {
    if (!cmd) return;
    setEditingId((cmd as any).id);
    form.reset({ trigger: (cmd as any).trigger, response: (cmd as any).response, description: (cmd as any).description ?? "", enabled: (cmd as any).enabled });
    setOpen(true);
  };

  const onSubmit = (data: CmdForm) => {
    const afterSuccess = () => {
      toast({ title: editingId ? "Command updated" : "Command created" });
      qc.invalidateQueries({ queryKey: getListCustomCommandsQueryKey(guildId!) });
      setOpen(false);
    };
    if (editingId) {
      updateCmd.mutate({ guildId: guildId!, id: editingId, data }, { onSuccess: afterSuccess });
    } else {
      createCmd.mutate({ guildId: guildId!, data }, { onSuccess: afterSuccess });
    }
  };

  const handleDelete = (id: number) => {
    deleteCmd.mutate({ guildId: guildId!, id }, {
      onSuccess: () => {
        toast({ title: "Command deleted" });
        qc.invalidateQueries({ queryKey: getListCustomCommandsQueryKey(guildId!) });
      }
    });
  };

  const handleToggle = (cmd: any) => {
    updateCmd.mutate({ guildId: guildId!, id: cmd.id, data: { enabled: !cmd.enabled } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListCustomCommandsQueryKey(guildId!) })
    });
  };

  return (
    <Layout guildId={guildId}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Custom Commands</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create trigger/response command pairs</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate} data-testid="button-add-cmd"><Plus className="size-4 mr-2" />Add Command</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>{editingId ? "Edit" : "Create"} Command</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="trigger" render={({ field }) => (
                    <FormItem><FormLabel>Trigger</FormLabel>
                      <FormControl><Input placeholder="!help" {...field} data-testid="input-cmd-trigger" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="response" render={({ field }) => (
                    <FormItem><FormLabel>Response</FormLabel>
                      <FormControl><Textarea placeholder="Bot response..." rows={3} {...field} data-testid="input-cmd-response" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description (optional)</FormLabel>
                      <FormControl><Input placeholder="What this command does" {...field} data-testid="input-cmd-desc" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createCmd.isPending || updateCmd.isPending} data-testid="button-submit-cmd">
                      {editingId ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Commands ({commands?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
            ) : !commands?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Terminal className="size-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No custom commands yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {commands.map(cmd => (
                  <div key={cmd.id} className="flex items-center gap-4 rounded-lg border border-border/30 bg-background/30 px-4 py-3" data-testid={`row-cmd-${cmd.id}`}>
                    <Switch checked={cmd.enabled} onCheckedChange={() => handleToggle(cmd)} data-testid={`switch-cmd-${cmd.id}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">{cmd.trigger}</code>
                        {!cmd.enabled && <Badge variant="outline" className="text-xs text-muted-foreground">Disabled</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{cmd.response}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(cmd)} data-testid={`button-edit-cmd-${cmd.id}`}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(cmd.id)} data-testid={`button-delete-cmd-${cmd.id}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
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
