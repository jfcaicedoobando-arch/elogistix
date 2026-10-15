/** CTA de demo: esta release no abre formularios ni inicia acceso. */
import { useId } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { DEMO_ACCESS_AVAILABILITY } from "@/features/marketing/lib/demoAccessAvailability";

interface Props extends Omit<ButtonProps, "onClick" | "disabled" | "children" | "asChild"> {
  /** Se conserva la API de los CTA; la disponibilidad tiene prioridad. */
  label?: string;
  hideIcon?: boolean;
}

export function ProbarDemoButton({ label: _label, hideIcon = false, ...rest }: Props) {
  const descriptionId = useId();

  return (
    <>
      <Button
        {...rest}
        asChild={false}
        type="button"
        onClick={undefined}
        disabled={DEMO_ACCESS_AVAILABILITY.status === "unavailable"}
        aria-label={DEMO_ACCESS_AVAILABILITY.label}
        aria-describedby={descriptionId}
      >
        {hideIcon ? null : <Sparkles className="mr-1 h-4 w-4" aria-hidden />}
        {DEMO_ACCESS_AVAILABILITY.label}
      </Button>
      <span id={descriptionId} className="sr-only">{DEMO_ACCESS_AVAILABILITY.message}</span>
    </>
  );
}
