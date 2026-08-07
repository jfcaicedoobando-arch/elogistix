import { MessageSquarePlus } from "lucide-react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/contexts/AuthContext";

import { notifyError } from "@/lib/ui/appFeedback";
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
  if (!user) return null;

  const handleClick = async () => {
    // Import dinámico: `@sentry/react` + `@sentry/feedback` (~73 KB gz) no
    // deben entrar al bundle inicial (Layout es parte del entry chunk).
    const Sentry = await import("@sentry/react");
    const feedback = Sentry.getFeedback();
    if (!feedback) {
      notifyError(undefined, { title: "Reporte no disponible",
        description: "El sistema de feedback no se inicializó correctamente.", method: "COMPONENTS_FEEDBACK_FEEDBACKBUTTON_1" });
      return;
    }
    try {
      const form = await feedback.createForm();
      form.appendToDom();
      form.open();
    } catch {
      notifyError(undefined, { title: "No se pudo abrir el formulario", method: "COMPONENTS_FEEDBACK_FEEDBACKBUTTON_2" });
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
