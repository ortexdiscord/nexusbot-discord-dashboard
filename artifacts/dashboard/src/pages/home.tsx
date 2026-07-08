import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  useGetMe, useListGuilds, useGetBotStats,
  getGetMeQueryKey, getListGuildsQueryKey, getGetBotStatsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Zap, Wifi, ChevronRight, Server } from "lucide-react";

export default function Home() {
  const [, navigate] = useLocation();
  const { data: user, isLoading: userLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });
  const { data: guilds, isLoading: guildsLoading } = useListGuilds({
    query: { queryKey: getListGuildsQueryKey(), enabled: !!user },
  });
  // Always fetch stats — displayed on both login screen and dashboard
  const { data: botStats } = useGetBotStats({
    query: { queryKey: getGetBotStatsQueryKey() },
  });

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#1a0838" }}>
        <div className="size-8 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin" />
      </div>
    );
  }

  /* ── Not logged in — show login / landing screen ── */
  if (!user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center dark relative overflow-hidden"
        style={{ background: "#1a0838" }}
      >
        <style>{`
          @keyframes umbra-shoot {
            0%   { transform: rotate(-45deg) translateX(-200px); opacity: 0; }
            8%   { opacity: 0.9; }
            85%  { opacity: 0.6; }
            100% { transform: rotate(-45deg) translateX(420px); opacity: 0; }
          }
          @keyframes umbra-ring-pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1);    opacity: 0.35; }
            50%       { transform: translate(-50%, -50%) scale(1.07); opacity: 0.65; }
          }
          @keyframes umbra-card-glow {
            0%, 100% { box-shadow: 0 0 40px 0   rgba(124,58,237,0.20); }
            50%       { box-shadow: 0 0 80px 8px rgba(124,58,237,0.38), 0 0 20px 2px rgba(245,196,0,0.12); }
          }
          @keyframes umbra-orbit {
            from { transform: rotate(0deg)   translateX(260px) rotate(0deg); }
            to   { transform: rotate(360deg) translateX(260px) rotate(-360deg); }
          }
        `}</style>

        <div className="absolute inset-0 pointer-events-none overflow-hidden">

          {/* ── Rotating conic gradient ── */}
          <div className="absolute" style={{
            width: "900px", height: "900px",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: "conic-gradient(from 0deg, transparent 0%, rgba(124,58,237,0.06) 20%, rgba(245,196,0,0.04) 40%, rgba(167,139,250,0.07) 60%, transparent 80%)",
            animation: "umbra-spin 40s linear infinite",
          }} />

          {/* ── Pulsing concentric rings ── */}
          {[600, 760, 900].map((size, i) => (
            <div key={size} className="absolute rounded-full" style={{
              width: `${size}px`, height: `${size}px`,
              top: "50%", left: "50%",
              border: `1px solid ${i === 0 ? "rgba(124,58,237,0.18)" : i === 1 ? "rgba(245,196,0,0.07)" : "rgba(167,139,250,0.05)"}`,
              animation: `umbra-ring-pulse ${6 + i * 2}s ease-in-out ${i * 1.2}s infinite`,
            }} />
          ))}

          {/* ── Colour orbs ── */}
          {/* Deep violet — top-left */}
          <div className="absolute rounded-full blur-3xl" style={{
            width: "560px", height: "560px",
            background: "radial-gradient(circle, rgba(124,58,237,0.70) 0%, rgba(109,40,217,0.30) 50%, transparent 70%)",
            top: "-15%", left: "-14%",
            animation: "umbra-float-1 14s ease-in-out infinite",
          }} />
          {/* Gold — mid right */}
          <div className="absolute rounded-full blur-3xl" style={{
            width: "340px", height: "340px",
            background: "radial-gradient(circle, rgba(245,196,0,0.22) 0%, rgba(234,179,8,0.10) 50%, transparent 70%)",
            top: "30%", right: "-6%",
            animation: "umbra-float-2 19s ease-in-out infinite",
          }} />
          {/* Lavender — bottom-right */}
          <div className="absolute rounded-full blur-3xl" style={{
            width: "420px", height: "420px",
            background: "radial-gradient(circle, rgba(167,139,250,0.55) 0%, rgba(139,92,246,0.20) 55%, transparent 70%)",
            bottom: "-10%", right: "-10%",
            animation: "umbra-float-3 22s ease-in-out infinite",
          }} />
          {/* Pink — bottom-left */}
          <div className="absolute rounded-full blur-3xl" style={{
            width: "260px", height: "260px",
            background: "radial-gradient(circle, rgba(192,132,252,0.38) 0%, transparent 70%)",
            bottom: "8%", left: "5%",
            animation: "umbra-float-1 26s ease-in-out infinite reverse",
          }} />
          {/* Violet core — top-right */}
          <div className="absolute rounded-full blur-2xl" style={{
            width: "180px", height: "180px",
            background: "radial-gradient(circle, rgba(139,92,246,0.60) 0%, transparent 70%)",
            top: "12%", right: "18%",
            animation: "umbra-float-2 31s ease-in-out infinite reverse",
          }} />
          {/* Teal — center-left */}
          <div className="absolute rounded-full blur-3xl" style={{
            width: "200px", height: "200px",
            background: "radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 70%)",
            top: "55%", left: "15%",
            animation: "umbra-float-3 17s ease-in-out 3s infinite",
          }} />
          {/* Rose — top-center */}
          <div className="absolute rounded-full blur-3xl" style={{
            width: "160px", height: "160px",
            background: "radial-gradient(circle, rgba(244,114,182,0.20) 0%, transparent 70%)",
            top: "5%", left: "45%",
            animation: "umbra-float-1 23s ease-in-out 7s infinite reverse",
          }} />

          {/* ── Shooting stars ── */}
          {[
            { top: "20%", left: "8%",  delay: "0s",   dur: "3.5s", gold: true  },
            { top: "60%", left: "3%",  delay: "2.3s", dur: "4.0s", gold: false },
            { top: "35%", left: "65%", delay: "4.5s", dur: "3.0s", gold: false },
            { top: "78%", left: "55%", delay: "1.2s", dur: "4.5s", gold: true  },
            { top: "12%", left: "40%", delay: "6.0s", dur: "2.8s", gold: false },
            { top: "48%", left: "80%", delay: "8.5s", dur: "3.2s", gold: true  },
          ].map((s, i) => (
            <div key={`shoot-${i}`} style={{
              position: "absolute", top: s.top, left: s.left,
              width: "80px", height: "1.5px",
              background: s.gold
                ? "linear-gradient(90deg, transparent, rgba(245,196,0,0.75), transparent)"
                : "linear-gradient(90deg, transparent, rgba(167,139,250,0.70), transparent)",
              animation: `umbra-shoot ${s.dur} ease-in-out ${s.delay} infinite`,
              borderRadius: "2px",
            }} />
          ))}

          {/* ── Dot grid ── */}
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle, rgba(167,139,250,0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
          }} />

          {/* ── Sparkle dots ── */}
          {[
            { top: "18%", left: "22%", delay: "0s",   dur: "3.2s", col: 0 },
            { top: "72%", left: "75%", delay: "1.1s", dur: "2.8s", col: 1 },
            { top: "38%", left: "82%", delay: "2.0s", dur: "3.6s", col: 2 },
            { top: "85%", left: "30%", delay: "0.5s", dur: "4.1s", col: 0 },
            { top: "55%", left: "48%", delay: "1.7s", dur: "3.0s", col: 1 },
            { top: "10%", left: "62%", delay: "2.5s", dur: "2.5s", col: 2 },
            { top: "30%", left: "15%", delay: "3.5s", dur: "3.8s", col: 0 },
            { top: "65%", left: "88%", delay: "0.8s", dur: "2.6s", col: 1 },
            { top: "90%", left: "70%", delay: "4.2s", dur: "3.3s", col: 2 },
            { top: "5%",  left: "33%", delay: "1.9s", dur: "4.0s", col: 0 },
          ].map((s, i) => {
            const colors = ["#f5c400", "#c4b5fd", "#67e8f9"];
            const shadows = [
              "0 0 6px 2px rgba(245,196,0,0.6)",
              "0 0 6px 2px rgba(196,181,253,0.6)",
              "0 0 6px 2px rgba(103,232,249,0.6)",
            ];
            return (
              <div key={i} className="absolute rounded-full" style={{
                width: "3px", height: "3px",
                background: colors[s.col],
                top: s.top, left: s.left,
                animation: `umbra-sparkle ${s.dur} ease-in-out ${s.delay} infinite`,
                boxShadow: shadows[s.col],
              }} />
            );
          })}
        </div>

        {/* ── Login card ── */}
        <div className="relative z-10 text-center space-y-7 max-w-sm w-full px-6">
          {/* Avatar with glow */}
          <div className="flex justify-center">
            <div className="rounded-2xl p-1 shadow-2xl" style={{
              background: "linear-gradient(135deg, rgba(245,196,0,0.3) 0%, rgba(124,58,237,0.3) 100%)",
              animation: "umbra-card-glow 4s ease-in-out infinite",
            }}>
              <img src="/umbra-avatar.png" alt="Umbra Utilities" className="size-24 rounded-xl object-cover" />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">Umbra Utilities</h1>
            <p className="text-purple-300/70 mt-2 text-base">Discord bot management dashboard</p>
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Server, label: botStats ? String(botStats.totalGuilds)                  : "—", sub: "Servers"      },
              { icon: Zap,    label: botStats ? botStats.totalCommands.toLocaleString()        : "—", sub: "Commands"     },
              { icon: Wifi,   label: botStats ? `${botStats.ping}ms`                           : "—", sub: "Avg ping"     },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={sub} className="rounded-2xl p-3 text-center" style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <Icon className="size-4 mx-auto mb-1.5" style={{ color: "#f5c400" }} />
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="text-[11px] text-purple-300/50 leading-tight">{sub}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Button
            size="lg"
            className="w-full rounded-xl font-bold text-base h-12 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30 transition-shadow"
            style={{ background: "#f5c400", color: "#1a0838" }}
            asChild
          >
            <a href="/api/auth/discord">
              <svg className="size-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Sign in with Discord
            </a>
          </Button>
        </div>
      </div>
    );
  }

  /* ── Authenticated dashboard ── */
  return (
    <Layout>
      <div className="p-5 md:p-7 space-y-6 max-w-5xl">
        {/* Welcome banner */}
        <div
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(245,196,0,0.08) 0%, rgba(124,58,237,0.12) 50%, rgba(13,6,24,0) 100%)",
            border: "1px solid rgba(245,196,0,0.12)",
          }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ animation: "umbra-gradient-pulse 8s ease-in-out infinite" }} />
          <div className="relative">
            <h1 className="text-2xl font-extrabold text-white">
              {userLoading
                ? <Skeleton className="h-8 w-52 inline-block bg-white/10" />
                : `Welcome back, ${user?.globalName || user?.username}!`}
            </h1>
            <p className="text-purple-300/60 mt-1 text-sm">Select a server below to manage it with Umbra Utilities.</p>
          </div>
        </div>

        {/* Bot stats */}
        {botStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Servers",  value: botStats.totalGuilds,                   color: "#f5c400" },
              { label: "Users",    value: botStats.totalUsers.toLocaleString(),    color: "#a78bfa" },
              { label: "Commands", value: botStats.totalCommands.toLocaleString(), color: "#34d399" },
              { label: "Ping",     value: `${botStats.ping}ms`,                    color: "#60a5fa" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl p-4" style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <p className="text-xs text-purple-300/50 mb-1">{label}</p>
                <p className="text-xl font-extrabold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Server list */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#f5c400aa" }}>
            Your Servers
          </h2>

          {guildsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl bg-white/[0.04]" />
              ))}
            </div>
          ) : !guilds?.length ? (
            <div className="text-center py-14 text-purple-300/40">
              <img src="/umbra-avatar.png" alt="" className="size-10 mx-auto mb-3 opacity-30 rounded-xl" />
              <p className="text-sm">No servers found with this bot</p>
            </div>
          ) : (
            <div className="space-y-2">
              {guilds.map((guild) => (
                <Card
                  key={guild.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer transition-all duration-150 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c400]/60"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                  onClick={() => navigate(`/guilds/${guild.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/guilds/${guild.id}`);
                    }
                  }}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    {guild.icon ? (
                      <img
                        src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                        className="size-10 rounded-xl shrink-0"
                        alt=""
                      />
                    ) : (
                      <div
                        className="size-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0"
                        style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd" }}
                      >
                        {guild.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{guild.name}</p>
                      <p className="text-xs text-purple-300/50 flex items-center gap-1 mt-0.5">
                        <Users className="size-3" />
                        {guild.memberCount?.toLocaleString() ?? "—"} members
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-purple-300/30 shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
