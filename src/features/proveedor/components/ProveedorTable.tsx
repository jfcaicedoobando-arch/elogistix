import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { useProveedoresPaginados } from "@/features/proveedor/hooks";
import { useDebounce, useListPageState } from "@/hooks/shared";
import { toTitleCase } from "@/lib/formatters";
import type { Enums } from "@/types/db";
import { proveedorColumns } from "./proveedorTableColumns";

type TipoProveedor = Enums<"tipo_proveedor">;

interface Props {
  tipo?: TipoProveedor | null;
  search: string;
  origen?: "Nacional" | "Extranjero" | "todos";
  onSelect: (id: string) => void;
  onTotalChange?: (total: number) => void;
}

export function ProveedorTable({ tipo, search, origen, onSelect, onTotalChange }: Props) {
  const { page, setPage, pageSize, setPageSize, resetPage } = useListPageState({});
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    resetPage();
  }, [debouncedSearch, origen, tipo, resetPage]);

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

  useEffect(() => {
    onTotalChange?.(totalCount);
  }, [totalCount, onTotalChange]);

  return (
    <Card>
      <CardContent className="p-0">
        <ResponsiveDataTable
          columns={proveedorColumns}
          data={proveedores}
          isLoading={isLoading && proveedores.length === 0}
          emptyMessage="Sin proveedores registrados"
          onRowClick={(p) => onSelect(p.id)}
          rowKey={(p) => p.id}
          density="comfortable"
          className="pb-24 sm:pb-0"
          mobileCard={(p) => (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{toTitleCase(p.nombre)}</div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{p.rfc || "—"}</div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">{p.contacto ? toTitleCase(p.contacto) : ""}</div>
              </div>
              {p.origen_proveedor && (
                <Badge variant="outline" className="text-[10px] whitespace-nowrap">{p.origen_proveedor}</Badge>
              )}
            </div>
          )}
          pagination={{
            page,
            totalPages,
            onPageChange: setPage,
            pageSize,
            onPageSizeChange: (s: number) => { setPageSize(s); setPage(0); },
            pageSizeOptions: [50, 100, 200, 500],
            pageSizeLabels: { 500: "500" },
          }}
        />
      </CardContent>
    </Card>
  );
}
