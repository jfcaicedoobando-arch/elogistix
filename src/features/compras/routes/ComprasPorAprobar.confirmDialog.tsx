/**
 * AlertDialog de confirmación para aprobar facturas en lote.
 * Extraído de `ComprasPorAprobar.tsx` para respetar el límite de 200 líneas.
 * v13.232.0 · Migrado a `ConfirmActionDialog` (Lote 7d.2).
 *
 * FP-000221: si alguna seleccionada no está ligada a un embarque, se pide aquí
 * la justificación del gasto (la misma que exige la base de datos).
 */
import { pluralizar } from "@/lib/format/pluralizar";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/FormField";
import { formatCurrency } from "@/lib/formatters";
import {
  JUSTIFICACION_SIN_VINCULO_MIN,
  MOTIVO_RECHAZO_MAX,
} from "@/features/cxp/services";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cantidad: number;
  totalMxn: number;
  totalUsd: number;
  isRunning: boolean;
  /** Cuántas de las seleccionadas no están ligadas a un embarque. */
  requierenJustificacion?: number;
  justificacion?: string;
  onJustificacionChange?: (v: string) => void;
  onConfirm: () => void;
}

export function ConfirmarAprobacionLoteDialog({
  open, onOpenChange, cantidad, totalMxn, totalUsd, isRunning,
  requierenJustificacion = 0, justificacion = "", onJustificacionChange, onConfirm,
}: Props) {
  const texto = justificacion.trim();
  const pideJustificacion = requierenJustificacion > 0;
  const justificacionInvalida =
    pideJustificacion &&
    (texto.length < JUSTIFICACION_SIN_VINCULO_MIN || texto.length > MOTIVO_RECHAZO_MAX);

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={`Aprobar ${pluralizar(cantidad, "factura")} en lote`}
      confirmLabel={`Aprobar ${cantidad}`}
      isPending={isRunning}
      confirmDisabled={justificacionInvalida}
      onConfirm={onConfirm}
      description={
        <div className="space-y-2 text-sm">
          <p>
            Vas a aprobar <strong>{cantidad}</strong> solicitudes en un solo paso. El total involucrado es:
          </p>
          <ul className="list-disc pl-5 text-muted-foreground text-xs space-y-0.5">
            <li>{formatCurrency(totalMxn, "MXN")}</li>
            <li>{formatCurrency(totalUsd, "USD")}</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            El proceso corre factura por factura. Si alguna falla, te lo indicamos al final para revisarla manualmente.
          </p>
        </div>
      }
    >
      {pideJustificacion && (
        <FormField
          label="Justificación del gasto"
          required
          hint={`${requierenJustificacion} de las seleccionadas no está ligada a un embarque: escribe para qué fue el gasto (mínimo ${JUSTIFICACION_SIN_VINCULO_MIN} caracteres). Se guarda en la factura y en la bitácora.`}
          error={
            justificacionInvalida && texto.length > 0
              ? `Usa entre ${JUSTIFICACION_SIN_VINCULO_MIN} y ${MOTIVO_RECHAZO_MAX} caracteres.`
              : undefined
          }
        >
          <Textarea
            value={justificacion}
            onChange={(e) => onJustificacionChange?.(e.target.value)}
            maxLength={MOTIVO_RECHAZO_MAX}
            rows={3}
            placeholder="Ej. Renta de oficina de agosto según contrato vigente"
          />
        </FormField>
      )}
    </ConfirmActionDialog>
  );
}
