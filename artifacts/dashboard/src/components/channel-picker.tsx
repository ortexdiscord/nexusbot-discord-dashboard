import { useParams } from "wouter";
import { useGetGuild, getGetGuildQueryKey } from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ChannelPicker({
  value,
  onChange,
  placeholder = "Select a channel",
  filter = (ch: any) => ch.type === "text",
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  filter?: (ch: any) => boolean;
}) {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: guild } = useGetGuild(guildId!, {
    query: { enabled: !!guildId, queryKey: getGetGuildQueryKey(guildId!) },
  });

  const channels = (guild?.channels ?? []).filter(filter);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        {channels.map((ch: any) => (
          <SelectItem key={ch.id} value={ch.id} className="focus:bg-accent focus:text-accent-foreground">
            #{ch.name}
          </SelectItem>
        ))}
        {channels.length === 0 && (
          <SelectItem value="" disabled>No channels available</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
