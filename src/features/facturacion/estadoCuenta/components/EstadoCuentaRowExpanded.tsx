import { formatCurrency, formatDate } from "@/lib/formatters";
import { ArrowDownCircle, FileMinus2 } from "lucide-react";
import type { FacturaEstadoCuenta } from "../services/estadoCuenta";

interface Props {
  factura: FacturaEstadoCuenta;
}

export function EstadoCuentaRowExpanded({ factura }: Props) {
  const { pagos, notas_credito, moneda } = factura;

  if (pagos.length === 0 && notas_credito.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground bg-muted/30">
        Sin pagos ni notas de crédito aplicadas.
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/30 space-y-4">
      {pagos.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            <ArrowDownCircle className="h-3.5 w-3.5 text-success" />
            Pagos aplicados ({pagos.length})
          </div>
          <div className="rounded border bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Fecha</th>
                  <th className="text-left px-3 py-1.5 font-medium">Forma de pago</th>
                  <th className="text-left px-3 py-1.5 font-medium">Referencia</th>
                  <th className="text-right px-3 py-1.5 font-medium">Monto aplicado</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-1.5 tabular-nums">{formatDate(p.fecha_pago)}</td>
                    <td className="px-3 py-1.5">{p.forma_pago ?? "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.referencia ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-success font-medium">
                      {formatCurrency(p.monto_aplicado, moneda)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {notas_credito.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            <FileMinus2 className="h-3.5 w-3.5 text-info" />
            Notas de crédito aplicadas ({notas_credito.length})
          </div>
          <div className="rounded border bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Fecha</th>
                  <th className="text-left px-3 py-1.5 font-medium">Folio</th>
                  <th className="text-right px-3 py-1.5 font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {notas_credito.map((n) => (
                  <tr key={n.id} className="border-t">
                    <td className="px-3 py-1.5 tabular-nums">{formatDate(n.fecha_emision)}</td>
                    <td className="px-3 py-1.5">{n.folio ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-info font-medium">
                      {formatCurrency(n.monto, moneda)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
