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
import { useCallback, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { useAutoFocusPrimerCampo } from "@/components/shared/utils/useAutoFocusPrimerCampo";
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
  /** Si se provee, renderiza un FormDialogStepper bajo el header. */
  stepper?: { step: number; totalSteps: number; labels?: string[] };
  footer: ReactNode;
  /**
   * Cuando se pasan `formId` + `onSubmit`, el cuerpo scrolleable se renderiza
   * como `<form id={formId}>` real: Enter guarda y el botón del footer sticky
   * envía con `type="submit" form={formId}` (ver `FormDialogFooter`).
   */
  formId?: string;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** Enfoca el primer campo útil al abrir (default: true si hay `formId`). */
  autoFocusFirstField?: boolean;
  /** Banda fija bajo el header, fuera del área scrolleable (KPIs, avisos). */
  stickyTop?: ReactNode;
  /** Banda fija sobre el footer, fuera del área scrolleable (semáforos). */
  stickyBottom?: ReactNode;
  /** Clases extra del contenedor scrolleable (p.ej. layout de 2 columnas). */
  bodyClassName?: string;
  /**
   * EC-13 — Cuando es `true` (formulario con captura), cerrar con ESC o clic
   * fuera pide confirmación antes de descartar lo capturado.
   */
  isDirty?: boolean;
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
  stepper,
  footer,
  formId,
  onSubmit,
  autoFocusFirstField,
  stickyTop,
  stickyBottom,
  bodyClassName,
  isDirty = false,
  children,
}: Props) {
  const showStepper = stepper !== undefined && stepper.totalSteps > 1;
  const enfocar = autoFocusFirstField ?? Boolean(formId);
  const bodyRef = useAutoFocusPrimerCampo(open, enfocar);
  const bodyClass = cn("flex-1 overflow-y-auto px-6 py-5 space-y-5", bodyClassName);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && isDirty) {
        setConfirmarDescartar(true);
        return;
      }
      onOpenChange(next);
    },
    [isDirty, onOpenChange],
  );

  const cerrarGuardado = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>

      {/* v13.423.0 — En pantallas bajas (720-768 px) el modal usa casi todo el

          alto disponible: antes el cuerpo scrolleable quedaba en ~290 px. */}
      <DialogContent
        className={cn(
          dialogSize[size],
          "max-h-[92vh] short:max-h-[calc(100dvh-1.5rem)] flex flex-col gap-0 p-0",
        )}
      >

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
              step={stepper!.step}
              totalSteps={stepper!.totalSteps}
              labels={stepper!.labels}
            />
          )}
        </DialogHeader>

        {stickyTop && (
          <div className="border-b bg-muted/30 px-6 py-3">{stickyTop}</div>
        )}

        {formId ? (
          <form
            id={formId}
            onSubmit={onSubmit}
            noValidate
            ref={bodyRef as React.Ref<HTMLFormElement>}
            className={bodyClass}
          >
            {children}
          </form>
        ) : (
          <div ref={bodyRef as React.Ref<HTMLDivElement>} className={bodyClass}>
            {children}
          </div>
        )}


        {stickyBottom && (
          <div className="border-t bg-muted/30 px-6 py-3">{stickyBottom}</div>
        )}

        <div className="border-t bg-background px-6 py-3 flex flex-wrap justify-end items-center gap-2">
          {footer}
        </div>

        <ConfirmActionDialog
          open={confirmarDescartar}
          onOpenChange={setConfirmarDescartar}
          title="¿Descartar los cambios?"
          description="Tienes datos capturados en este formulario. Si cierras ahora, se perderán."
          confirmLabel="Descartar"
          cancelLabel="Seguir capturando"
          variant="destructive"
          onConfirm={() => {
            setConfirmarDescartar(false);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>

  );
}
