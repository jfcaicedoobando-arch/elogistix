import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { useProveedoresPaginados } from "@/hooks/proveedor";
import { useDebounce, useListPageState } from "@/hooks/shared";
import type { Enums } from "@/types/db";
import { proveedorColumns } from "./proveedorTableColumns";

type TipoProveedor = Enums<'tipo_proveedor'>;


interface Props {
  tipo: TipoProveedor;
  search: string;
  origen?: "Nacional" | "Extranjero" | "todos";
  onSelect: (id: string) => void;
}

export function ProveedorTable({ tipo, search, origen, onSelect }: Props) {
  const { page, setPage, pageSize, setPageSize, resetPage } = useListPageState({});
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    resetPage();
  }, [debouncedSearch, origen, resetPage]);

  const { data: resultado, isLoading } = useProveedoresPaginados({
    tipo,
    search: debouncedSearch,
    page,
    pageSize,
    origen,
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
            pageSizeOptions: [100, 999999],
            pageSizeLabels: { 999999: "Todos" },
          }}
        />
      </CardContent>
    </Card>
  );
}
