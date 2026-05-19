import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/selects/SearchInput";
import { useClientesPaginados } from "@/hooks/cliente";
import { usePermissions } from "@/hooks/shared";
import NuevoClienteDialog from "@/components/cliente/NuevoClienteDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useDebounce } from "@/hooks/shared";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { useListPageState } from "@/hooks/shared";
import { toTitleCase, formatPhoneMx, correctSpanishPlace } from "@/lib/formatters";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { BulkImportDialog } from "@/components/shared/BulkImportDialog";
import {
  CLIENTE_TEMPLATE_HEADERS,
  mapClienteRows,
} from "@/lib/csv/importSchemas";
import { useOrgFilter } from "@/hooks/shared";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { createCliente } from "@/services/cliente";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { useRegistrarActividad } from "@/hooks/shared";

type ClienteRow = { id: string; nombre: string; rfc: string; ciudad: string; estado: string; contacto: string; telefono: string };

const columns: ColumnDef<ClienteRow, unknown>[] = defineColumns<ClienteRow>([
  {
    id: "nombre",
    header: "Nombre",
    accessorFn: (c) => c.nombre,
    enableSorting: true,
    sortingFn: sortByString<ClienteRow>((c) => c.nombre),
    meta: { width: "min-w-[180px]", className: "font-medium max-w-[200px] truncate" },
    cell: ({ row }) => {
      const nombre = toTitleCase(row.original.nombre);
      return <span title={nombre}>{nombre}</span>;
    },
  },
  {
    id: "rfc",
    header: "RFC",
    accessorFn: (c) => c.rfc,
    enableSorting: true,
    sortingFn: sortByString<ClienteRow>((c) => c.rfc),
    meta: { width: "w-[130px]", className: "text-xs font-mono" },
    cell: ({ row }) => (row.original.rfc || "").toUpperCase(),
  },
  {
    id: "ciudad",
    header: "Ciudad",
    accessorFn: (c) => c.ciudad,
    enableSorting: true,
    sortingFn: sortByString<ClienteRow>((c) => c.ciudad),
    meta: { width: "w-[150px]", className: "text-xs" },
    cell: ({ row }) => `${correctSpanishPlace(row.original.ciudad)}, ${correctSpanishPlace(row.original.estado)}`,
  },
  { id: "contacto", header: "Contacto", meta: { width: "w-[140px]", className: "text-xs" }, cell: ({ row }) => toTitleCase(row.original.contacto) },
  { id: "telefono", header: "Teléfono", meta: { width: "w-[130px]", className: "text-xs whitespace-nowrap" }, cell: ({ row }) => formatPhoneMx(row.original.telefono) },
]);

export default function Clientes() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { organizationId } = useOrgFilter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const registrarActividad = useRegistrarActividad();

  const { search, setSearch, page, setPage, pageSize, setPageSize } = useListPageState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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
            <div className="hidden md:flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-1" />Importar CSV
              </Button>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Nuevo Cliente
              </Button>
            </div>
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

      <NuevoClienteDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importar clientes desde CSV"
        description="Carga un archivo CSV con clientes. Sólo se insertarán las filas válidas."
        templateHeaders={CLIENTE_TEMPLATE_HEADERS}
        templateExampleRow={[
          "Acme S.A. de C.V.",
          "ACM010101AAA",
          "contacto@acme.mx",
          "55 1234 5678",
          "Juan Pérez",
          "Av. Reforma 123",
          "Ciudad de México",
          "CDMX",
          "06600",
          "30",
        ]}
        templateFileName="plantilla-clientes.csv"
        mapRows={(rows) => mapClienteRows(rows, organizationId)}
        onCommit={async (payloads) => {
          for (const p of payloads) {
            // Inserción secuencial para no exceder rate-limit y conservar
            // mensajes de error por fila si alguna RFC duplica.
            await createCliente(p);
          }
          registrarActividad.mutate({
            accion: "crear",
            modulo: "clientes",
            entidad_nombre: `Importación CSV (${payloads.length})`,
          });
        }}
        onSuccess={(n) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
          notifySuccess(toast, { title: `Importados ${n} clientes` });
        }}
      />

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
