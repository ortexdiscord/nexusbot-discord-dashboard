import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { ChannelPicker } from "@/components/channel-picker";
import { useListReminders, useCreateReminder, useDeleteReminder, getListRemindersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Clock, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const reminderSchema = z.object({
  channelId: z.string().min(1, "Channel required"),
  userId: z.string().min(1, "User ID required"),
  message: z.string().min(1, "Message required"),
  scheduledAt: z.string().min(1, "Date/time required"),
});
type ReminderForm = z.infer<typeof reminderSchema>;

export default function Reminders() {
  const { guildId } = useParams<{ guildId: string }>();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: reminders, isLoading } = useListReminders(guildId!, {
    query: { enabled: !!guildId, queryKey: getListRemindersQueryKey(guildId!) }
  });
  const createReminder = useCreateReminder();
  const deleteReminder = useDeleteReminder();

  const form = useForm<ReminderForm>({
    resolver: zodResolver(reminderSchema),
    defaultValues: { channelId: "", userId: "", message: "", scheduledAt: "" },
  });

  const onSubmit = (data: ReminderForm) => {
    createReminder.mutate({ guildId: guildId!, data }, {
      onSuccess: () => {
        toast({ title: "Reminder created" });
        qc.invalidateQueries({ queryKey: getListRemindersQueryKey(guildId!) });
        setOpen(false);
        form.reset();
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteReminder.mutate({ guildId: guildId!, id }, {
      onSuccess: () => {
        toast({ title: "Reminder deleted" });
        qc.invalidateQueries({ queryKey: getListRemindersQueryKey(guildId!) });
      }
    });
  };

  const now = new Date();
  const pending = reminders?.filter(r => !r.sent && new Date(r.scheduledAt) > now) ?? [];
  const past = reminders?.filter(r => r.sent || new Date(r.scheduledAt) <= now) ?? [];

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Reminders</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Schedule messages for later</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-reminder"><Plus className="size-4 mr-2" />Add Reminder</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader><DialogTitle>Create Reminder</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <ChannelPicker value={form.watch("channelId")} onChange={v => form.setValue("channelId", v)} />
                    {form.formState.errors.channelId && <p className="text-xs text-destructive">{form.formState.errors.channelId.message}</p>}
                  </div>
                  <FormField control={form.control} name="userId" render={({ field }) => (
                    <FormItem><FormLabel>User ID</FormLabel>
                      <FormControl><Input placeholder="User ID to ping" {...field} data-testid="input-reminder-user" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="message" render={({ field }) => (
                    <FormItem><FormLabel>Message</FormLabel>
                      <FormControl><Textarea placeholder="Reminder message..." rows={3} {...field} data-testid="input-reminder-message" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                    <FormItem><FormLabel>Scheduled At</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} data-testid="input-reminder-time" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createReminder.isPending} size="sm" data-testid="button-submit-reminder">
                      {createReminder.isPending ? "Scheduling..." : "Schedule"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
          ) : !reminders?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No reminders scheduled</p>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Upcoming ({pending.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {pending.map(r => (
                        <div key={r.id} className="flex items-center gap-4 rounded-lg border border-border/30 bg-background/30 px-4 py-3" data-testid={`row-reminder-${r.id}`}>
                          <Clock className="size-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.message}</p>
                            <p className="text-xs text-muted-foreground">{new Date(r.scheduledAt).toLocaleString()}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(r.id)} data-testid={`button-delete-reminder-${r.id}`}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {past.length > 0 && (
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="pb-2"><CardTitle className="text-base text-muted-foreground">Past ({past.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {past.map(r => (
                        <div key={r.id} className="flex items-center gap-4 rounded-lg border border-border/30 bg-background/20 px-4 py-3 opacity-60" data-testid={`row-reminder-past-${r.id}`}>
                          <Clock className="size-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{r.message}</p>
                            <p className="text-xs text-muted-foreground">{new Date(r.scheduledAt).toLocaleString()}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{r.sent ? "Sent" : "Expired"}</Badge>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(r.id)} data-testid={`button-delete-past-${r.id}`}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
