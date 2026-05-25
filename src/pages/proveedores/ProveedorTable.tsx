import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { useProveedoresPaginados, type ProveedorListItem } from "@/hooks/proveedor";
import { useDebounce, useListPageState } from "@/hooks/shared";
import { toTitleCase } from "@/lib/formatters";
import type { Enums } from "@/types/db";

type TipoProveedor = Enums<'tipo_proveedor'>;

export const proveedorColumns: ColumnDef<ProveedorListItem, unknown>[] = defineColumns<ProveedorListItem>([
  { id: "nombre", header: "Nombre", accessorFn: (p) => p.nombre, enableSorting: true, sortingFn: sortByString<ProveedorListItem>((p) => p.nombre), meta: { width: "min-w-[180px]", className: "font-medium" }, cell: ({ row }) => <span title={row.original.nombre}>{toTitleCase(row.original.nombre)}</span> },
  { id: "rfc", header: "RFC", accessorFn: (p) => p.rfc, enableSorting: true, sortingFn: sortByString<ProveedorListItem>((p) => p.rfc), meta: { width: "w-[130px]", className: "text-xs font-mono" }, cell: ({ row }) => row.original.rfc },
  { id: "contacto", header: "Contacto", meta: { width: "w-[140px]", className: "text-xs" }, cell: ({ row }) => row.original.contacto ? <span title={row.original.contacto}>{toTitleCase(row.original.contacto)}</span> : null },
  { id: "moneda", header: "Moneda", meta: { width: "w-[80px]", className: "text-xs" }, cell: ({ row }) => row.original.moneda_preferida },
]);

interface Props {
  tipo: TipoProveedor;
  search: string;
  onSelect: (id: string) => void;
}

export function ProveedorTable({ tipo, search, onSelect }: Props) {
  const { page, setPage, pageSize, setPageSize, resetPage } = useListPageState({});
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    resetPage();
  }, [debouncedSearch, resetPage]);

  const { data: resultado, isLoading } = useProveedoresPaginados({
    tipo,
    search: debouncedSearch,
    page,
    pageSize,
  });

  const proveedores = resultado?.data ?? [];
  const totalCount = resultado?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Card>
      <CardContent className="p-0">
        <DataTable
          columns={proveedorColumns}
          data={proveedores}
          isLoading={isLoading && proveedores.length === 0}
          emptyMessage="Sin proveedores registrados"
          onRowClick={(p) => onSelect(p.id)}
          rowKey={(p) => p.id}
          density="comfortable"
          pagination={{
            page,
            totalPages,
            onPageChange: setPage,
            pageSize,
            onPageSizeChange: (s) => { setPageSize(s); setPage(0); },
          }}
        />
      </CardContent>
    </Card>
  );
}
