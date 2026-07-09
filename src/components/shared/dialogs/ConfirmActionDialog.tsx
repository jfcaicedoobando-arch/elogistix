/**
 * `<ConfirmActionDialog />` — confirmación simple con variantes.
 *
 * Cubre los "¿Estás seguro?" que hoy se repiten en cada página con
 * `AlertDialog` inline. Para borrados irreversibles usa
 * `<DeleteConfirmDialog />` (typable ELIMINAR).
 */
import type * as React from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { cn } from "@/lib/utils";

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** String o ReactNode; usa ReactNode para incluir <strong>, listas o spinners. */
  description?: React.ReactNode;
  /** Contenido adicional (inputs, textarea, checkbox, radio) entre descripción y footer. */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  isPending?: boolean;
  /** Deshabilita el botón de confirmar (además de `isPending`). Útil para gating por form. */
  confirmDisabled?: boolean;
  /** Tamaño del contenido. Default `sm`; usa `md` cuando hay `children` con inputs. */
  size?: "sm" | "md";
  /** Icono opcional junto al título (p. ej. <AlertTriangle />). */
  titleIcon?: React.ReactNode;
  /** Aplica text-destructive al título. Útil para destructive con icono. */
  titleDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  isPending = false,
  confirmDisabled = false,
  size = "sm",
  titleIcon,
  titleDestructive = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={dialogSize[size]}>
        <AlertDialogHeader>
          <AlertDialogTitle
            className={cn(
              titleIcon && "flex items-center gap-2",
              titleDestructive && "text-destructive",
            )}
          >
            {titleIcon}
            {title}
          </AlertDialogTitle>
          {description ? (
            typeof description === "string" ? (
              <AlertDialogDescription>{description}</AlertDialogDescription>
            ) : (
              <AlertDialogDescription asChild>
                <div className="text-sm text-muted-foreground">{description}</div>
              </AlertDialogDescription>
            )
          ) : null}
        </AlertDialogHeader>
        {children ? <div className="space-y-3 py-2">{children}</div> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              variant === "destructive" &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
            disabled={isPending || confirmDisabled}
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Procesando…
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
