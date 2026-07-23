/**
 * FacturaResumenCard — "Datos generales" del CFDI (bloque operativo).
 * v13.308.16: los campos fiscales (Uso CFDI / Forma / Método de pago)
 * se movieron a `FacturaTimbradoCard` para separar operativo de fiscal;
 * aquí quedan fechas, crédito, tipo de cambio, referencia BL y notas.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import type { FacturaDetalle } from "@/features/facturacion/hooks";

interface Props {
  factura: FacturaDetalle;
}

export function FacturaResumenCard({ factura }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos generales</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Emisión" value={factura.fecha_emision ? formatDate(factura.fecha_emision) : "—"} />
          <Field
            label="Vencimiento"
            value={factura.fecha_vencimiento ? formatDate(factura.fecha_vencimiento) : "—"}
          />
          <Field label="Días de crédito" value={String(factura.dias_credito ?? 0)} />
          {factura.moneda !== "MXN" ? (
            <Field label="Tipo de cambio" value={`$${Number(factura.tipo_cambio).toFixed(4)}`} />
          ) : (
            <Field label="Moneda" value={factura.moneda} />
          )}
          {factura.referencia_bl && <Field label="Referencia BL" mono value={factura.referencia_bl} />}
        </div>

        {factura.notas && (
          <div className="border-t pt-4">
            <p className="text-label font-medium uppercase tracking-wide text-muted-foreground mb-1">Notas</p>
            <p className="text-sm whitespace-pre-wrap">{factura.notas}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className={`text-sm font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
