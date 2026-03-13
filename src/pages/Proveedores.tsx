import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/SearchInput";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProveedoresPaginados, useProveedorMutations } from "@/hooks/useProveedores";
import type { ProveedorListItem } from "@/hooks/useProveedores";
import NuevoProveedorDialog from "@/components/NuevoProveedorDialog";
import PaginationControls from "@/components/PaginationControls";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useDebounce } from "@/hooks/useDebounce";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import type { Tables, Enums } from "@/integrations/supabase/types";
type TipoProveedor = Enums<'tipo_proveedor'>;
type Proveedor = Tables<'proveedores'>;

const DEFAULT_PAGE_SIZE = 20;

const TABS: { label: string; tipo: TipoProveedor }[] = [
  { label: 'Navieras', tipo: 'Naviera' },
  { label: 'Aerolíneas', tipo: 'Aerolínea' },
  { label: 'Transportistas', tipo: 'Transportista' },
  { label: 'Agentes Aduanales', tipo: 'Agente Aduanal' },
  { label: 'Agentes de Carga', tipo: 'Agente de Carga' },
  { label: 'Aseguradoras', tipo: 'Aseguradora' },
  { label: 'Custodia', tipo: 'Custodia' },
  { label: 'Almacenes', tipo: 'Almacenes' },
  { label: 'Acondicionamiento', tipo: 'Acondicionamiento de Carga' },
  { label: 'Mat. Peligrosos', tipo: 'Materiales Peligrosos' },
];

const proveedorColumns: DataTableColumn<ProveedorListItem>[] = [
  { key: "nombre", header: "Nombre", className: "font-medium", render: (p) => p.nombre },
  { key: "rfc", header: "RFC", className: "text-xs font-mono", render: (p) => p.rfc },
  { key: "contacto", header: "Contacto", className: "text-xs", render: (p) => p.contacto },
  { key: "moneda", header: "Moneda", className: "text-xs", render: (p) => p.moneda_preferida },
];

function ProveedorTable({ tipo, search, onSelect }: { tipo: TipoProveedor; search: string; onSelect: (id: string) => void }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const debouncedSearch = useDebounce(search, 300);

  const { data: resultado, isLoading } = useProveedoresPaginados({
    tipo,
    search: debouncedSearch,
    page,
    pageSize,
  });

  const proveedores = resultado?.data ?? [];
  const totalCount = resultado?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Reset page when search changes
  const prevSearchRef = useState(debouncedSearch);
  if (prevSearchRef[0] !== debouncedSearch) {
    prevSearchRef[1](debouncedSearch);
    if (page !== 0) setPage(0);
  }

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
  );
}

export default function Proveedores() {
  const [search, setSearch] = useState("");
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const navigate = useNavigate();
  const { addProveedor } = useProveedorMutations();
  const { canEdit } = usePermissions();
  const registrarActividad = useRegistrarActividad();
  const { toast } = useToast();

  const handleAdd = async (data: Omit<Proveedor, 'id'>) => {
    try {
      const proveedorCreado = await addProveedor(data);
      registrarActividad.mutate({
        accion: 'crear',
        modulo: 'proveedores',
        entidad_id: (proveedorCreado as { id?: string })?.id,
        entidad_nombre: data.nombre,
      });
      toast({ title: "Proveedor creado correctamente" });
    } catch {
      toast({ title: "Error al crear proveedor", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Truck className="h-6 w-6 text-accent" />
            <h1 className="text-2xl font-bold">Proveedores</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Gestión de proveedores por categoría</p>
        </div>
        {canEdit && (
          <Button onClick={() => setNuevoOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Proveedor
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar proveedor..." />
        </CardContent>
      </Card>

      <Tabs defaultValue="Naviera">
        <TabsList className="w-full grid grid-cols-5 lg:grid-cols-10 h-auto gap-1">
          {TABS.map(tabConfig => (
            <TabsTrigger key={tabConfig.tipo} value={tabConfig.tipo} className="text-xs">{tabConfig.label}</TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(tabConfig => (
          <TabsContent key={tabConfig.tipo} value={tabConfig.tipo}>
            <ProveedorTable tipo={tabConfig.tipo} search={search} onSelect={(id) => navigate(`/proveedores/${id}`)} />
          </TabsContent>
        ))}
      </Tabs>

      <NuevoProveedorDialog open={nuevoOpen} onOpenChange={setNuevoOpen} onSave={handleAdd} />
    </div>
  );
}
