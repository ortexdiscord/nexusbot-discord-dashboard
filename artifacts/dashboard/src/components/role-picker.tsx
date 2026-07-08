import { useParams } from "wouter";
import { useGetGuild, getGetGuildQueryKey } from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RolePicker({
  value,
  onChange,
  onChangeWithName,
  placeholder = "Select a role",
}: {
  value: string;
  onChange: (val: string) => void;
  onChangeWithName?: (id: string, name: string) => void;
  placeholder?: string;
}) {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: guild } = useGetGuild(guildId!, {
    query: { enabled: !!guildId, queryKey: getGetGuildQueryKey(guildId!) },
  });

  const roles = (guild?.roles ?? []).filter((r: any) => r.name !== "@everyone");

  const handleChange = (selectedId: string) => {
    onChange(selectedId);
    if (onChangeWithName) {
      const role = roles.find((r: any) => r.id === selectedId);
      if (role) onChangeWithName(selectedId, role.name);
    }
  };

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        {roles.map((r: any) => {
          const colorHex = r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#94a3b8";
          return (
            <SelectItem key={r.id} value={r.id}>
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: colorHex }}
                />
                <span>{r.name}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
