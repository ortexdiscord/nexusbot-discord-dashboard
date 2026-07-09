import { Save } from "lucide-react";

export function UnsavedChangesBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-400 animate-in fade-in slide-in-from-bottom-2">
      <Save className="size-3 text-yellow-400 animate-pulse" />
      Unsaved changes
    </span>
  );
}
