/**
 * Cards del dashboard `/compras`: "Top 5 proveedores con saldo" y "Últimas
 * facturas capturadas". Extraídos para respetar los límites de tamaño de la
 * ruta y facilitar pruebas unitarias.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/formatters";

export interface ProveedorSaldoRow {
  proveedor_id: string;
  proveedor_nombre: string;
  saldo_total: number;
}

export function TopProveedoresCard({ rows }: { rows: ProveedorSaldoRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 proveedores con saldo</CardTitle></CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Sin saldos pendientes.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((p) => (
              <li key={p.proveedor_id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="truncate font-medium">{p.proveedor_nombre}</span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {formatCurrency(p.saldo_total, "MXN")}
                </span>
              </li>
            ))}
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
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Últimas facturas capturadas</CardTitle></CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aún no hay facturas capturadas.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.proveedor_nombre ?? "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {f.folio_proveedor ?? "s/folio"} · {f.fecha_emision ? formatDate(f.fecha_emision) : "—"}
                  </p>
                </div>
                <span className="tabular-nums shrink-0">
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
