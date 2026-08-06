/**
 * Lista Top-5 de cartera (deudores o acreedores) con días vencidos coloreados
 * por severidad y pie con el total real de la cartera vencida.
 */
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatCurrency } from "@/lib/formatters/numbers";
import { agingTextClass } from "@/features/tesoreria/domain/agingTone";
import type { TopItem } from "@/features/tesoreria/domain/resumen.types";
import { cn } from "@/lib/utils";

interface Props {
  titulo: string;
  items: TopItem[];
  vacio: string;
  /** Tono del importe: cobranza (rojo) vs pagos (ámbar). */
  tono: "cobrar" | "pagar";
  totalVencido: number;
  countVencido: number;
  verTodoLabel: string;
  verTodoTo: string;
}

export function TesoreriaTopCartera({
  titulo, items, vacio, tono, totalVencido, countVencido, verTodoLabel, verTodoTo,
}: Props) {
  const montoClass = tono === "cobrar" ? "text-destructive" : "text-warning";
  return (
    <Card className="flex flex-col">
      <CardContent density="compact" className="flex flex-1 flex-col">
        <SectionHeading as="h3" className="mb-3">{titulo}</SectionHeading>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vacio}</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {items.map((d) => (
              <li
                key={`${d.nombre}-${d.moneda}`}
                className="flex items-center justify-between border-b pb-1.5 last:border-0"
              >
                <span className="flex-1 truncate" title={d.nombre}>{d.nombre}</span>
                <span className={cn("ml-2 font-medium tabular-nums", montoClass)}>
                  {formatCurrency(d.saldo, d.moneda)}
                </span>
                <span className={cn("ml-2 w-14 text-right text-xs font-medium tabular-nums", agingTextClass(d.dias))}>
                  {d.dias != null ? `${d.dias}d` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
          <span>
            Total vencido: <span className="font-medium text-foreground tabular-nums">
              {formatCurrency(totalVencido, "MXN")}
            </span>{" "}
            ({countVencido} {countVencido === 1 ? "factura" : "facturas"})
          </span>
          <Link to={verTodoTo} className="inline-flex items-center gap-1 text-accent hover:underline">
            {verTodoLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
