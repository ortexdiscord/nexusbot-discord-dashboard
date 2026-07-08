import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Layout } from "@/components/layout";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, ShieldCheck, CheckCircle2 } from "lucide-react";

const PREMADE_RULES = [
  { key: "no_harassment",    label: "No harassment, bullying, or personal attacks toward other members" },
  { key: "no_nsfw",          label: "No NSFW, adult, or otherwise inappropriate content" },
  { key: "no_spam",          label: "No spam, flooding, or repeated messages in any channel" },
  { key: "no_advertising",   label: "No advertising or unsolicited self-promotion without staff permission" },
  { key: "correct_channels", label: "Use each channel for its intended purpose as described in the topic" },
  { key: "no_personal_info", label: "Do not share your own or others' personal or private information" },
  { key: "discord_tos",      label: "Follow Discord's Terms of Service and Community Guidelines at all times" },
  { key: "no_hate_speech",   label: "No hate speech, slurs, or discriminatory language of any kind" },
  { key: "respect_staff",    label: "Respect and follow instructions given by moderators and administrators" },
  { key: "no_impersonation", label: "No impersonation of staff members, bots, or other community members" },
  { key: "english_only",     label: "Use English in general channels so all members can understand" },
  { key: "no_politics",      label: "Avoid political, religious, or otherwise divisive debates in general chat" },
];

export default function RulesPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = params.guildId!;
  const { toast } = useToast();

  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/guilds/${guildId}/rules`)
      .then(r => r.json())
      .then((data: Array<{ key: string; enabled: boolean }>) => {
        const map: Record<string, boolean> = {};
        data.forEach(r => { map[r.key] = r.enabled; });
        setEnabled(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId]);

  async function save() {
    setSaving(true);
    try {
      const updates = PREMADE_RULES.map(r => ({ key: r.key, enabled: !!enabled[r.key] }));
      const res = await fetch(`/api/guilds/${guildId}/rules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Rules saved", description: "Server rules have been updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save rules.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  return (
    <Layout>
      <div className="p-5 md:p-7 space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="size-6 shrink-0" style={{ color: "#f5c400" }} />
              Server Rules
            </h1>
            <p className="text-purple-300/60 text-sm mt-1 max-w-md">
              Toggle the rules that apply to your server. Members can view active rules with{" "}
              <code className="text-purple-300/80 bg-white/5 px-1 rounded">/rules</code>.
            </p>
          </div>
          <Button
            onClick={save}
            disabled={saving || loading}
            className="shrink-0 rounded-xl font-bold h-10"
            style={{ background: "#f5c400", color: "#1a0838" }}
          >
            <Save className="size-4 mr-2" />
            {saving ? "Saving…" : "Save Rules"}
          </Button>
        </div>

        {/* Active count badge */}
        {!loading && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "#a78bfa" }}>
            <CheckCircle2 className="size-4" style={{ color: "#34d399" }} />
            <span>
              <span className="font-bold text-white">{enabledCount}</span> of {PREMADE_RULES.length} rules enabled
            </span>
          </div>
        )}

        {/* Rules list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {PREMADE_RULES.map((rule, idx) => {
              const on = !!enabled[rule.key];
              return (
                <div
                  key={rule.key}
                  className="flex items-center gap-4 rounded-2xl p-4 cursor-pointer transition-all duration-150"
                  style={{
                    background: on ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.03)",
                    border: on ? "1px solid rgba(124,58,237,0.28)" : "1px solid rgba(255,255,255,0.07)",
                  }}
                  onClick={() => setEnabled(prev => ({ ...prev, [rule.key]: !prev[rule.key] }))}
                >
                  {/* Number badge */}
                  <div
                    className="shrink-0 size-7 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{
                      background: on ? "rgba(245,196,0,0.15)" : "rgba(255,255,255,0.05)",
                      color: on ? "#f5c400" : "rgba(167,139,250,0.5)",
                    }}
                  >
                    {idx + 1}
                  </div>

                  {/* Rule text */}
                  <p className="flex-1 text-sm leading-snug" style={{ color: on ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.55)" }}>
                    {rule.label}
                  </p>

                  {/* Toggle */}
                  <Switch
                    checked={on}
                    onCheckedChange={(v) => setEnabled(prev => ({ ...prev, [rule.key]: v }))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
