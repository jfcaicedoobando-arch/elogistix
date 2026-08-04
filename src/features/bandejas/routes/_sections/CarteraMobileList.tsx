/**
 * Vista mobile de Cartera (lista de tarjetas). v13.200.0: cada tarjeta es
 * navegable (role=link, teclado, Ctrl+click). Sin `<Link>` inline.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { handleRowClick, handleRowKeyDown } from "@/components/shared/dataTable/rowNav";
import type { CarteraRow } from "./carteraColumns";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";

interface Props {
  rows: CarteraRow[];
  isLoading: boolean;
}

export function CarteraMobileList({ rows, isLoading }: Props) {
  const navigate = useNavigate();
  return (
    <Card className="sm:hidden">
      <CardContent className="p-0">
        {isLoading && (
          <ListSkeleton variant="card" rows={4} />
        )}
        {!isLoading && rows.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Sin cartera pendiente. ¡Todo cobrado!
          </div>
        )}
        <ul className="divide-y">
          {rows.map((row) => {
            const href = `/facturacion/${row.factura_id}`;
            return (
              <li
                key={row.factura_id}
                role="link"
                tabIndex={0}
                aria-label={`Ver factura ${row.numero ?? ""}`}
                onClick={(e) => handleRowClick(e, { href, navigate })}
                onKeyDown={(e) => handleRowKeyDown(e, { href, navigate })}
                className="p-3 space-y-1.5 cursor-pointer hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold truncate">{row.numero ?? "—"}</span>
                  <Badge variant={row.dias_vencido > 0 ? "destructive" : "secondary"}>
                    {row.dias_vencido}d
                  </Badge>
                </div>
                <div className="text-sm font-medium truncate">{row.cliente_nombre ?? "—"}</div>
                {row.embarque_id && (
                  <div className="text-xs text-muted-foreground truncate font-mono">
                    Exp: {row.expediente ?? "—"}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Vence: {row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : "—"}</span>
                  <span className="tabular-nums">Total: {formatCurrency(Number(row.total), row.moneda)}</span>
                </div>
                <div className="text-right text-base font-semibold tabular-nums">
                  {formatCurrency(Number(row.saldo), row.moneda)}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
