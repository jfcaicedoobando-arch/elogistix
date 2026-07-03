/**
 * Card "Términos de pago" — vigencia (emisión + 30d), método de pago,
 * días de crédito y folio de factura externa asociado.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDiasCredito } from "@/lib/formatters";
import { vigenciaPlus30 } from "@/features/proformas/domain/proformaDetalleHelpers";

interface Props {
  fechaEmision: string;
  diasCredito: number | null | undefined;
  folioFacturaExterna: string | null | undefined;
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono truncate" : "truncate"} title={value}>{value}</p>
    </div>
  );
}

export function TerminosPagoCard({ fechaEmision, diasCredito, folioFacturaExterna }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Términos de pago</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Field label="Fecha emisión" value={formatDate(fechaEmision)} />
        <Field label="Vigencia" value={vigenciaPlus30(fechaEmision)} />
        <Field label="Método de pago" value="Transferencia electrónica" />
        <Field label="Días crédito" value={formatDiasCredito(diasCredito)} />
        <Field label="Folio factura" value={folioFacturaExterna?.trim() || "—"} mono />
      </CardContent>
    </Card>
  );
}
