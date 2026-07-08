import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListGuilds, getListGuildsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Users, ChevronRight } from "lucide-react";

export default function Guilds() {
  const [, navigate] = useLocation();
  const { data: guilds, isLoading } = useListGuilds({
    query: { queryKey: getListGuildsQueryKey() }
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Servers</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Select a server to manage</p>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : !guilds?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bot className="size-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No servers found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {guilds.map(guild => (
              <Card key={guild.id} className="border-border/50 bg-card/50 hover:bg-card/80 transition-colors cursor-pointer" onClick={() => navigate(`/guilds/${guild.id}`)}>
                <CardContent className="p-4 flex items-center gap-4">
                  {guild.icon ? (
                    <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} className="size-10 rounded-xl" alt="" />
                  ) : (
                    <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {guild.name[0]}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{guild.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="size-3" />{guild.memberCount?.toLocaleString() ?? "—"} members
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
