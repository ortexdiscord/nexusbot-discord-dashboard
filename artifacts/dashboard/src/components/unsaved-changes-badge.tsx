import { Circle } from "lucide-react";

export function UnsavedChangesBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-400 animate-in fade-in slide-in-from-right-1">
      <Circle className="size-2 fill-yellow-400 text-yellow-400 animate-pulse" />
      You changed something! Save it
    </span>
  );
}
