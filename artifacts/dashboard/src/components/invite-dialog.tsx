import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Zap, Copy, Check, ExternalLink } from "lucide-react";

export const INVITE_FULL = "https://discord.com/oauth2/authorize?client_id=1521402625420034058&permissions=6202794886622326&response_type=code&redirect_uri=https%3A%2F%2Fumbra--utilshaiku.replit.app%2F&integration_type=0&scope=identify+bot+applications.commands.permissions.update";
export const INVITE_MIN  = "https://discord.com/oauth2/authorize?client_id=1521402625420034058&permissions=4513944463273046&response_type=code&redirect_uri=https%3A%2F%2Fumbra--utilshaiku.replit.app%2F&integration_type=0&scope=identify+bot+applications.commands.permissions.update";

export function InviteDialog({
  open,
  onClose,
  type,
}: {
  open: boolean;
  onClose: () => void;
  type: "full" | "min" | null;
}) {
  const [copied, setCopied] = useState(false);
  const url = type === "full" ? INVITE_FULL : INVITE_MIN;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!type) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-0" style={{ background: "#110822", color: "white" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white text-base font-bold">
            {type === "full" ? (
              <><Zap className="size-4 text-yellow-400" />Full Permissions Invite</>
            ) : (
              <><ShieldCheck className="size-4 text-green-400" />Bare Minimum Invite</>
            )}
          </DialogTitle>
          <DialogDescription className="text-purple-200/60 text-sm pt-1">
            {type === "full"
              ? "Grants all permissions the bot can use — moderation, tickets, webhooks, invite tracking, and everything else."
              : "Grants only what's needed for core moderation, welcome messages, XP, and roles. Disables tickets, webhooks, invite tracking, and server setup."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div
            className="rounded-xl p-3 text-xs font-mono break-all leading-relaxed"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#a78bfa" }}
          >
            {url}
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-purple-300/60 hover:text-white hover:bg-white/[0.06]"
              onClick={handleCopy}
            >
              {copied ? <Check className="size-3.5 text-green-400" /> : <Copy className="size-3.5" />}
              {copied ? "Copied!" : "Copy link"}
            </Button>
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button
                size="sm"
                className="w-full gap-2 shadow-lg"
                style={{
                  background: type === "full"
                    ? "linear-gradient(135deg, #7c3aed, #a855f7)"
                    : "linear-gradient(135deg, #059669, #10b981)",
                }}
              >
                <ExternalLink className="size-3.5" />
                Continue to Discord
              </Button>
            </a>
          </div>

          <p className="text-[11px] text-purple-200/30 text-center">
            You'll be taken to Discord's authorisation page to choose which server to add the bot to.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
