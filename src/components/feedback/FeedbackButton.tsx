import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FeedbackDialog } from "./FeedbackDialog";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  variant?: "ghost" | "outline";
  className?: string;
}

export function FeedbackButton({ variant = "ghost", className }: Props) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Reportar bug o mejora"
            className={className}
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Reportar bug o sugerir mejora
        </TooltipContent>
      </Tooltip>
      {open && <FeedbackDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}
