/**
 * Definición de columnas + filtro de la bandeja de pagos programados.
 * Extraído de `TesoreriaPagosProgramados` para bajar su tamaño/complejidad.
 */
import { CalendarClock, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
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
    // MNY-09: la ventana es "hoy y los próximos 30 días"; sin límite inferior
    // también entraban facturas ya vencidas, que no son "vencen en 30 días".
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + 30);
    rows = rows.filter((r) => {
      const f = r.fecha_programada_pago ?? r.fecha_vencimiento;
      if (!f) return false;
      const fecha = new Date(`${f}T00:00:00`);
      return fecha >= hoy && fecha <= limite;
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
      // VT-30: nowrap — el folio "AAV-2026-1188" se rompía en dos líneas.
      meta: { width: COL_W.folio, className: "font-mono text-body-sm whitespace-nowrap" },
    },
    {
      id: "fecha",
      header: "Fecha (Venc/Prog)",
      meta: { width: COL_W.monto, className: "text-body-sm" },
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
      // MNY-04: `ejecutar_pago_programado` exige fecha programada
      // (LC_PAGO_SIN_PROGRAMACION). Sin ella el botón fallaba siempre; ahora la
      // acción es programar la fecha en la factura de Compras.
      cell: ({ row }) =>
        row.original.fecha_programada_pago ? (
          <Button size="sm" variant="outline" onClick={() => abrirDialogoPago(row.original)}>
            <Wallet className="size-3.5 mr-1.5" /> Ejecutar pago
          </Button>
        ) : (
          <Button size="sm" variant="ghost" asChild>
            <Link to={`/compras/facturas/${row.original.id}`}>
              <CalendarClock className="size-3.5 mr-1.5" /> Programar pago
            </Link>
          </Button>
        ),
    },
  ]);
}
