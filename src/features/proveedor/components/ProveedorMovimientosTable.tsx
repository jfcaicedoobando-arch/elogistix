import { useEffect, useMemo, useState } from "react";
import { FileX } from "lucide-react";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import EmptyState from "@/components/empty/EmptyState";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import type { MovimientoConSaldo } from "@/features/proveedor/domain/movimientosProveedor";
import { movimientosProveedorColumns } from "./proveedorMovimientosColumns";

interface Props {
  movimientos: MovimientoConSaldo[];
}

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

/**
 * Ola 2 — Estado de cuenta cronológico: cargos (facturas del proveedor),
 * abonos (pagos y notas de crédito) y saldo corrido por moneda.
 */
export function ProveedorMovimientosTable({ movimientos }: Props) {
  type Mov = MovimientoConSaldo & { __idx?: number };
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // El rango de fechas o los filtros cambian el total de movimientos: regresar
  // a la primera página para no mostrar una página vacía o desfasada.
  useEffect(() => { setPage(0); }, [movimientos]);

  const filas: Mov[] = useMemo(
    () => movimientos.map((m, i) => ({ ...m, __idx: i })),
    [movimientos],
  );

  const totalPages = Math.max(1, Math.ceil(filas.length / pageSize));
  const pageIndex = Math.min(page, totalPages - 1);
  const pageItems = useMemo(
    () => filas.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filas, pageIndex, pageSize],
  );

  const cols: ColumnDef<Mov, unknown>[] = defineColumns<Mov>(movimientosProveedorColumns<Mov>());

  return (
    <DataTable
      columns={cols}
      data={pageItems}
      rowKey={(m) => `${m.tipo}-${m.ref_id}-${m.__idx}`}
      getRowHref={(m) =>
        m.tipo === "Factura"
          ? `/compras/facturas/${m.ref_id}`
          : m.embarque_id
            ? `/embarques/${m.embarque_id}`
            : null
      }
      density={TABLE_DENSITY.embebida}
      pagination={{
        page: pageIndex,
        totalPages,
        onPageChange: setPage,
        pageSize,
        onPageSizeChange: (s: number) => { setPageSize(s); setPage(0); },
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        total: filas.length,
      }}
      emptyState={
        <div className="p-6">
          <EmptyState
            icon={FileX}
            title="Sin movimientos en el periodo"
            description="Ajusta el rango de fechas o captura la primera factura de este proveedor."
          />
        </div>
      }
    />
  );
}
