/**
 * Resumen visual de conceptos y totales de una proforma en el portal público.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { PortalProformaConcepto, PortalProformaData } from "@/features/proformas/services/portalPublico";

function fmtDinero(v: number | null | undefined, moneda: string | null | undefined): string {
  if (v == null) return "—";
  try {
    return formatCurrency(v, moneda || "MXN");
  } catch {
    return `${v} ${moneda ?? ""}`;
  }
}

interface Props {
  proforma: PortalProformaData;
  conceptos: PortalProformaConcepto[];
}

export function PortalProformaResumen({ proforma, conceptos }: Props) {
  const moneda = proforma.moneda ?? "MXN";
  return (
    <Card>
      <CardHeader>
        <CardTitle >Detalle de la proforma</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Número</div>
            <div className="font-semibold">{proforma.numero ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Embarque</div>
            <div className="font-semibold">{proforma.expediente ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Cliente</div>
            <div className="font-semibold">{proforma.cliente_nombre ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Moneda</div>
            <div className="font-semibold">{moneda}</div>
          </div>
        </div>

        {conceptos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2">Descripción</th>
                  <th className="py-2 px-2 text-right">Cantidad</th>
                  <th className="py-2 px-2 text-right">P. unit.</th>
                  <th className="py-2 pl-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {conceptos.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-2">{c.descripcion ?? "—"}</td>
                    <td className="py-2 px-2 text-right">{c.cantidad ?? "—"}</td>
                    <td className="py-2 px-2 text-right">{fmtDinero(c.precio_unitario, c.moneda ?? moneda)}</td>
                    <td className="py-2 pl-2 text-right">{fmtDinero(c.importe, c.moneda ?? moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{fmtDinero(proforma.subtotal, moneda)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA</span>
            <span>{fmtDinero(proforma.iva, moneda)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold border-t pt-2 mt-2">
            <span>Total</span>
            <span>{fmtDinero(proforma.total, moneda)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
