import { MessageSquarePlus } from "lucide-react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/shared/useToast";

interface Props {
  variant?: "ghost" | "outline";
  className?: string;
}

/**
 * Dispara el widget oficial de Sentry User Feedback.
 * Sentry maneja el modal, la captura de pantalla y el envío.
 */
export function FeedbackButton({ variant = "ghost", className }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  if (!user) return null;

  const handleClick = async () => {
    const feedback = Sentry.getFeedback();
    if (!feedback) {
      toast({
        title: "Reporte no disponible",
        description: "El sistema de feedback no se inicializó correctamente.",
        variant: "destructive",
      });
      return;
    }
    try {
      const form = await feedback.createForm();
      form.appendToDom();
      form.open();
    } catch {
      toast({ title: "No se pudo abrir el formulario", variant: "destructive" });
    }
  };

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="icon"
          onClick={handleClick}
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
  );
}
