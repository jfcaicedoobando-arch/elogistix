import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/SearchInput";
import { useClientesPaginados } from "@/hooks/useClientes";
import { usePermissions } from "@/hooks/usePermissions";
import NuevoClienteDialog from "@/components/cliente/NuevoClienteDialog";
import PaginationControls from "@/components/PaginationControls";
import { useDebounce } from "@/hooks/useDebounce";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

const DEFAULT_PAGE_SIZE = 20;

type ClienteRow = { id: string; nombre: string; rfc: string; ciudad: string; estado: string; contacto: string; telefono: string };

const columns: DataTableColumn<ClienteRow>[] = [
  { key: "nombre", header: "Nombre", width: "min-w-[180px]", className: "font-medium max-w-[200px] truncate", sortable: true, sortValue: (c) => c.nombre, render: (c) => c.nombre },
  { key: "rfc", header: "RFC", width: "w-[130px]", className: "text-xs font-mono", sortable: true, sortValue: (c) => c.rfc, render: (c) => c.rfc },
  { key: "ciudad", header: "Ciudad", width: "w-[150px]", className: "text-xs", sortable: true, sortValue: (c) => c.ciudad, render: (c) => `${c.ciudad}, ${c.estado}` },
  { key: "contacto", header: "Contacto", width: "w-[140px]", className: "text-xs", render: (c) => c.contacto },
  { key: "telefono", header: "Teléfono", width: "w-[120px]", className: "text-xs", render: (c) => c.telefono },
];

export default function Clientes() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const debouncedSearch = useDebounce(search, 300);

  const { data: resultado, isLoading } = useClientesPaginados({
    search: debouncedSearch,
    page,
    pageSize,
  });

  const clientes = resultado?.data ?? [];
  const totalCount = resultado?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-accent" />
            <h1 className="text-2xl font-bold">Clientes</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{totalCount} clientes registrados</p>
        </div>
        {canEdit && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo Cliente</Button>}
      </div>

      <Card>
        <CardContent className="p-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Buscar por nombre o RFC..." />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={clientes as ClienteRow[]}
            isLoading={isLoading}
            emptyMessage={search ? "No se encontraron clientes" : "No hay clientes registrados"}
            onRowClick={(c) => navigate(`/clientes/${c.id}`)}
            rowKey={(c) => c.id}
          />
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          />
        </CardContent>
      </Card>

      <NuevoClienteDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
