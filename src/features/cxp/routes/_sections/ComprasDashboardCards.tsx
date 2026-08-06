/**
 * Cards del dashboard `/compras`: "Top proveedores con saldo" y "Últimas
 * facturas capturadas". v13.307.22 — se agrega barra proporcional en Top
 * proveedores y link "Ver todas" en Últimas facturas.
 */
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/formatters";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

export interface ProveedorSaldoRow {
  proveedor_id: string;
  proveedor_nombre: string;
  saldo_total: number;
}

export function TopProveedoresCard({ rows }: { rows: ProveedorSaldoRow[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.saldo_total), 0);
  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex-row items-start justify-between gap-2 space-y-0">
        <CardTitle >Top proveedores con saldo</CardTitle>
        <Link
          to={ROUTES.COMPRAS_AGING}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Ver todo <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Sin saldos pendientes.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((p) => {
              const pct = max > 0 ? (p.saldo_total / max) * 100 : 0;
              return (
                <li key={p.proveedor_id} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="truncate font-medium">{p.proveedor_nombre}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0 text-xs">
                      {formatCurrencyCompact(p.saldo_total, "MXN")}
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full bg-primary/70")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export interface FacturaCapturadaRow {
  id: string;
  proveedor_nombre: string | null;
  folio_proveedor: string | null;
  fecha_emision: string | null;
  total: number | string;
  moneda: string | null;
}

export function UltimasFacturasCard({ rows }: { rows: FacturaCapturadaRow[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex-row items-start justify-between gap-2 space-y-0">
        <CardTitle >Últimas facturas capturadas</CardTitle>
        <Link
          to={ROUTES.COMPRAS_FACTURAS}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Ver todas <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aún no hay facturas capturadas.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.proveedor_nombre ?? "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {f.folio_proveedor ?? "s/folio"} · {f.fecha_emision ? formatDate(f.fecha_emision) : "—"}
                  </p>
                </div>
                <span className="tabular-nums shrink-0 text-sm">
                  {formatCurrency(Number(f.total), f.moneda ?? "MXN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
