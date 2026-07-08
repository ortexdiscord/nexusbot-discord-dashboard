import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { ChannelPicker } from "@/components/channel-picker";
import { useListPolls, useCreatePoll, useClosePoll, getListPollsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BarChart2, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DiscordEmbedPreview } from "@/components/discord-embed-preview";

const pollSchema = z.object({
  channelId: z.string().min(1, "Channel required"),
  question: z.string().min(1, "Question required"),
  endsAt: z.string().optional(),
});
type PollForm = z.infer<typeof pollSchema>;

export default function Polls() {
  const { guildId } = useParams<{ guildId: string }>();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: polls, isLoading } = useListPolls(guildId!, {
    query: { enabled: !!guildId, queryKey: getListPollsQueryKey(guildId!) }
  });
  const createPoll = useCreatePoll();
  const closePoll = useClosePoll();

  const form = useForm<PollForm>({
    resolver: zodResolver(pollSchema),
    defaultValues: { channelId: "", question: "", endsAt: "" },
  });

  const POLL_EMOJIS = ["1\ufe0f\u20e3", "2\ufe0f\u20e3", "3\ufe0f\u20e3", "4\ufe0f\u20e3", "5\ufe0f\u20e3", "6\ufe0f\u20e3", "7\ufe0f\u20e3", "8\ufe0f\u20e3", "9\ufe0f\u20e3", "\ud83d\udd1f"];

  const onSubmit = (data: PollForm) => {
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) {
      toast({ title: "Need at least 2 options", variant: "destructive" });
      return;
    }
    createPoll.mutate({
      guildId: guildId!,
      data: { channelId: data.channelId, question: data.question, options: validOptions, endsAt: data.endsAt || null }
    }, {
      onSuccess: () => {
        toast({ title: "Poll created" });
        qc.invalidateQueries({ queryKey: getListPollsQueryKey(guildId!) });
        setOpen(false);
        setShowPreview(false);
        form.reset();
        setOptions(["", ""]);
      }
    });
  };

  const handleClose = (id: number) => {
    closePoll.mutate({ guildId: guildId!, id }, {
      onSuccess: () => {
        toast({ title: "Poll closed" });
        qc.invalidateQueries({ queryKey: getListPollsQueryKey(guildId!) });
      }
    });
  };

  const getPreviewOptions = () => {
    const valid = options.filter(o => o.trim());
    return valid.length >= 2 ? valid.map((text, i) => ({ emoji: POLL_EMOJIS[i] || String(i + 1), text, votes: 0 })) : [
      { emoji: "1\ufe0f\u20e3", text: "Option 1", votes: 0 },
      { emoji: "2\ufe0f\u20e3", text: "Option 2", votes: 0 },
    ];
  };

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Polls</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create and manage community polls</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-poll"><Plus className="size-4 mr-2" />Create Poll</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Poll</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <ChannelPicker value={form.watch("channelId")} onChange={v => form.setValue("channelId", v)} />
                    {form.formState.errors.channelId && <p className="text-xs text-destructive">{form.formState.errors.channelId.message}</p>}
                  </div>
                  <FormField control={form.control} name="question" render={({ field }) => (
                    <FormItem><FormLabel>Question</FormLabel>
                      <FormControl><Input placeholder="What's your favorite game?" {...field} data-testid="input-poll-question" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <div className="space-y-2">
                    <Label>Options (2-10)</Label>
                    {options.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="flex items-center justify-center w-6 text-xs text-muted-foreground shrink-0">{POLL_EMOJIS[i]}</span>
                        <Input value={opt} onChange={e => {
                          const next = [...options]; next[i] = e.target.value; setOptions(next);
                        }} placeholder={`Option ${i + 1}`} data-testid={`input-poll-option-${i}`} />
                        {options.length > 2 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))}>
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {options.length < 10 && (
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOptions(prev => [...prev, ""])} data-testid="button-add-option">
                        <Plus className="size-4 mr-2" />Add Option
                      </Button>
                    )}
                  </div>
                  <FormField control={form.control} name="endsAt" render={({ field }) => (
                    <FormItem><FormLabel>End Time (optional)</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} data-testid="input-poll-ends" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />

                  {showPreview && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Preview</p>
                      <DiscordEmbedPreview
                        color="#7C3AED"
                        title={`\ud83d\udcca ${form.watch("question") || "Poll Question"}`}
                        description={getPreviewOptions().map(o => `${o.emoji} **${o.text}**`).join("\n")}
                        footer="React to vote!"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => {
                      if (options.filter(o => o.trim()).length < 2) {
                        toast({ title: "Need at least 2 options", variant: "destructive" }); return;
                      }
                      setShowPreview(true);
                    }}>Preview</Button>
                    <Button type="submit" disabled={createPoll.isPending} size="sm" data-testid="button-submit-poll">
                      {createPoll.isPending ? "Creating..." : "Create Poll"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            [1,2].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)
          ) : !polls?.length ? (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <BarChart2 className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No polls yet</p>
            </div>
          ) : polls.map(poll => {
            const totalVotes = poll.options.reduce((acc, o) => acc + o.votes, 0);
            return (
              <Card key={poll.id} className="border-border/50 bg-card/50" data-testid={`card-poll-${poll.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium leading-snug">{poll.question}</CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={poll.active ? "border-green-500/30 text-green-400" : "text-muted-foreground"}>
                        {poll.active ? "Active" : "Closed"}
                      </Badge>
                      {poll.active && (
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => handleClose(poll.id)} data-testid={`button-close-poll-${poll.id}`}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{totalVotes} votes total</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {poll.options.map((opt, i) => {
                    const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5"><span>{opt.emoji}</span>{opt.text}</span>
                          <span className="text-muted-foreground">{pct}% ({opt.votes})</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    );
                  })}
                  {poll.endsAt && (
                    <p className="text-xs text-muted-foreground pt-1">Ends {new Date(poll.endsAt).toLocaleString()}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
