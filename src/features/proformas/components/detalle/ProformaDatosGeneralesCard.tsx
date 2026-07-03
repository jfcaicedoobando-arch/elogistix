/**
 * Card "Datos generales" de la proforma — reemplaza a `TerminosPagoCard`.
 * Concentra en una sola tarjeta las fechas, vigencia, ejecutivo, BL Master,
 * días crédito, método de pago y folio de factura externa. Elimina la
 * duplicación con el header de la vista.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDiasCredito, nombreDesdeEmail } from "@/lib/formatters";
import { vigenciaPlus30 } from "@/features/proformas/domain/proformaDetalleHelpers";

interface Props {
  fechaEmision: string;
  diasCredito: number | null | undefined;
  folioFacturaExterna: string | null | undefined;
  operador: string | null | undefined;
  blMaster: string | null | undefined;
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono font-medium truncate" : "font-medium truncate"} title={value}>
        {value}
      </p>
    </div>
  );
}

export function ProformaDatosGeneralesCard({
  fechaEmision,
  diasCredito,
  folioFacturaExterna,
  operador,
  blMaster,
}: Props) {
  const ejecutivo = operador?.trim() ? nombreDesdeEmail(operador) : "—";
  const blMasterValor = blMaster?.trim() || "—";
  const folioValor = folioFacturaExterna?.trim() || "—";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Datos generales</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Field label="Fecha emisión" value={formatDate(fechaEmision)} />
        <Field label="Vigencia" value={vigenciaPlus30(fechaEmision)} />
        <Field label="Ejecutivo" value={ejecutivo} />
        <Field label="BL Master / MAWB" value={blMasterValor} mono />
        <Field label="Días crédito" value={formatDiasCredito(diasCredito)} />
        <Field label="Método de pago" value="Transferencia electrónica" />
        <Field label="Folio factura" value={folioValor} mono />
      </CardContent>
    </Card>
  );
}
