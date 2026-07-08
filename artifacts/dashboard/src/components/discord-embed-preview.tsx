import { cn } from "@/lib/utils";

export function DiscordEmbedPreview({
  color = "#7C3AED",
  title,
  description,
  authorName,
  authorAvatar,
  footer,
  fields,
  thumbnail,
  className,
}: {
  color?: string;
  title?: string;
  description?: string;
  authorName?: string;
  authorAvatar?: string;
  footer?: string | null;
  fields?: { name: string; value: string; inline?: boolean }[];
  thumbnail?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-[#2b2d31] overflow-hidden max-w-md", className)}>
      <div className="flex">
        <div className="w-1 shrink-0" style={{ backgroundColor: color }} />
        <div className="flex-1 p-3 bg-[#2b2d31]">
          {authorName && (
            <div className="flex items-center gap-2 mb-2">
              {authorAvatar && (
                <img src={authorAvatar} alt="" className="size-5 rounded-full" />
              )}
              <span className="text-xs text-white font-medium">{authorName}</span>
            </div>
          )}
          {title && <p className="text-sm font-semibold text-white mb-1">{title}</p>}
          {description && (
            <p className="text-xs text-[#dbdee1] leading-relaxed whitespace-pre-wrap">{description}</p>
          )}
          {fields && fields.length > 0 && (
            <div className="mt-2 grid grid-cols-1 gap-1">
              {fields.map((f, i) => (
                <div key={i} className={f.inline ? "inline-block mr-4" : ""}>
                  <p className="text-[10px] font-semibold text-[#949ba4] uppercase">{f.name}</p>
                  <p className="text-xs text-[#dbdee1]">{f.value}</p>
                </div>
              ))}
            </div>
          )}
          {thumbnail && (
            <img src={thumbnail} alt="" className="mt-2 rounded-md max-h-32 object-cover" />
          )}
          {footer && <p className="text-[10px] text-[#949ba4] mt-2">{footer}</p>}
        </div>
      </div>
    </div>
  );
}
