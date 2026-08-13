import { useEffect, useMemo, useState } from "react";
import { FileX } from "lucide-react";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import EmptyState from "@/components/empty/EmptyState";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import type { PartidaEstadoCuenta } from "@/features/proveedor/domain/estadoCuentaProveedor";
import { partidasOperacionesColumns } from "./proveedorOperacionesColumns";

export type FiltroPartidas = "todas" | "por_facturar" | "facturadas";

interface Props {
  partidas: PartidaEstadoCuenta[];
  filtro?: FiltroPartidas;
}

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

/**
 * Tabla de operaciones del proveedor conciliada contra sus facturas.
 *
 * v13.555.0 — antes sólo mostraba el costo comprometido (`conceptos_costo`),
 * sin decir si el proveedor ya lo había facturado. Ahora muestra folio de
 * factura, monto facturado, saldo por facturar y estado real de conciliación.
 */
export function ProveedorOperacionesTable({ partidas, filtro = "todas" }: Props) {
  type Op = PartidaEstadoCuenta & { __idx?: number };
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Al cambiar de filtro la lista se acorta: volver a la primera página evita
  // que el usuario quede parado en una página que ya no existe.
  useEffect(() => { setPage(0); }, [filtro]);

  const filtradas: Op[] = useMemo(() => {
    const base = partidas.filter((p) => {
      if (filtro === "por_facturar") return Number(p.por_facturar) > 0.01;
      if (filtro === "facturadas") return Number(p.facturado) > 0.01;
      return true;
    });
    return base.map((o, i) => ({ ...o, __idx: i }));
  }, [partidas, filtro]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize));
  const pageIndex = Math.min(page, totalPages - 1);
  const pageItems = useMemo(
    () => filtradas.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filtradas, pageIndex, pageSize],
  );

  const opCols: ColumnDef<Op, unknown>[] = defineColumns<Op>(partidasOperacionesColumns<Op>());

  return (
    <DataTable
      columns={opCols}
      data={pageItems}
      rowKey={(o) => `${o.concepto_costo_id}-${o.__idx}`}
      getRowHref={(o) => (o.embarque_id ? `/embarques/${o.embarque_id}` : null)}
      density={TABLE_DENSITY.embebida}
      pagination={{
        page: pageIndex,
        totalPages,
        onPageChange: setPage,
        pageSize,
        onPageSizeChange: (s: number) => { setPageSize(s); setPage(0); },
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        total: filtradas.length,
      }}
      emptyState={
        <div className="p-6">
          <EmptyState
            icon={FileX}
            title={filtro === "por_facturar" ? "Sin partidas por facturar" : "Sin operaciones registradas"}
            description={
              filtro === "por_facturar"
                ? "Todo lo costeado con este proveedor ya está respaldado con su factura."
                : "Cuando este proveedor aparezca en costos de embarques, las operaciones se mostrarán aquí."
            }
          />
        </div>
      }
    />
  );
}
