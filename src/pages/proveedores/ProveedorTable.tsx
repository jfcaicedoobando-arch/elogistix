import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { useProveedoresPaginados } from "@/features/proveedor/hooks";
import { useDebounce, useListPageState } from "@/hooks/shared";
import type { Enums } from "@/types/db";
import { proveedorColumns } from "./proveedorTableColumns";

type TipoProveedor = Enums<"tipo_proveedor">;
type CategoriaProveedor = Enums<"categoria_proveedor">;
type SubtipoGasto = Enums<"subtipo_gasto_operativo">;

interface Props {
  categoria?: CategoriaProveedor | "todos";
  tipo?: TipoProveedor | null;
  subtipoGasto?: SubtipoGasto | null;
  search: string;
  origen?: "Nacional" | "Extranjero" | "todos";
  onSelect: (id: string) => void;
  onTotalChange?: (total: number) => void;
}

export function ProveedorTable({ categoria, tipo, subtipoGasto, search, origen, onSelect, onTotalChange }: Props) {
  const { page, setPage, pageSize, setPageSize, resetPage } = useListPageState({});
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    resetPage();
  }, [debouncedSearch, origen, categoria, tipo, subtipoGasto, resetPage]);

  const { data: resultado, isLoading } = useProveedoresPaginados({
    categoria,
    tipo,
    subtipoGasto,
    search: debouncedSearch,
    page,
    pageSize,
    origen,
  });

  const proveedores = resultado?.data ?? [];
  const totalCount = resultado?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    onTotalChange?.(totalCount);
  }, [totalCount, onTotalChange]);

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
