import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/selects/SearchInput";
import { useClientesPaginados } from "@/hooks/cliente/useClientes";
import { usePermissions } from "@/hooks/shared/usePermissions";
import NuevoClienteDialog from "@/components/cliente/NuevoClienteDialog";
import PaginationControls from "@/components/shared/PaginationControls";
import { PageHeader } from "@/components/shared/PageHeader";
import { useDebounce } from "@/hooks/shared/useDebounce";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { useListPageState } from "@/hooks/shared/useListPageState";
import { toTitleCase, formatPhoneMx, correctSpanishPlace } from "@/lib/formatters";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";

type ClienteRow = { id: string; nombre: string; rfc: string; ciudad: string; estado: string; contacto: string; telefono: string };

const columns: DataTableColumn<ClienteRow>[] = [
  { key: "nombre", header: "Nombre", width: "min-w-[180px]", className: "font-medium max-w-[200px] truncate", sortable: true, sortValue: (c) => c.nombre, render: (c) => {
    const nombre = toTitleCase(c.nombre);
    return <span title={nombre}>{nombre}</span>;
  } },
  { key: "rfc", header: "RFC", width: "w-[130px]", className: "text-xs font-mono", sortable: true, sortValue: (c) => c.rfc, render: (c) => (c.rfc || "").toUpperCase() },
  { key: "ciudad", header: "Ciudad", width: "w-[150px]", className: "text-xs", sortable: true, sortValue: (c) => c.ciudad, render: (c) => `${correctSpanishPlace(c.ciudad)}, ${correctSpanishPlace(c.estado)}` },
  { key: "contacto", header: "Contacto", width: "w-[140px]", className: "text-xs", render: (c) => toTitleCase(c.contacto) },
  { key: "telefono", header: "Teléfono", width: "w-[130px]", className: "text-xs whitespace-nowrap", render: (c) => formatPhoneMx(c.telefono) },
];

export default function Clientes() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();

  const { search, setSearch, page, setPage, pageSize, setPageSize } = useListPageState({});
  const [dialogOpen, setDialogOpen] = useState(false);

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
      <PageHeader
        icon={<Users className="h-6 w-6 text-accent" />}
        title="Clientes"
        description={`${totalCount} clientes registrados`}
        actions={
          canEdit ? (
            <Button onClick={() => setDialogOpen(true)} className="hidden md:inline-flex">
              <Plus className="h-4 w-4 mr-1" />Nuevo Cliente
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o RFC..." />
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

      {canEdit && (
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          label="Nuevo cliente"
          onClick={() => setDialogOpen(true)}
        />
      )}
    </div>
  );
}
