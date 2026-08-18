/**
 * Tabla expandible: una fila por semana ISO con totales + detalle al click.
 */
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/numbers";
import { Card, CardContent } from "@/components/ui/card";
import type { SemanaFlujo } from "@/features/tesoreria/services";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { SectionHeading } from "@/components/shared/SectionHeading";

interface Props { semanas: SemanaFlujo[] }

export default function TablaFlujoSemanal({ semanas }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left w-8"></th>
              <th className="px-3 py-2 text-left">Semana</th>
              <th className="px-3 py-2 text-left">Periodo</th>
              <th className="px-3 py-2 text-right">Entradas</th>
              <th className="px-3 py-2 text-right">Salidas</th>
              <th className="px-3 py-2 text-right">Flujo neto</th>
              <th className="px-3 py-2 text-right">Saldo proyectado</th>
            </tr>
          </thead>
          <tbody>
            {semanas.map((s, i) => {
              const isOpen = expanded.has(s.semana_iso);
              const saldoNeg = s.saldo_proyectado_mxn < 0;
              const rowBg = i % 2 === 1 ? "bg-muted/20" : "";
              return (
                <Fragment key={s.semana_iso}>
                  <tr
                    className={`border-t cursor-pointer hover:bg-accent/10 ${rowBg}`}
                    onClick={() => toggle(s.semana_iso)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Colapsar" : "Expandir"} detalle de la semana ${s.semana_iso}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(s.semana_iso);
                      }
                    }}
                  >
                    <td className="px-3 py-2">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-3 py-2 font-medium">{s.semana_iso}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.inicio} → {s.fin}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-success">{formatCurrency(s.entradas_mxn, "MXN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">{formatCurrency(s.salidas_mxn, "MXN")}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${s.flujo_neto_mxn >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(s.flujo_neto_mxn, "MXN")}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${saldoNeg ? "text-destructive" : ""}`}>
                      {formatCurrency(s.saldo_proyectado_mxn, "MXN")}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className={rowBg}>
                      <td></td>
                      <td colSpan={6} className="px-3 py-2 text-xs">
                        <DetalleListas s={s} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DetalleListas({ s }: { s: SemanaFlujo }) {
  return (
    <div className="grid md:grid-cols-2 gap-4 py-2">
      <div>
        <SectionHeading as="h3" variant="subsection" count={s.detalle_entradas.length} className="mb-1 text-success">
          Entradas
        </SectionHeading>
        {s.detalle_entradas.length === 0 ? (
          <EmptyStateInline message="Sin movimientos." density="compact" className="py-2" />
        ) : (
          <ul className="space-y-0.5">
            {s.detalle_entradas.map((d) => (
              <li key={d.id} className="flex justify-between border-b last:border-0 py-0.5">
                <span className="truncate flex-1 mr-2">{d.concepto}</span>
                <span className="tabular-nums">{formatCurrency(d.monto_mxn, "MXN")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <SectionHeading as="h3" variant="subsection" count={s.detalle_salidas.length} className="mb-1 text-destructive">
          Salidas
        </SectionHeading>
        {s.detalle_salidas.length === 0 ? (
          <EmptyStateInline message="Sin movimientos." density="compact" className="py-2" />
        ) : (
          <ul className="space-y-0.5">
            {s.detalle_salidas.map((d) => (
              <li key={d.id} className="flex justify-between border-b last:border-0 py-0.5">
                <span className="truncate flex-1 mr-2">{d.concepto}</span>
                <span className="tabular-nums">{formatCurrency(d.monto_mxn, "MXN")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
