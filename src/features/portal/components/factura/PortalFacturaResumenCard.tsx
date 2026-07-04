import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface Props {
  factura: {
    cliente_nombre: string;
    expediente: string;
    fecha_emision: string | null;
    fecha_vencimiento: string | null;
    moneda: string;
    tipo_cambio: number | null;
    referencia_bl: string | null;
    notas: string | null;
    subtotal: number;
    iva: number;
    total: number;
  };
}

export default function PortalFacturaResumenCard({ factura }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Datos de la factura</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="Cliente" value={factura.cliente_nombre} />
          <Field label="Expediente" value={factura.expediente} mono />
          <Field label="Moneda" value={factura.moneda} />
          <Field label="Fecha de emisión" value={factura.fecha_emision ? formatDate(factura.fecha_emision) : "—"} />
          <Field label="Fecha de vencimiento" value={factura.fecha_vencimiento ? formatDate(factura.fecha_vencimiento) : "—"} />
          {factura.moneda !== "MXN" && (
            <Field
              label="Tipo de cambio"
              value={factura.tipo_cambio ? `$${factura.tipo_cambio.toFixed(4)}` : "—"}
            />
          )}
          {factura.referencia_bl && (
            <Field label="Referencia BL" value={factura.referencia_bl} mono />
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 border-t pt-4">
          <Total label="Subtotal" value={formatCurrency(factura.subtotal, factura.moneda)} />
          <Total label="IVA" value={formatCurrency(factura.iva, factura.moneda)} />
          <Total label="Total" value={formatCurrency(factura.total, factura.moneda)} highlight />
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

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
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
