/**
 * Paso 4 — Cancelar el CFDI original (motivo 01 con sustituta, o 02 si la
 * nueva factura se emitió sin relación).
 */
import { Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { originalFueraDeCirculacion } from "@/features/facturacion/domain/refacturacionPasos";
import type {
  FacturaRefacturacionEstado, RutaFiscalRefacturacion,
} from "@/features/facturacion/services/refacturacion";

interface Props {
  original: FacturaRefacturacionEstado | null;
  rutaFiscal: RutaFiscalRefacturacion;
  cancelando: boolean;
  onCancelar: () => void;
  onRefrescar: () => void;
  puedeOperar?: boolean;
}

export function PasoCancelarOriginal(props: Props) {
  const cancelada = originalFueraDeCirculacion(props.original);

  return (
    <FormDialogSection
      title="Cancelación del CFDI original"
      description="Se cancela ante el SAT con el motivo de la ruta elegida en el paso 1."
      flat
    >
      <div className="rounded-md border p-3 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{props.original?.numero ?? "—"}</p>
          <Badge variant={cancelada ? "secondary" : "outline"}>
            {props.original?.estado ?? "—"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Motivo SAT a usar: <strong>{props.rutaFiscal}</strong>
          {props.rutaFiscal === "01"
            ? " · sustitución (se referencia el UUID de la nueva factura)"
            : " · comprobante emitido con errores sin relación"}
        </p>
      </div>

      {cancelada ? (
        <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
          <span>La factura original ya está fuera de circulación. Puedes continuar.</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
            Si el CFDI supera $1,000 MXN, el SAT puede tardar hasta 72 h en aceptar la
            cancelación (regla 2.7.1.34). El sistema da seguimiento automático y este
            asistente permitirá continuar cuando la cancelación quede firme.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={props.onCancelar}
              loading={props.cancelando}
              disabled={props.puedeOperar === false}
            >
              <Ban className="h-4 w-4 mr-1" /> Cancelar factura original
            </Button>
            <Button variant="outline" onClick={props.onRefrescar}>Actualizar estado</Button>
          </div>
        </div>
      )}
    </FormDialogSection>
  );
}
