/**
 * Definición de columnas + filtro de la bandeja de pagos programados.
 * Extraído de `TesoreriaPagosProgramados` para bajar su tamaño/complejidad.
 */
import { Wallet } from "lucide-react";
import { defineColumns } from "@/components/shared/DataTable";
import { moneyColumn } from "@/components/shared/dataTable/columnBuilders";
import { formatDate } from "@/lib/formatters";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { Button } from "@/components/ui/button";
import type { FacturaProgramableRow } from "@/features/tesoreria/services/pagosProgramados";
import type { FacturaProgramable } from "@/features/tesoreria/domain/pagosProgramados";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

export type FiltroBandeja = "todas" | "programadas" | "treinta_dias";

/** Filtra la lista completa de facturas programables según el filtro explícito del usuario. */
export function filtrarProgramables(data: FacturaProgramableRow[], filtro: FiltroBandeja): FacturaProgramable[] {
  let rows = data;
  if (filtro === "programadas") rows = rows.filter((r) => r.fecha_programada_pago);
  if (filtro === "treinta_dias") {
    // P2-6.8: se normaliza a medianoche para que la bandeja y el KPI de
    // Tesorería usen exactamente la misma ventana (día 30 incluido).
    const limite = new Date();
    limite.setHours(0, 0, 0, 0);
    limite.setDate(limite.getDate() + 30);
    rows = rows.filter((r) => {
      const f = r.fecha_programada_pago ?? r.fecha_vencimiento;
      return f && new Date(`${f}T00:00:00`) <= limite;
    });
  }
  return rows as FacturaProgramable[];
}

export function buildPagosProgramadosColumns(abrirDialogoPago: (f: FacturaProgramable) => void) {
  return defineColumns<FacturaProgramable>([
    {
      id: "proveedor",
      header: "Proveedor",
      accessorFn: (r) => r.proveedor_nombre ?? "",
      meta: { width: COL_W.ruta, className: "font-medium truncate" },
    },
    {
      id: "folio",
      header: "Folio",
      accessorFn: (r) => r.folio_proveedor ?? "",
      meta: { width: COL_W.folio, className: "font-mono text-xs" },
    },
    {
      id: "fecha",
      header: "Fecha (Venc/Prog)",
      meta: { width: COL_W.monto, className: "text-xs" },
      cell: ({ row }) => {
        const r = row.original;
        const fecha = r.fecha_programada_pago ?? r.fecha_vencimiento;
        return (
          <div className="flex items-center gap-1.5">
            <span>{fecha ? formatDate(fecha) : "—"}</span>
            {r.fecha_programada_pago && (
              <ToneBadge tone="info" size="sm">Prog.</ToneBadge>
            )}
          </div>
        );
      },
    },
    {
      ...moneyColumn<FacturaProgramable>({
        id: "monto",
        header: "Monto",
        accessor: (r) => r.total,
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: COL_W.folio, align: "right" },
    },
    {
      ...moneyColumn<FacturaProgramable>({
        id: "saldo",
        header: "Saldo",
        accessor: (r) => r.saldo,
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: COL_W.folio, align: "right", className: "font-semibold" },
    },
    {
      id: "acciones",
      header: "",
      meta: { width: COL_W.monto, align: "right" },
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => abrirDialogoPago(row.original)}>
          <Wallet className="h-3.5 w-3.5 mr-1.5" /> Ejecutar pago
        </Button>
      ),
    },
  ]);
}
