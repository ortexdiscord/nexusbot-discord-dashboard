import { useParams } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Hash, Shield, CheckCircle2, XCircle, Loader2, Sparkles, MessageSquare, Crown } from "lucide-react";

interface SetupResult {
  channels: string[];
  roles: string[];
  errors: string[];
}

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

export default function Setup() {
  const { guildId } = useParams<{ guildId: string }>();
  const { toast } = useToast();

  const [createChannels, setCreateChannels] = useState(true);
  const [createRoles, setCreateRoles] = useState(true);
  const [createCommunityChannels, setCreateCommunityChannels] = useState(false);
  const [createExtraRoles, setCreateExtraRoles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);

  const handleSetup = async () => {
    if (!guildId) return;
    if (!createChannels && !createRoles && !createCommunityChannels && !createExtraRoles) {
      toast({ title: "Nothing selected", description: "Enable at least one option.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/guilds/${guildId}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createChannels, createRoles, createCommunityChannels, createExtraRoles }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: "Setup failed", description: json?.error ?? "Server error", variant: "destructive" });
        return;
      }
      // Validate shape; default arrays to empty if not present
      const data: SetupResult = {
        channels: Array.isArray(json.channels) ? json.channels : [],
        roles: Array.isArray(json.roles) ? json.roles : [],
        errors: Array.isArray(json.errors) ? json.errors : [],
      };
      setResult(data);
      if (data.errors.length === 0) {
        toast({ title: "Setup complete!", description: "Everything was created successfully." });
      } else {
        toast({ title: "Setup finished with errors", description: data.errors[0], variant: "destructive" });
      }
    } catch {
      toast({ title: "Request failed", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout guildId={guildId}>
      <div className="p-5 md:p-7 max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Sparkles className="size-6" style={{ color: "#f5c400" }} />
            Server Setup
          </h1>
          <p className="text-purple-300/60 text-sm mt-1">
            Let Umbra Utilities create its own channels and roles automatically — no manual setup needed.
          </p>
        </div>

        {/* Toggle cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Create Channels */}
          <button
            type="button"
            onClick={() => setCreateChannels(v => !v)}
            className="text-left rounded-2xl p-5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c400]/60"
            style={{
              background: createChannels ? "rgba(245,196,0,0.08)" : "rgba(255,255,255,0.03)",
              border: createChannels ? "1px solid rgba(245,196,0,0.30)" : "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="size-10 rounded-xl flex items-center justify-center"
                style={{ background: createChannels ? "rgba(245,196,0,0.15)" : "rgba(255,255,255,0.06)" }}
              >
                <Hash className="size-5" style={{ color: createChannels ? "#f5c400" : "#a78bfa" }} />
              </div>
              {/* Toggle pill */}
              <div
                className="w-11 h-6 rounded-full transition-colors duration-200 relative"
                style={{ background: createChannels ? "#f5c400" : "rgba(255,255,255,0.15)" }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: createChannels ? "translateX(24px)" : "translateX(4px)" }}
                />
              </div>
            </div>
            <h3 className="font-bold text-white text-sm">Create Channels</h3>
            <p className="text-purple-300/50 text-xs mt-1 leading-relaxed">
              Creates an <strong className="text-purple-300/80">Umbra Utilities</strong> category with{" "}
              <code className="text-purple-300/70">#bot-logs</code>,{" "}
              <code className="text-purple-300/70">#mod-logs</code>, and{" "}
              <code className="text-purple-300/70">#join-logs</code>.
            </p>
          </button>

          {/* Create Roles */}
          <button
            type="button"
            onClick={() => setCreateRoles(v => !v)}
            className="text-left rounded-2xl p-5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c400]/60"
            style={{
              background: createRoles ? "rgba(245,196,0,0.08)" : "rgba(255,255,255,0.03)",
              border: createRoles ? "1px solid rgba(245,196,0,0.30)" : "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="size-10 rounded-xl flex items-center justify-center"
                style={{ background: createRoles ? "rgba(245,196,0,0.15)" : "rgba(255,255,255,0.06)" }}
              >
                <Shield className="size-5" style={{ color: createRoles ? "#f5c400" : "#a78bfa" }} />
              </div>
              <div
                className="w-11 h-6 rounded-full transition-colors duration-200 relative"
                style={{ background: createRoles ? "#f5c400" : "rgba(255,255,255,0.15)" }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: createRoles ? "translateX(24px)" : "translateX(4px)" }}
                />
              </div>
            </div>
            <h3 className="font-bold text-white text-sm">Create Roles</h3>
            <p className="text-purple-300/50 text-xs mt-1 leading-relaxed">
              Creates a{" "}
              <span className="font-semibold" style={{ color: "#f5c400" }}>Bot Manager</span> role (yellow) and a{" "}
              <span className="text-purple-300/80 font-semibold">Muted</span> role used for silencing members.
            </p>
          </button>
          {/* Create Community Channels */}
          <button
            type="button"
            onClick={() => setCreateCommunityChannels(v => !v)}
            className="text-left rounded-2xl p-5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c400]/60"
            style={{
              background: createCommunityChannels ? "rgba(245,196,0,0.08)" : "rgba(255,255,255,0.03)",
              border: createCommunityChannels ? "1px solid rgba(245,196,0,0.30)" : "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="size-10 rounded-xl flex items-center justify-center"
                style={{ background: createCommunityChannels ? "rgba(245,196,0,0.15)" : "rgba(255,255,255,0.06)" }}
              >
                <MessageSquare className="size-5" style={{ color: createCommunityChannels ? "#f5c400" : "#a78bfa" }} />
              </div>
              <div
                className="w-11 h-6 rounded-full transition-colors duration-200 relative"
                style={{ background: createCommunityChannels ? "#f5c400" : "rgba(255,255,255,0.15)" }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: createCommunityChannels ? "translateX(24px)" : "translateX(4px)" }}
                />
              </div>
            </div>
            <h3 className="font-bold text-white text-sm">Create Community Channels</h3>
            <p className="text-purple-300/50 text-xs mt-1 leading-relaxed">
              Creates a <strong className="text-purple-300/80">Community</strong> category with{" "}
              <code className="text-purple-300/70">#welcome</code>,{" "}
              <code className="text-purple-300/70">#goodbye</code>, and{" "}
              <code className="text-purple-300/70">#rules</code>.
            </p>
          </button>

          {/* Create Extra Roles */}
          <button
            type="button"
            onClick={() => setCreateExtraRoles(v => !v)}
            className="text-left rounded-2xl p-5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c400]/60"
            style={{
              background: createExtraRoles ? "rgba(245,196,0,0.08)" : "rgba(255,255,255,0.03)",
              border: createExtraRoles ? "1px solid rgba(245,196,0,0.30)" : "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="size-10 rounded-xl flex items-center justify-center"
                style={{ background: createExtraRoles ? "rgba(245,196,0,0.15)" : "rgba(255,255,255,0.06)" }}
              >
                <Crown className="size-5" style={{ color: createExtraRoles ? "#f5c400" : "#a78bfa" }} />
              </div>
              <div
                className="w-11 h-6 rounded-full transition-colors duration-200 relative"
                style={{ background: createExtraRoles ? "#f5c400" : "rgba(255,255,255,0.15)" }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: createExtraRoles ? "translateX(24px)" : "translateX(4px)" }}
                />
              </div>
            </div>
            <h3 className="font-bold text-white text-sm">Create More Roles</h3>
            <p className="text-purple-300/50 text-xs mt-1 leading-relaxed">
              Creates <span className="font-semibold text-emerald-400">Verified</span>,{" "}
              <span className="font-semibold text-blue-400">Member</span>, and{" "}
              <span className="font-semibold text-yellow-300">VIP</span> roles for your server.
            </p>
          </button>
        </div>

        {/* Note */}
        <p className="text-xs text-purple-300/40 leading-relaxed">
          ⚠️ The bot needs <strong className="text-purple-300/60">Manage Channels</strong> and{" "}
          <strong className="text-purple-300/60">Manage Roles</strong> permissions in your server. Already have these channels or roles? You can skip the toggles and only create what you need.
        </p>

        {/* Run button */}
        <Button
          onClick={handleSetup}
          disabled={loading}
          className="h-11 px-8 rounded-xl font-bold text-sm shadow-lg shadow-yellow-500/10"
          style={{ background: "#f5c400", color: "#1a0838" }}
        >
          {loading
            ? <><Loader2 className="size-4 mr-2 animate-spin" />Running setup…</>
            : <><Sparkles className="size-4 mr-2" />Run Setup</>}
        </Button>

        {/* Results */}
        {result && (
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <h3 className="font-bold text-white text-sm">Setup Results</h3>

            {result.channels.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#f5c400aa" }}>
                  Channels Created
                </p>
                <ul className="space-y-1">
                  {result.channels.map(ch => (
                    <li key={ch} className="flex items-center gap-2 text-sm text-white">
                      <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      {ch}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.roles.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#f5c400aa" }}>
                  Roles Created
                </p>
                <ul className="space-y-1">
                  {result.roles.map(r => (
                    <li key={r} className="flex items-center gap-2 text-sm text-white">
                      <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2 text-red-400">Errors</p>
                <ul className="space-y-1">
                  {result.errors.map(e => (
                    <li key={e} className="flex items-start gap-2 text-sm text-red-300">
                      <XCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.channels.length === 0 && result.roles.length === 0 && result.errors.length === 0 && (
              <p className="text-sm text-purple-300/50">Nothing was selected to create.</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
