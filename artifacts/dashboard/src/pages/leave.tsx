import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { ChannelPicker } from "@/components/channel-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Image, Eye, RefreshCw } from "lucide-react";
import { DiscordEmbedPreview } from "@/components/discord-embed-preview";
import { useDirtyState } from "@/hooks/use-dirty-state";
import { UnsavedChangesBadge } from "@/components/unsaved-changes-badge";

interface LeaveConfig {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  message: string;
  embedEnabled: boolean;
  embedColor: string;
  embedTitle: string | null;
  embedDescription: string | null;
  imageCardEnabled: boolean;
  imageCardBgUrl: string | null;
  imageCardText: string | null;
  imageCardSubtext: string | null;
}

export default function Leave() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery<LeaveConfig>({
    queryKey: ["leave-config", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/leave`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: async (data: Partial<LeaveConfig>) => {
      const res = await fetch(`/api/guilds/${guildId}/leave`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Leave message saved" });
      qc.invalidateQueries({ queryKey: ["leave-config", guildId] });
      markSaved(snapshot);
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [message, setMessage] = useState("Goodbye, {user}! We hope to see you again.");
  const [embedEnabled, setEmbedEnabled] = useState(false);
  const [embedColor, setEmbedColor] = useState("#7C3AED");
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedDescription, setEmbedDescription] = useState("");
  // Image card
  const [imageCardEnabled, setImageCardEnabled] = useState(false);
  const [imageCardBgUrl, setImageCardBgUrl] = useState("");
  const [imageCardText, setImageCardText] = useState("Goodbye, {user}!");
  const [imageCardSubtext, setImageCardSubtext] = useState("We now have {count} members");
  const [previewKey, setPreviewKey] = useState(0);

  const snapshot = {
    enabled, channelId: channelId || null, message, embedEnabled, embedColor,
    embedTitle: embedTitle || null, embedDescription: embedDescription || null,
    imageCardEnabled, imageCardBgUrl: imageCardBgUrl || null,
    imageCardText: imageCardText || null, imageCardSubtext: imageCardSubtext || null,
  };
  const { isDirty, markSaved } = useDirtyState(snapshot);

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setChannelId(config.channelId ?? "");
      setMessage(config.message);
      setEmbedEnabled(config.embedEnabled);
      setEmbedColor(config.embedColor);
      setEmbedTitle(config.embedTitle ?? "");
      setEmbedDescription(config.embedDescription ?? "");
      setImageCardEnabled(config.imageCardEnabled);
      setImageCardBgUrl(config.imageCardBgUrl ?? "");
      setImageCardText(config.imageCardText ?? "Goodbye, {user}!");
      setImageCardSubtext(config.imageCardSubtext ?? "We now have {count} members");
      markSaved({
        enabled: config.enabled, channelId: config.channelId ?? null, message: config.message,
        embedEnabled: config.embedEnabled, embedColor: config.embedColor,
        embedTitle: config.embedTitle ?? null, embedDescription: config.embedDescription ?? null,
        imageCardEnabled: config.imageCardEnabled, imageCardBgUrl: config.imageCardBgUrl ?? null,
        imageCardText: config.imageCardText ?? "Goodbye, {user}!",
        imageCardSubtext: config.imageCardSubtext ?? "We now have {count} members",
      });
    }
  }, [config]);

  const handleSave = () => {
    mutation.mutate(snapshot);
  };

  const previewCardUrl = `/api/guilds/${guildId}/leave/preview-card?username=LeavingMember&serverName=Your+Server&count=1233&text=${encodeURIComponent(imageCardText)}&subtext=${encodeURIComponent(imageCardSubtext)}${imageCardBgUrl ? `&bgUrl=${encodeURIComponent(imageCardBgUrl)}` : ""}&_k=${previewKey}`;

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Leave Messages</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Send a message when a member leaves</p>
          </div>
          <div className="flex items-center gap-3">
            <UnsavedChangesBadge show={isDirty && !mutation.isPending} />
            <Button onClick={handleSave} disabled={mutation.isPending || isLoading || !isDirty} size="sm">
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : (
          <div className="space-y-4">
            {/* Basic message */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Leave Messages Enabled</CardTitle>
                    <CardDescription>Send a message when someone leaves the server</CardDescription>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <ChannelPicker value={channelId} onChange={setChannelId} />
                </div>
                <div className="space-y-2">
                  <Label>Leave Message</Label>
                  <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Goodbye message..." />
                  <p className="text-xs text-muted-foreground">
                    Variables: <code className="bg-primary/10 px-1 rounded">{"{user}"}</code> = username,{" "}
                    <code className="bg-primary/10 px-1 rounded">{"{server}"}</code> = server name,{" "}
                    <code className="bg-primary/10 px-1 rounded">{"{count}"}</code> = member count
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Embed */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Leave Embed</CardTitle>
                    <CardDescription>Send a styled embed instead of a plain message</CardDescription>
                  </div>
                  <Switch checked={embedEnabled} onCheckedChange={v => { setEmbedEnabled(v); if (v) setImageCardEnabled(false); }} />
                </div>
              </CardHeader>
              {embedEnabled && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Embed Color</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={embedColor} onChange={e => setEmbedColor(e.target.value)}
                        className="size-10 rounded cursor-pointer border border-border/50 bg-transparent" />
                      <Input value={embedColor} onChange={e => setEmbedColor(e.target.value)} className="font-mono" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Embed Title (optional)</Label>
                    <Input value={embedTitle} onChange={e => setEmbedTitle(e.target.value)} placeholder="Goodbye, {user}!" />
                  </div>
                  <div className="space-y-2">
                    <Label>Embed Description (optional)</Label>
                    <Textarea value={embedDescription} onChange={e => setEmbedDescription(e.target.value)} rows={3} placeholder="We'll miss you..." />
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Preview</p>
                    <DiscordEmbedPreview
                      color={embedColor}
                      title={embedTitle || undefined}
                      description={(embedDescription || message)
                        .replace("{user}", "Username")
                        .replace("{server}", "Server")
                        .replace("{count}", "1,234")}
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Image Card */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2"><Image className="size-4 text-destructive" />Leave Image Card</CardTitle>
                    <CardDescription>Generate a custom image card when members leave</CardDescription>
                  </div>
                  <Switch checked={imageCardEnabled} onCheckedChange={v => { setImageCardEnabled(v); if (v) setEmbedEnabled(false); }} />
                </div>
              </CardHeader>
              {imageCardEnabled && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Main Text</Label>
                    <Input value={imageCardText} onChange={e => setImageCardText(e.target.value)} placeholder="Goodbye, {user}!" />
                    <p className="text-xs text-muted-foreground">Variables: {"{user}"} = username, {"{server}"} = server name, {"{count}"} = member count</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sub Text</Label>
                    <Input value={imageCardSubtext} onChange={e => setImageCardSubtext(e.target.value)} placeholder="We now have {count} members" />
                  </div>
                  <div className="space-y-2">
                    <Label>Background Image URL (optional)</Label>
                    <Input value={imageCardBgUrl} onChange={e => setImageCardBgUrl(e.target.value)} placeholder="https://example.com/background.jpg" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Eye className="size-3.5" />Card Preview</p>
                      <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setPreviewKey(k => k + 1)}>
                        <RefreshCw className="size-3" />Refresh
                      </Button>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-border/40 bg-[#313338]">
                      <img
                        key={previewKey}
                        src={previewCardUrl}
                        alt="Leave card preview"
                        className="w-full"
                        onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }}
                      />
                      <p className="hidden p-4 text-sm text-muted-foreground text-center">Preview unavailable — ensure @napi-rs/canvas is installed.</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5">
                    <DoorOpen className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Bot Event: GuildMemberRemove</p>
                    <p className="text-xs text-muted-foreground">The bot listens for member leave events and sends this message automatically</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
