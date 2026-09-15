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
import { Hint } from "@/components/shared/Hint";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Wallet } from "lucide-react";

interface Props {
  titulo: string;
  items: TopItem[];
  vacio: string;
  /** Tono del importe: cobranza (rojo) vs pagos (ámbar). */
  tono: "cobrar" | "pagar";
  totalVencido: number;
  countVencido: number;
  /**
   * FIN-NEW-02 — saldos vencidos en divisa que quedaron FUERA de `totalVencido`
   * por falta de tipo de cambio confiable, por moneda. Se muestran junto al pie
   * para que "Total vencido MXN 0 (1 factura)" nunca aparezca sin explicación.
   */
  excluidoPorMoneda?: Record<string, number>;
  verTodoLabel: string;
  verTodoTo: string;
}

export function TesoreriaTopCartera({
  titulo, items, vacio, tono, totalVencido, countVencido, verTodoLabel, verTodoTo,
  excluidoPorMoneda,
}: Props) {
  const excluidas = Object.entries(excluidoPorMoneda ?? {}).filter(([, monto]) => monto > 0);
  const montoClass = tono === "cobrar" ? "text-destructive" : "text-warning";
  return (
    <Card className="flex flex-col">
      <CardContent density="compact" className="flex flex-1 flex-col">
        <SectionHeading as="h3" className="mb-3">{titulo}</SectionHeading>
        {items.length === 0 ? (
          <EmptyStateInline icon={Wallet} message={vacio} className="py-4" />
        ) : (
          <ul className="space-y-1.5 text-body">
            {items.map((d) => (
              <li
                key={`${d.nombre}-${d.moneda}`}
                className="flex items-center justify-between border-b pb-1.5 last:border-0"
              >
                <Hint label={d.nombre}><span className="flex-1 truncate">{d.nombre}</span></Hint>
                <span className={cn("ml-2 font-medium tabular-nums", montoClass)}>
                  {formatCurrency(d.saldo, d.moneda)}
                </span>
                <span className={cn("ml-2 w-14 text-right text-body-sm font-medium tabular-nums", agingTextClass(d.dias))}>
                  {d.dias != null ? `${d.dias}d` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-body-sm text-muted-foreground">
          <span>
            Total vencido: <span className="font-medium text-foreground tabular-nums">
              {formatCurrency(totalVencido, "MXN")}
            </span>{" "}
            ({countVencido} {countVencido === 1 ? "factura" : "facturas"})
            {excluidas.length > 0 && (
              <span className="ml-1 text-warning">
                · sin T.C.:{" "}
                {excluidas.map(([moneda, monto]) => formatCurrency(monto, moneda)).join(" · ")}
              </span>
            )}
          </span>
          <Link to={verTodoTo} className="inline-flex items-center gap-1 text-accent hover:underline">
            {verTodoLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
