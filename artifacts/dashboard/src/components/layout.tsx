import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InviteDialog } from "@/components/invite-dialog";
import {
  LogOut, ShieldAlert, Shield, Settings, MessageSquare,
  Clock, ListTodo, Terminal, Menu, Home, DoorOpen,
  Send, Radio, TrendingUp, Ticket, FileText, Layers,
  BarChart2, Gift, Star, GitBranch, Sparkles, HelpCircle,
  Hash, UserPlus, Siren, Zap, Bell, Vote, PartyPopper,
  BookOpen, ChevronDown, ScrollText, ShieldCheck, LayoutDashboard, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GUIDE_SECTIONS = [
  {
    title: "Getting Started",
    icon: Sparkles,
    color: "#f5c400",
    tips: [
      "Go to Server Setup to create bot channels and roles automatically.",
      "Setup also creates Community Channels (#welcome, #goodbye, #rules) and role templates.",
      "The bot needs Manage Channels, Manage Roles & Kick/Ban permissions.",
      "Use /ping to verify the bot is online in your server.",
    ],
  },
  {
    title: "Moderation",
    icon: ShieldAlert,
    color: "#f87171",
    tips: [
      "/ban, /kick, /mute, /warn — all actions are logged to #mod-logs.",
      "/warnings @user shows a member's full warning history.",
      "Automod can block links, spam, profanity, and too many mentions.",
    ],
  },
  {
    title: "Welcome & Roles",
    icon: UserPlus,
    color: "#34d399",
    tips: [
      "Set a welcome channel and message — use {user} and {server} as placeholders.",
      "Role Management → Self Roles let members pick their own roles from a panel message.",
      "Role Management → Reaction Roles assign roles when members react to a specific message.",
      "Invite Management tracks who invited each member — view the leaderboard and recent joins.",
    ],
  },
  {
    title: "Automation",
    icon: Zap,
    color: "#60a5fa",
    tips: [
      "XP & Levels reward active members — set level-up role rewards.",
      "Stats Channels show live member/bot counts in voice channel names.",
      "Always Online sends periodic pings to keep the bot active.",
    ],
  },
  {
    title: "Utility",
    icon: Hash,
    color: "#a78bfa",
    tips: [
      "Disco Hook lets you send rich embeds to any channel — supports multiple embeds and buttons.",
      "Use the Bot / Webhook toggle in Disco Hook to send as the bot or a custom webhook.",
      "Buttons in Disco Hook show an ephemeral (disappearing) response when clicked.",
      "Reminders ping a channel at a scheduled time — great for events.",
      "Custom Commands create trigger → response pairs for your server.",
    ],
  },
];

function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-lg max-h-[80vh] overflow-y-auto border-0"
        style={{ background: "#110822", color: "white" }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white text-lg font-extrabold">
            <BookOpen className="size-5" style={{ color: "#f5c400" }} />
            Quick Guide
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-1">
          {GUIDE_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="flex items-center gap-2 mb-2">
                <section.icon className="size-4 shrink-0" style={{ color: section.color }} />
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: section.color + "cc" }}>
                  {section.title}
                </p>
              </div>
              <ul className="space-y-1.5 pl-1">
                {section.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-purple-200/70">
                    <span className="mt-1.5 size-1.5 rounded-full shrink-0" style={{ background: section.color + "80" }} />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type NavChild = { title: string; icon: any; href: string };
type NavItem = { title: string; icon: any; href: string; children?: NavChild[] };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS = (guildId: string): NavGroup[] => [
  {
    label: "Overview",
    items: [
      { title: "Summary",  icon: LayoutDashboard, href: `/guilds/${guildId}` },
    ],
  },
  {
    label: "Moderation",
    items: [
      { title: "Moderation",      icon: ShieldAlert,   href: `/guilds/${guildId}/moderation` },
      { title: "Warnings",        icon: Shield,        href: `/guilds/${guildId}/warnings` },
      { title: "Automod",         icon: Settings,      href: `/guilds/${guildId}/automod` },
      {
        title: "Role Management",
        icon: Layers,
        href: `/guilds/${guildId}/role-management`,
        children: [
          { title: "Self Roles",     icon: Star,      href: `/guilds/${guildId}/self-roles` },
          { title: "Reaction Roles", icon: GitBranch, href: `/guilds/${guildId}/reaction-roles` },
        ],
      },
      { title: "Rules",           icon: BookOpen,      href: `/guilds/${guildId}/rules` },
    ],
  },
  {
    label: "Community",
    items: [
      { title: "Welcome",           icon: MessageSquare, href: `/guilds/${guildId}/welcome` },
      { title: "Leave",             icon: DoorOpen,      href: `/guilds/${guildId}/leave` },
      { title: "Invite Management", icon: UserPlus,      href: `/guilds/${guildId}/invite-management` },
      { title: "Polls",             icon: ListTodo,      href: `/guilds/${guildId}/polls` },
      { title: "Giveaways",         icon: Gift,          href: `/guilds/${guildId}/giveaways` },
    ],
  },
  {
    label: "Features",
    items: [
      { title: "Verification",      icon: ShieldCheck,   href: `/guilds/${guildId}/verification` },
      { title: "Message Logs",      icon: ScrollText,    href: `/guilds/${guildId}/message-logs` },
    ],
  },
  {
    label: "Automation",
    items: [
      { title: "XP & Levels",     icon: TrendingUp,    href: `/guilds/${guildId}/xp-settings` },
      { title: "Reminders",       icon: Clock,         href: `/guilds/${guildId}/reminders` },
      { title: "Stats Channels",  icon: BarChart2,     href: `/guilds/${guildId}/stats-channels` },
      { title: "Always Online",   icon: Radio,         href: `/guilds/${guildId}/always-online` },
    ],
  },
  {
    label: "Utility",
    items: [
      { title: "Commands",        icon: Terminal,      href: `/guilds/${guildId}/commands` },
      { title: "Disco Hook",      icon: Send,          href: `/guilds/${guildId}/webhook-sender` },
      { title: "Tickets",         icon: Ticket,        href: `/guilds/${guildId}/tickets` },
      { title: "Applications",    icon: FileText,      href: `/guilds/${guildId}/applications` },
      { title: "Server Setup",    icon: Sparkles,      href: `/guilds/${guildId}/setup` },
    ],
  },
];

function SidebarContent({
  guildId, user, isLoading, onLogout, onNavigate, onGuide, onInvite, onProfileInfo,
}: {
  guildId?: string;
  user: any;
  isLoading: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
  onGuide?: () => void;
  onInvite?: (type: "full" | "min") => void;
  onProfileInfo?: () => void;
}) {
  const [location] = useLocation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (href: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href); else next.add(href);
      return next;
    });
  };

  const isItemExpanded = (item: NavItem) => {
    if (expandedItems.has(item.href)) return true;
    // Auto-expand if a child is active
    return !!item.children?.some(c => location === c.href || location.startsWith(c.href + "/"));
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Subtle animated background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-56 h-56 rounded-full opacity-[0.22]"
          style={{
            background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
            top: "-15%",
            left: "-25%",
            animation: "umbra-float-1 18s ease-in-out infinite",
            willChange: "transform",
          }}
        />
        <div
          className="absolute w-40 h-40 rounded-full opacity-[0.14]"
          style={{
            background: "radial-gradient(circle, #a855f7 0%, transparent 70%)",
            bottom: "15%",
            right: "-20%",
            animation: "umbra-float-2 24s ease-in-out infinite",
            willChange: "transform",
          }}
        />
      </div>

      {/* Header */}
      <div className="relative border-b border-white/[0.06] px-4 py-4 flex items-center gap-3 shrink-0">
        <img
          src="/umbra-avatar.png"
          alt="Umbra Utilities"
          className="size-9 rounded-xl object-cover shrink-0 shadow-lg shadow-purple-900/40 ring-1 ring-white/10"
        />
        <div className="flex flex-col gap-0.5 leading-none min-w-0">
          <span className="font-bold tracking-tight text-sm text-white">Umbra Utilities</span>
          <span className="text-[11px] text-purple-300/60">Admin Console</span>
        </div>
      </div>

      {/* Nav */}
      <div className="relative flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {/* Back to servers */}
        <Link href="/guilds" onClick={onNavigate}>
          <div className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 cursor-pointer mb-3",
            "text-purple-300/60 hover:text-white hover:bg-white/[0.06]"
          )}>
            <Home className="size-4 shrink-0" />
            <span>All Servers</span>
          </div>
        </Link>

        {guildId ? (
          NAV_GROUPS(guildId).map((group) => (
            <div key={group.label} className="mb-1">
              <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold tracking-widest uppercase"
                style={{ color: "#f5c400cc" }}>
                {group.label}
              </p>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const hasChildren = !!item.children?.length;
                  const childActive = hasChildren && item.children!.some(
                    c => location === c.href || location.startsWith(c.href + "/")
                  );
                  const expanded = isItemExpanded(item);
                  const isActive = !hasChildren && (location === item.href || location.startsWith(item.href + "/"));

                  return (
                    <div key={item.href}>
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.href)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150",
                            childActive
                              ? "font-semibold"
                              : "text-purple-300/60 hover:text-white hover:bg-white/[0.06]"
                          )}
                          style={childActive ? {
                            backgroundColor: "rgba(245,196,0,0.10)",
                            color: "#f5c400",
                            border: "1px solid rgba(245,196,0,0.20)",
                          } : {}}
                        >
                          <item.icon className="size-4 shrink-0" />
                          <span className="flex-1 text-left">{item.title}</span>
                          <ChevronDown
                            className={cn(
                              "size-3.5 transition-transform duration-200 shrink-0",
                              expanded ? "rotate-180" : ""
                            )}
                          />
                        </button>
                      ) : (
                        <Link href={item.href} onClick={onNavigate}>
                          <div className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 cursor-pointer",
                            isActive
                              ? "font-semibold"
                              : "text-purple-300/60 hover:text-white hover:bg-white/[0.06]"
                          )}
                            style={isActive ? {
                              backgroundColor: "rgba(245,196,0,0.10)",
                              color: "#f5c400",
                              border: "1px solid rgba(245,196,0,0.20)",
                            } : {}}
                          >
                            <item.icon className="size-4 shrink-0" />
                            <span>{item.title}</span>
                          </div>
                        </Link>
                      )}

                      {/* Sub-items */}
                      {hasChildren && expanded && (
                        <div className="ml-3 mt-0.5 mb-0.5 pl-3 border-l border-white/[0.08] space-y-0.5">
                          {item.children!.map((child) => {
                            const cActive = location === child.href || location.startsWith(child.href + "/");
                            return (
                              <Link key={child.href} href={child.href} onClick={onNavigate}>
                                <div
                                  className={cn(
                                    "flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm transition-all duration-150 cursor-pointer",
                                    cActive
                                      ? "font-semibold"
                                      : "text-purple-300/50 hover:text-white hover:bg-white/[0.06]"
                                  )}
                                  style={cActive ? {
                                    backgroundColor: "rgba(245,196,0,0.10)",
                                    color: "#f5c400",
                                    border: "1px solid rgba(245,196,0,0.20)",
                                  } : {}}
                                >
                                  <child.icon className="size-3.5 shrink-0" />
                                  <span>{child.title}</span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          ))
        ) : (
          <div className="px-3 py-8 text-sm text-purple-300/40 text-center">
            Select a server to manage
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative border-t border-white/[0.06] p-3 shrink-0 space-y-2">
        {/* Add to Server */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(124,58,237,0.25)", background: "rgba(124,58,237,0.07)" }}>
          <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold tracking-widest uppercase" style={{ color: "#a78bfaaa" }}>
            Add to a Server
          </p>
          <div className="flex gap-1.5 px-2 pb-2.5">
            <button
              type="button"
              onClick={() => onInvite?.("full")}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 text-yellow-300/80 hover:text-yellow-200 hover:bg-white/[0.06]"
            >
              <Zap className="size-3 shrink-0" />
              Full
            </button>
            <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.06)" }} />
            <button
              type="button"
              onClick={() => onInvite?.("min")}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 text-green-400/70 hover:text-green-300 hover:bg-white/[0.06]"
            >
              <ShieldCheck className="size-3 shrink-0" />
              Minimal
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onGuide}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 text-purple-300/50 hover:text-white hover:bg-white/[0.06]"
        >
          <HelpCircle className="size-4 shrink-0" style={{ color: "#f5c400aa" }} />
          <span>Quick Guide</span>
        </button>

        {isLoading ? (
          <div className="flex items-center gap-3 px-1">
            <Skeleton className="size-8 rounded-full bg-white/10" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-24 bg-white/10" />
              <Skeleton className="h-2.5 w-16 bg-white/10" />
            </div>
          </div>
        ) : user ? (
          <div className="space-y-1">
            <button
              type="button"
              onClick={onProfileInfo}
              className="w-full flex items-center gap-2.5 px-1 min-w-0 rounded-xl py-1.5 hover:bg-white/[0.05] transition-colors group text-left"
            >
              <Avatar className="size-8 shrink-0 ring-1 ring-white/10 group-hover:ring-purple-400/40 transition-all">
                <AvatarImage
                  src={user.avatar
                    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                    : undefined}
                />
                <AvatarFallback className="text-xs bg-purple-900 text-purple-200">
                  {user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-xs min-w-0 flex-1">
                <span className="font-medium text-white truncate">{user.globalName || user.username}</span>
                <span className="text-purple-300/50 truncate">@{user.username}</span>
              </div>
              <ChevronDown className="size-3 text-purple-300/30 group-hover:text-purple-300/60 shrink-0 rotate-[-90deg]" />
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400/70 hover:text-red-300 hover:bg-red-500/[0.08] transition-colors"
            >
              <LogOut className="size-3.5 shrink-0" />
              Log out
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProfileDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user: any }) {
  const createdAt = user?.id
    ? new Date(Number((BigInt(user.id) >> 22n) + 1420070400000n))
    : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Account Info</DialogTitle></DialogHeader>
        {user && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {user.avatar ? (
                <img
                  src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`}
                  className="size-16 rounded-full ring-2 ring-purple-400/30 shadow-lg"
                  alt={user.username}
                />
              ) : (
                <div className="size-16 rounded-full bg-purple-900 flex items-center justify-center text-xl font-bold text-purple-200 ring-2 ring-purple-400/30">
                  {user.username?.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-bold text-white text-lg leading-tight">{user.globalName || user.username}</p>
                <p className="text-sm text-purple-300/60">@{user.username}</p>
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-border/40 bg-background/30 divide-y divide-border/30">
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-xs text-muted-foreground">User ID</span>
                <span className="text-xs font-mono text-white/80">{user.id}</span>
              </div>
              {createdAt && (
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">Account Created</span>
                  <span className="text-xs text-white/80">{createdAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
              )}
              {user.discriminator && user.discriminator !== "0" && (
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">Discriminator</span>
                  <span className="text-xs font-mono text-white/80">#{user.discriminator}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Layout({ children, guildId }: { children: React.ReactNode; guildId?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [inviteType, setInviteType] = useState<"full" | "min" | null>(null);
  const { data: user, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });
  const logout = useLogout();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => setLocation("/") });
  };

  const sidebarProps = {
    guildId,
    user,
    isLoading,
    onLogout: handleLogout,
    onNavigate: () => setMobileOpen(false),
    onGuide: () => setGuideOpen(true),
    onInvite: (type: "full" | "min") => { setInviteType(type); setMobileOpen(false); },
    onProfileInfo: () => setProfileOpen(true),
  };

  return (
    <div className="flex min-h-screen text-foreground dark w-full" style={{ background: "#0d0618" }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-56 lg:w-64 shrink-0 flex-col"
        style={{ background: "#110822", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Subtle dark animated orbs for dashboard bg */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div
            className="absolute rounded-full opacity-[0.14]"
            style={{
              width: "600px",
              height: "600px",
              background: "radial-gradient(circle, #7c3aed, transparent)",
              top: "5%",
              right: "-8%",
              animation: "umbra-float-1 22s ease-in-out infinite",
              willChange: "transform",
            }}
          />
          <div
            className="absolute rounded-full opacity-[0.09]"
            style={{
              width: "400px",
              height: "400px",
              background: "radial-gradient(circle, #a855f7, transparent)",
              bottom: "15%",
              left: "2%",
              animation: "umbra-float-2 28s ease-in-out infinite",
              willChange: "transform",
            }}
          />
        </div>

        {/* Mobile header */}
        <header
          className="md:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-40 backdrop-blur-md"
          style={{ background: "rgba(17,8,34,0.85)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 text-purple-300 hover:text-white hover:bg-white/[0.06] rounded-xl">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-0"
              style={{ background: "#110822" }}>
              <SidebarContent {...sidebarProps} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img
              src="/umbra-avatar.png"
              alt="Umbra Utilities"
              className="size-6 rounded-lg object-cover shrink-0"
            />
            <span className="font-bold text-sm text-white truncate">Umbra Utilities</span>
          </div>

          {user && (
            <Avatar className="size-8 shrink-0 ring-1 ring-white/10">
              <AvatarImage
                src={user.avatar
                  ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                  : undefined}
              />
              <AvatarFallback className="text-xs bg-purple-900 text-purple-200">
                {user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </header>

        {/* Page content */}
        <main className="relative z-10 flex-1 overflow-auto">
          {children}
        </main>
      </div>

      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
      <InviteDialog open={inviteType !== null} onClose={() => setInviteType(null)} type={inviteType} />
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} user={user} />
    </div>
  );
}
