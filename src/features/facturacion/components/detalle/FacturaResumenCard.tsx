/**
 * FacturaResumenCard — "Datos generales" del CFDI.
 * v13.164.3: se removieron duplicados con el header (Cliente, Expediente,
 * Moneda, Total) y el bloque de totales pasó a `FacturaTotalesCard`.
 * Ahora muestra fechas, referencias fiscales legibles (uso CFDI, forma y
 * método de pago), días de crédito, tipo de cambio, referencia BL,
 * proforma origen y notas.
 */
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";
import type { FacturaDetalle } from "@/features/facturacion/hooks";

interface Props {
  factura: FacturaDetalle;
}

function labelDe(options: readonly { value: string; label: string }[], clave: string | null | undefined) {
  if (!clave) return "—";
  const o = options.find((x) => x.value === clave);
  return o ? o.label : clave;
}

export function FacturaResumenCard({ factura }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos generales</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Emisión" value={factura.fecha_emision ? formatDate(factura.fecha_emision) : "—"} />
          <Field
            label="Vencimiento"
            value={factura.fecha_vencimiento ? formatDate(factura.fecha_vencimiento) : "—"}
          />
          <Field label="Días de crédito" value={String(factura.dias_credito ?? 0)} />
          <Field label="Uso CFDI" value={labelDe(USOS_CFDI_SAT, factura.uso_cfdi)} />
          <Field label="Forma de pago" value={labelDe(FORMAS_PAGO_SAT, factura.forma_pago)} />
          <Field label="Método de pago" value={labelDe(METODOS_PAGO_SAT, factura.metodo_pago)} />
          {factura.moneda !== "MXN" && (
            <Field label="Tipo de cambio" value={`$${Number(factura.tipo_cambio).toFixed(4)}`} />
          )}
          {factura.referencia_bl && <Field label="Referencia BL" mono value={factura.referencia_bl} />}
          {factura.proformas?.numero && (
            <Field
              label="Proforma origen"
              mono
              value={
                factura.proforma_id ? (
                  <Link to={`/proformas/${factura.proforma_id}`} className="text-accent hover:underline">
                    {factura.proformas.numero}
                  </Link>
                ) : (
                  factura.proformas.numero
                )
              }
            />
          )}
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
