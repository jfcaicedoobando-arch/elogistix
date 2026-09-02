/**
 * Tarjeta móvil del tab Proyección (/facturacion → Proyección mensual).
 * Migra la tabla de escritorio a `ResponsiveDataTable` conservando
 * expediente, cliente, ETA, estado y venta MXN para decidir sin scroll
 * horizontal.
 */
import { Badge } from "@/components/ui/badge";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import type { GrupoProyeccion } from "@/features/facturacion/domain/proyeccionFacturacion";

export function ProyeccionMobileCard({ grupo }: { grupo: GrupoProyeccion }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-semibold text-body truncate font-mono">{grupo.expediente}</div>
        <div className="text-body-sm text-muted-foreground truncate">
          {toTitleCase(grupo.cliente_nombre ?? "") || "—"}
        </div>
        <div className="flex items-center gap-1.5 text-label text-muted-foreground">
          <span>{grupo.eta ? formatDate(grupo.eta) : "—"}</span>
          {grupo.estado === "Facturado" ? (
            <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/20">
              Facturado
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              Pendiente
            </Badge>
          )}
        </div>
      </div>
      <MoneyCell
        label="Venta MXN"
        value={formatCurrency(grupo.ventaMxn, "MXN")}
        highlight
        className="shrink-0 max-w-[48%]"
      />
    </div>
  );
}
