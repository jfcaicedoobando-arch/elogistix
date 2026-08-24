/**
 * Resumen compacto del último paso del wizard de captura (v13.712.0):
 * lo que se va a guardar, a la vista, sin tener que regresar de paso.
 */
import { ClipboardCheck } from "lucide-react";
import { FormSection } from "./facturaFormPrimitives";
import { formatCurrency, formatFechaDia } from "@/lib/formatters";

import type { FacturaFormValues } from "@/features/cxp/types";

interface Props {
  values: FacturaFormValues;
  total: number;
  vinculos: number;
  onEditarDatos: () => void;
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-overline font-medium text-muted-foreground">{label}</p>
      <p className="truncate text-body-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export function ResumenCapturaFactura({ values, total, vinculos, onEditarDatos }: Props) {
  const moneda = values.moneda;

  return (
    <FormSection
      icon={<ClipboardCheck className="h-3.5 w-3.5" />}
      title="Revisa antes de guardar"
    >
      <div className="rounded-md border bg-muted/20 p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Dato label="Proveedor" value={values.provNombre} />
          <Dato label="Folio" value={values.folio} />
          {/* emision/vencimiento son date-only (YYYY-MM-DD): formatFechaDia las
              ancla a mediodía UTC; formatFechaSegura(new Date) las corría un
              día en America/Mexico_City (frontend_hunter P2). */}
          <Dato label="Emisión" value={formatFechaDia(values.emision)} />
          <Dato label="Vencimiento" value={formatFechaDia(values.vencimiento)} />
          <Dato label={`Total ${moneda}`} value={formatCurrency(total, moneda)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-body-sm text-muted-foreground">
            {vinculos === 0
              ? "Sin costos del embarque vinculados."
              : `${vinculos} ${vinculos === 1 ? "costo vinculado" : "costos vinculados"}.`}
          </p>
          <button
            type="button"
            onClick={onEditarDatos}
            className="text-body-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Corregir datos de la factura
          </button>
        </div>
      </div>
    </FormSection>
  );
}
