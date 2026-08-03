/**
 * Shell unificado para modales tipo formulario (Cliente / Proveedor / Factura, etc).
 * Estandariza:
 *  - Header con icon-tile (cuadrado redondeado con ícono semántico) + título + descripción.
 *  - Slot derecho opcional para resumen vivo (totales, badges de validación, etc).
 *  - Stepper visual opcional para wizards (debajo del header).
 *  - Cuerpo scrolleable con padding consistente.
 *  - Footer sticky con separador y alineado a la derecha.
 *
 * Mantiene `Dialog` accesible (DialogTitle/Description siempre presentes).
 * No introduce nuevos tokens de color: usa `bg-primary/10`, `text-primary`, `border`.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { FormDialogStepper } from "./FormDialogStepper";

type Size = keyof typeof dialogSize;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;

  size?: Size;
  /** Slot derecho del header (p.ej. chip de Total en facturas). */
  headerAside?: ReactNode;
  /** Si se proveen, renderiza un FormDialogStepper bajo el header. */
  step?: number;
  totalSteps?: number;
  stepLabels?: string[];
  footer: ReactNode;
  /** Banda fija bajo el header, fuera del área scrolleable (KPIs, avisos). */
  stickyTop?: ReactNode;
  /** Banda fija sobre el footer, fuera del área scrolleable (semáforos). */
  stickyBottom?: ReactNode;
  /** Clases extra del contenedor scrolleable (p.ej. layout de 2 columnas). */
  bodyClassName?: string;
  children: ReactNode;
}

export function FormDialogShell({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  size = "lg",
  headerAside,
  step,
  totalSteps,
  stepLabels,
  footer,
  children,
}: Props) {
  const showStepper = typeof step === "number" && typeof totalSteps === "number" && totalSteps > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogSize[size], "max-h-[90vh] flex flex-col gap-0 p-0")}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <DialogTitle className="text-base font-semibold leading-tight">{title}</DialogTitle>
                {description && (
                  <DialogDescription className="text-xs text-muted-foreground leading-snug">
                    {description}
                  </DialogDescription>
                )}
              </div>
            </div>
            {headerAside && <div className="text-right shrink-0">{headerAside}</div>}
          </div>
          {showStepper && (
            <FormDialogStepper step={step!} totalSteps={totalSteps!} labels={stepLabels} />
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">{children}</div>

        <div className="border-t bg-background px-6 py-3 flex flex-wrap justify-end items-center gap-2">
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}
