/**
 * Encabezado del `FormDialogShell`: icon-tile + título/descripción accesibles,
 * slot derecho para resumen vivo y stepper opcional de wizard.
 * Extraído del shell para respetar el límite de tamaño (Power-of-10 #4).
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormDialogStepper } from "./FormDialogStepper";

interface Props {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  headerAside?: ReactNode;
  stepper?: { step: number; totalSteps: number; labels?: string[] };
}

export function FormDialogHeaderBlock({
  icon: Icon,
  title,
  description,
  headerAside,
  stepper,
}: Props) {
  const showStepper = stepper !== undefined && stepper.totalSteps > 1;
  return (
    <DialogHeader className="px-6 pt-6 pb-4 border-b space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-body-sm text-muted-foreground leading-snug">
                {description}
              </DialogDescription>
            )}
          </div>
        </div>
        {headerAside && <div className="text-right shrink-0">{headerAside}</div>}
      </div>
      {showStepper && (
        <FormDialogStepper
          step={stepper.step}
          totalSteps={stepper.totalSteps}
          labels={stepper.labels}
        />
      )}
    </DialogHeader>
  );
}
