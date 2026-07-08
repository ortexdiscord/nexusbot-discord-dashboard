import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { ChannelPicker } from "@/components/channel-picker";
import { RolePicker } from "@/components/role-picker";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Image, Eye, RefreshCw, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DiscordEmbedPreview } from "@/components/discord-embed-preview";
import { useDirtyState } from "@/hooks/use-dirty-state";
import { UnsavedChangesBadge } from "@/components/unsaved-changes-badge";

interface WelcomeConfig {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  message: string;
  embedEnabled: boolean;
  embedColor: string;
  embedTitle: string | null;
  embedDescription: string | null;
  assignRoleId: string | null;
  imageCardEnabled: boolean;
  imageCardBgUrl: string | null;
  imageCardText: string | null;
  imageCardSubtext: string | null;
  dmEnabled: boolean;
  dmMessage: string | null;
}

export default function Welcome() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery<WelcomeConfig>({
    queryKey: ["welcome-config", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/welcome`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!guildId,
  });

  const updateWelcome = useMutation({
    mutationFn: async (data: Partial<WelcomeConfig>) => {
      const res = await fetch(`/api/guilds/${guildId}/welcome`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Welcome config saved" });
      qc.invalidateQueries({ queryKey: ["welcome-config", guildId] });
      markSaved(snapshot);
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [message, setMessage] = useState("Welcome to the server, {user}!");
  const [embedEnabled, setEmbedEnabled] = useState(false);
  const [embedColor, setEmbedColor] = useState("#7C3AED");
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedDescription, setEmbedDescription] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  // Image card
  const [imageCardEnabled, setImageCardEnabled] = useState(false);
  const [imageCardBgUrl, setImageCardBgUrl] = useState("");
  const [imageCardText, setImageCardText] = useState("Welcome, {user}!");
  const [imageCardSubtext, setImageCardSubtext] = useState("Member #{count}");
  const [previewKey, setPreviewKey] = useState(0);
  const [dmEnabled, setDmEnabled] = useState(false);
  const [dmMessage, setDmMessage] = useState("Welcome to **{server}**! We're glad to have you. 🎉");

  const snapshot = {
    enabled, channelId: channelId || null, message, embedEnabled, embedColor,
    embedTitle: embedTitle || null, embedDescription: embedDescription || null,
    assignRoleId: assignRoleId || null, imageCardEnabled, imageCardBgUrl: imageCardBgUrl || null,
    imageCardText: imageCardText || null, imageCardSubtext: imageCardSubtext || null,
    dmEnabled, dmMessage: dmMessage || null,
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
      setAssignRoleId(config.assignRoleId ?? "");
      setImageCardEnabled(config.imageCardEnabled);
      setImageCardBgUrl(config.imageCardBgUrl ?? "");
      setImageCardText(config.imageCardText ?? "Welcome, {user}!");
      setImageCardSubtext(config.imageCardSubtext ?? "Member #{count}");
      setDmEnabled(config.dmEnabled);
      setDmMessage(config.dmMessage ?? "Welcome to **{server}**! We're glad to have you. 🎉");
      markSaved({
        enabled: config.enabled, channelId: config.channelId ?? null, message: config.message,
        embedEnabled: config.embedEnabled, embedColor: config.embedColor,
        embedTitle: config.embedTitle ?? null, embedDescription: config.embedDescription ?? null,
        assignRoleId: config.assignRoleId ?? null, imageCardEnabled: config.imageCardEnabled,
        imageCardBgUrl: config.imageCardBgUrl ?? null, imageCardText: config.imageCardText ?? "Welcome, {user}!",
        imageCardSubtext: config.imageCardSubtext ?? "Member #{count}",
        dmEnabled: config.dmEnabled, dmMessage: config.dmMessage ?? "Welcome to **{server}**! We're glad to have you. 🎉",
      });
    }
  }, [config]);

  const handleSave = () => {
    updateWelcome.mutate(snapshot);
  };

  const previewCardUrl = `/api/guilds/${guildId}/welcome/preview-card?username=NewMember&serverName=Your+Server&count=1234&text=${encodeURIComponent(imageCardText)}&subtext=${encodeURIComponent(imageCardSubtext)}${imageCardBgUrl ? `&bgUrl=${encodeURIComponent(imageCardBgUrl)}` : ""}&_k=${previewKey}`;

  return (
    <Layout guildId={guildId}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Welcome Messages</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Configure greetings for new members</p>
          </div>
          <div className="flex items-center gap-3">
            <UnsavedChangesBadge show={isDirty && !updateWelcome.isPending} />
            <Button onClick={handleSave} disabled={updateWelcome.isPending || isLoading || !isDirty} size="sm">
              {updateWelcome.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : (
          <div className="space-y-4">
            {/* Basic message */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle className="text-base">Welcome Messages</CardTitle>
                    <CardDescription>Send a message when a new member joins</CardDescription></div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <ChannelPicker value={channelId} onChange={setChannelId} />
                </div>
                <div className="space-y-2">
                  <Label>Welcome Message</Label>
                  <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                    placeholder="Use {user} for mention, {server} for server name" />
                  <p className="text-xs text-muted-foreground">Variables: {"{user}"} = mention, {"{server}"} = server name, {"{count}"} = member count</p>
                </div>
                <div className="space-y-2">
                  <Label>Auto-assign Role (optional)</Label>
                  <RolePicker value={assignRoleId} onChange={setAssignRoleId} placeholder="No auto role" />
                </div>
              </CardContent>
            </Card>

            {/* Embed */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle className="text-base">Welcome Embed</CardTitle>
                    <CardDescription>Send a styled embed with the welcome message</CardDescription></div>
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
                    <Input value={embedTitle} onChange={e => setEmbedTitle(e.target.value)} placeholder="Welcome to {server}!" />
                  </div>
                  <div className="space-y-2">
                    <Label>Embed Description (optional)</Label>
                    <Textarea value={embedDescription} onChange={e => setEmbedDescription(e.target.value)} rows={3} placeholder="Glad to have you here..." />
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Preview</p>
                    <DiscordEmbedPreview
                      color={embedColor}
                      title={embedTitle || undefined}
                      description={(embedDescription || message)
                        .replace("{user}", "@NewMember")
                        .replace("{server}", "Your Server")
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
                    <CardTitle className="text-base flex items-center gap-2"><Image className="size-4 text-primary" />Welcome Image Card</CardTitle>
                    <CardDescription>Generate a custom image card with avatar, background, and text</CardDescription>
                  </div>
                  <Switch checked={imageCardEnabled} onCheckedChange={v => { setImageCardEnabled(v); if (v) setEmbedEnabled(false); }} />
                </div>
              </CardHeader>
              {imageCardEnabled && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Main Text</Label>
                    <Input value={imageCardText} onChange={e => setImageCardText(e.target.value)} placeholder="Welcome, {user}!" />
                    <p className="text-xs text-muted-foreground">Variables: {"{user}"} = username, {"{server}"} = server name, {"{count}"} = member count</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sub Text</Label>
                    <Input value={imageCardSubtext} onChange={e => setImageCardSubtext(e.target.value)} placeholder="Member #{count}" />
                  </div>
                  <div className="space-y-2">
                    <Label>Background Image URL (optional)</Label>
                    <Input value={imageCardBgUrl} onChange={e => setImageCardBgUrl(e.target.value)} placeholder="https://example.com/background.jpg" />
                    <p className="text-xs text-muted-foreground">Leave blank for a gradient background.</p>
                  </div>

                  {/* Live preview */}
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
                        alt="Welcome card preview"
                        className="w-full"
                        onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }}
                      />
                      <p className="hidden p-4 text-sm text-muted-foreground text-center">Preview unavailable — save changes and ensure @napi-rs/canvas is installed on the server.</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Join DM */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2"><Mail className="size-4 text-primary" />Join DM</CardTitle>
                    <CardDescription>Send a private DM to new members when they join</CardDescription>
                  </div>
                  <Switch checked={dmEnabled} onCheckedChange={setDmEnabled} />
                </div>
              </CardHeader>
              {dmEnabled && (
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>DM Message</Label>
                    <Textarea
                      value={dmMessage}
                      onChange={e => setDmMessage(e.target.value)}
                      rows={3}
                      placeholder="Welcome to **{server}**! We're glad to have you. 🎉"
                    />
                    <p className="text-xs text-muted-foreground">Variables: {"{user}"} = username, {"{server}"} = server name. Markdown is supported.</p>
                  </div>
                </CardContent>
              )}
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5">
                    <MessageSquare className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Bot Event: GuildMemberAdd</p>
                    <p className="text-xs text-muted-foreground">The bot listens for member join events and sends the configured message automatically</p>
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
