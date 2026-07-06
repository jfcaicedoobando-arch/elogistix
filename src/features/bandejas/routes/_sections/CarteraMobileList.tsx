/**
 * Vista mobile de Cartera (lista de tarjetas) — extraída en v13.182.0 (Wave 2).
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { CarteraRow } from "./carteraColumns";

interface Props {
  rows: CarteraRow[];
  isLoading: boolean;
}

export function CarteraMobileList({ rows, isLoading }: Props) {
  return (
    <Card className="sm:hidden">
      <CardContent className="p-0">
        {isLoading && (
          <div className="py-8 text-center text-muted-foreground">Cargando...</div>
        )}
        {!isLoading && rows.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Sin cartera pendiente. ¡Todo cobrado!
          </div>
        )}
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.factura_id} className="p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/facturacion/${row.factura_id}`}
                  className="font-semibold text-primary hover:underline truncate"
                >
                  {row.numero ?? "—"}
                </Link>
                <Badge variant={row.dias_vencido > 0 ? "destructive" : "secondary"}>
                  {row.dias_vencido}d
                </Badge>
              </div>
              <div className="text-sm font-medium truncate">{row.cliente_nombre ?? "—"}</div>
              {row.embarque_id && (
                <Link
                  to={`/embarques/${row.embarque_id}`}
                  className="text-xs text-primary hover:underline block truncate"
                >
                  {row.expediente ?? "—"}
                </Link>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>
                  Vence: {row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : "—"}
                </span>
                <span className="tabular-nums">
                  Total: {formatCurrency(Number(row.total), row.moneda)}
                </span>
              </div>
              <div className="text-right text-base font-semibold tabular-nums">
                {formatCurrency(Number(row.saldo), row.moneda)}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
