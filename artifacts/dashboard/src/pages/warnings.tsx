import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListWarnings, useCreateWarning, useDeleteWarning, getListWarningsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const warnSchema = z.object({
  userId: z.string().min(1, "User ID required"),
  username: z.string().min(1, "Username required"),
  reason: z.string().min(1, "Reason required"),
});
type WarnForm = z.infer<typeof warnSchema>;

export default function Warnings() {
  const { guildId } = useParams<{ guildId: string }>();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: warnings, isLoading } = useListWarnings(guildId!, {
    query: { enabled: !!guildId, queryKey: getListWarningsQueryKey(guildId!) }
  });
  const createWarning = useCreateWarning();
  const deleteWarning = useDeleteWarning();

  const form = useForm<WarnForm>({
    resolver: zodResolver(warnSchema),
    defaultValues: { userId: "", username: "", reason: "" },
  });

  const onSubmit = (data: WarnForm) => {
    createWarning.mutate({
      guildId: guildId!,
      data: { ...data, moderatorId: "system", moderatorUsername: "Dashboard" }
    }, {
      onSuccess: () => {
        toast({ title: "Warning issued" });
        qc.invalidateQueries({ queryKey: getListWarningsQueryKey(guildId!) });
        setOpen(false);
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-warning">
                <Plus className="size-4 mr-2" />Issue Warning
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Issue Warning</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="userId" render={({ field }) => (
                    <FormItem><FormLabel>User ID</FormLabel>
                      <FormControl><Input placeholder="Discord User ID" {...field} data-testid="input-warn-userId" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem><FormLabel>Username</FormLabel>
                      <FormControl><Input placeholder="Username" {...field} data-testid="input-warn-username" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
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
      </div>
    </Layout>
  );
}
