import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { ChannelPicker } from "@/components/channel-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Send, FileText, GripVertical, X } from "lucide-react";

interface Question {
  id: string;
  question: string;
  required: boolean;
}

interface Application {
  id: number;
  guildId: string;
  title: string;
  description: string;
  questions: Question[];
  responseChannelId: string | null;
  panelChannelId: string | null;
  panelMessageId: string | null;
  enabled: boolean;
  color: string;
}

function CreateAppDialog({ guildId, onCreated }: { guildId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#7C3AED");
  const [responseChannelId, setResponseChannelId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([
    { id: crypto.randomUUID(), question: "", required: true },
  ]);
  const { toast } = useToast();
  const qc = useQueryClient();

  const addQ = () => setQuestions(q => [...q, { id: crypto.randomUUID(), question: "", required: true }]);
  const removeQ = (id: string) => setQuestions(q => q.filter(x => x.id !== id));
  const updateQ = (id: string, text: string) => setQuestions(q => q.map(x => x.id === id ? { ...x, question: text } : x));

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, questions: questions.filter(q => q.question.trim()), responseChannelId: responseChannelId || null, color }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications", guildId] });
      toast({ title: "Application created!" });
      setOpen(false);
      setTitle(""); setDescription(""); setQuestions([{ id: crypto.randomUUID(), question: "", required: true }]);
      onCreated();
    },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="size-3.5" />New Application</Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Application Template</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Application Title</Label>
            <Input placeholder="e.g. Staff Application" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(shown on the panel)</span></Label>
            <Textarea placeholder="What is this application for?" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Response Channel <span className="text-muted-foreground text-xs">(where answers are posted)</span></Label>
            <ChannelPicker value={responseChannelId} onChange={setResponseChannelId} placeholder="Select channel" />
          </div>
          <div className="flex items-center gap-3">
            <Label>Color</Label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer border-0" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Questions <span className="text-muted-foreground text-xs">(max 5 for Discord modals)</span></Label>
              <Button variant="outline" size="sm" onClick={addQ} disabled={questions.length >= 5} className="h-7 px-2 text-xs">
                <Plus className="size-3 mr-1" />Add
              </Button>
            </div>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={q.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                  <Input
                    placeholder={`Question ${i + 1}`}
                    value={q.question}
                    onChange={e => updateQ(q.id, e.target.value)}
                    className="flex-1"
                  />
                  {questions.length > 1 && (
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeQ(q.id)}>
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => create.mutate()} disabled={!title.trim() || create.isPending}>
              {create.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SendPanelDialog({ guildId, app }: { guildId: string; app: Application }) {
  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState(app.panelChannelId ?? "");
  const { toast } = useToast();
  const qc = useQueryClient();

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/applications/${app.id}/send-panel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications", guildId] });
      toast({ title: "Panel sent! ✅" });
      setOpen(false);
    },
    onError: () => toast({ title: "Failed to send panel", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Send className="size-3.5" />Send Panel</Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Send Application Panel</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <p className="text-sm text-muted-foreground">Bot will post an embed with an "Apply Now" button to the selected channel.</p>
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

export default function ApplicationsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: apps, isLoading } = useQuery<Application[]>({
    queryKey: ["applications", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/applications`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });

  const deleteApp = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/guilds/${guildId}/applications/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications", guildId] });
      toast({ title: "Application deleted" });
    },
  });

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Applications</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create application forms members fill out via Discord</p>
          </div>
          <CreateAppDialog guildId={guildId!} onCreated={() => {}} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : !apps?.length ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-xl">
            <FileText className="size-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No application templates yet</p>
            <p className="text-xs mt-1 opacity-60">Create one to start collecting applications from your members</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {apps.map(app => (
              <Card key={app.id} className="border-border/50 bg-card/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: `${app.color}20`, border: `1px solid ${app.color}40` }}>
                        <FileText className="size-4" style={{ color: app.color }} />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{app.title}</CardTitle>
                        <div className="flex gap-1 mt-0.5">
                          <Badge variant="outline" className="text-xs">{(app.questions as any[])?.length ?? 0} questions</Badge>
                          {app.panelMessageId && <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">Live</Badge>}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteApp.mutate(app.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {app.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{app.description}</p>}

                  {/* Questions preview */}
                  <div className="space-y-1 mb-3">
                    {(app.questions as Question[]).slice(0, 3).map((q, i) => (
                      <div key={q.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                        <span className="truncate">{q.question}</span>
                      </div>
                    ))}
                    {(app.questions as Question[]).length > 3 && (
                      <p className="text-xs text-muted-foreground/60 pl-4">+{(app.questions as Question[]).length - 3} more</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <SendPanelDialog guildId={guildId!} app={app} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
