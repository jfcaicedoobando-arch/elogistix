/**
 * FacturaResumenCard — datos generales de la factura para la vista admin.
 * Incluye links a cliente, embarque y proforma origen cuando existen.
 */
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import type { FacturaDetalle } from "@/hooks/facturacion";

interface Props {
  factura: FacturaDetalle;
}

export function FacturaResumenCard({ factura }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Datos de la factura</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field
            label="Cliente"
            value={
              factura.cliente_id ? (
                <Link to={`/clientes/${factura.cliente_id}`} className="text-accent hover:underline">
                  {toTitleCase(factura.cliente_nombre)}
                </Link>
              ) : (
                toTitleCase(factura.cliente_nombre)
              )
            }
          />
          <Field
            label="Expediente"
            mono
            value={
              factura.embarque_id ? (
                <Link to={`/embarques/${factura.embarque_id}`} className="text-accent hover:underline">
                  {factura.expediente}
                </Link>
              ) : (
                factura.expediente
              )
            }
          />
          <Field label="Moneda" value={factura.moneda} />
          <Field label="Emisión" value={factura.fecha_emision ? formatDate(factura.fecha_emision) : "—"} />
          <Field
            label="Vencimiento"
            value={factura.fecha_vencimiento ? formatDate(factura.fecha_vencimiento) : "—"}
          />
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
                  <Link to={`/facturacion?proforma=${factura.proforma_id}`} className="text-accent hover:underline">
                    {factura.proformas.numero}
                  </Link>
                ) : (
                  factura.proformas.numero
                )
              }
            />
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 border-t pt-4">
          <Total label="Subtotal" value={formatCurrency(Number(factura.subtotal), factura.moneda)} />
          <Total label="IVA" value={formatCurrency(Number(factura.iva), factura.moneda)} />
          <Total label="Total" value={formatCurrency(Number(factura.total), factura.moneda)} highlight />
        </div>

        {factura.notas && (
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground mb-1">Notas</p>
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
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={`font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Total({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? "bg-accent/5 border-accent/20" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-bold tabular-nums ${highlight ? "text-base text-accent" : "text-sm"}`}>{value}</p>
    </div>
  );
}
