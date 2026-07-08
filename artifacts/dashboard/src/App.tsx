import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Guilds from "@/pages/guilds";
import GuildOverview from "@/pages/guild-overview";
import Moderation from "@/pages/moderation";
import Warnings from "@/pages/warnings";
import Automod from "@/pages/automod";
import ReactionRoles from "@/pages/reaction-roles";
import RoleManagement from "@/pages/role-management";
import Commands from "@/pages/commands";
import Welcome from "@/pages/welcome";
import Leave from "@/pages/leave";
import Reminders from "@/pages/reminders";
import Polls from "@/pages/polls";
import WebhookSender from "@/pages/webhook-sender";
import AlwaysOnlinePage from "@/pages/always-online";
import LevelRoles from "@/pages/level-roles";
import BotInfoPage from "@/pages/bot-info";
import SelfRoles from "@/pages/self-roles";
import TicketsPage from "@/pages/tickets";
import ApplicationsPage from "@/pages/applications";
import XpSettingsPage from "@/pages/xp-settings";
import StatsChannels from "@/pages/stats-channels";
import Giveaways from "@/pages/giveaways";
import Setup from "@/pages/setup";
import Rules from "@/pages/rules";
import InviteManagement from "@/pages/invite-management";
import MessageLogs from "@/pages/message-logs";
import Verification from "@/pages/verification";
import Summary from "@/pages/summary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/bot" component={BotInfoPage} />
      <Route path="/guilds" component={Guilds} />
      <Route path="/guilds/:guildId" component={Summary} />
      <Route path="/guilds/:guildId/overview" component={GuildOverview} />
      <Route path="/guilds/:guildId/moderation" component={Moderation} />
      <Route path="/guilds/:guildId/warnings" component={Warnings} />
      <Route path="/guilds/:guildId/automod" component={Automod} />
      <Route path="/guilds/:guildId/role-management" component={RoleManagement} />
      <Route path="/guilds/:guildId/reaction-roles" component={ReactionRoles} />
      <Route path="/guilds/:guildId/self-roles" component={SelfRoles} />
      <Route path="/guilds/:guildId/commands" component={Commands} />
      <Route path="/guilds/:guildId/welcome" component={Welcome} />
      <Route path="/guilds/:guildId/leave" component={Leave} />
      <Route path="/guilds/:guildId/reminders" component={Reminders} />
      <Route path="/guilds/:guildId/polls" component={Polls} />
      <Route path="/guilds/:guildId/webhook-sender" component={WebhookSender} />
      <Route path="/guilds/:guildId/always-online" component={AlwaysOnlinePage} />
      <Route path="/guilds/:guildId/level-roles" component={LevelRoles} />
      <Route path="/guilds/:guildId/xp-settings" component={XpSettingsPage} />
      <Route path="/guilds/:guildId/tickets" component={TicketsPage} />
      <Route path="/guilds/:guildId/applications" component={ApplicationsPage} />
      <Route path="/guilds/:guildId/stats-channels" component={StatsChannels} />
      <Route path="/guilds/:guildId/giveaways" component={Giveaways} />
      <Route path="/guilds/:guildId/setup" component={Setup} />
      <Route path="/guilds/:guildId/rules" component={Rules} />
      <Route path="/guilds/:guildId/invite-management" component={InviteManagement} />
      <Route path="/guilds/:guildId/message-logs" component={MessageLogs} />
      <Route path="/guilds/:guildId/verification" component={Verification} />
      <Route path="/guilds/:guildId/summary" component={Summary} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
