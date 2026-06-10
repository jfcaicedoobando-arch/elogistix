import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Plus, Upload } from "lucide-react";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProveedorMutations } from "@/hooks/proveedor";
import NuevoProveedorDialog from "@/components/proveedor/NuevoProveedorDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/hooks/shared";
import { usePermissions, useRegistrarActividad, useOrgFilter } from "@/hooks/shared";
import type { Tables } from "@/types/db";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { BulkImportDialog } from "@/components/shared/BulkImportDialog";
import { PROVEEDOR_TEMPLATE_HEADERS, mapProveedorRows } from "@/lib/csv/importSchemas";
import { insertProveedor, ProveedorDuplicadoError } from "@/services/proveedor";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { ProveedorTable } from "./ProveedorTable";
import {
  ProveedoresFiltros,
  type CategoriaTab,
  type OrigenFiltro,
  type TipoFiltro,
  type SubtipoFiltro,
} from "./ProveedoresFiltros";

type Proveedor = Tables<"proveedores">;

const CATEGORIA_TABS: { value: CategoriaTab; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "Logistico", label: "Logísticos" },
  { value: "GastoOperativo", label: "Gastos operativos" },
];

export default function Proveedores() {
  const [search, setSearch] = useState("");
  const [categoriaTab, setCategoriaTab] = useState<CategoriaTab>("todos");
  const [origen, setOrigen] = useState<OrigenFiltro>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");
  const [subtipoFiltro, setSubtipoFiltro] = useState<SubtipoFiltro>("todos");
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();
  const { addProveedor } = useProveedorMutations();
  const { canEdit } = usePermissions();
  const registrarActividad = useRegistrarActividad();
  const { toast } = useToast();
  const { organizationId } = useOrgFilter();
  const queryClient = useQueryClient();

  const handleAdd = async (data: Omit<Proveedor, "id">) => {
    try {
      const proveedorCreado = await addProveedor(data);
      registrarActividad.mutate({
        accion: "crear",
        modulo: "proveedores",
        entidad_id: proveedorCreado.id,
        entidad_nombre: data.nombre,
      });
      notifySuccess(toast, { title: "Proveedor creado correctamente" });
    } catch {
      notifyError(toast, { title: "Error al crear proveedor", method: "HANDLE_ADD", errorCode: ERROR_CODES.VALIDATION_FAILED });
    }
  };

  const limpiarFiltros = () => {
    setOrigen("todos");
    setTipoFiltro("todos");
    setSubtipoFiltro("todos");
  };

  // Cuando se cambia de tab limpiamos filtros incompatibles
  const handleCategoriaChange = (next: CategoriaTab) => {
    setCategoriaTab(next);
    if (next !== "Logistico") setTipoFiltro("todos");
    if (next !== "GastoOperativo") setSubtipoFiltro("todos");
  };

  const tableProps = {
    categoria: categoriaTab,
    tipo: tipoFiltro !== "todos" && categoriaTab !== "GastoOperativo" ? tipoFiltro : null,
    subtipoGasto: subtipoFiltro !== "todos" && categoriaTab !== "Logistico" ? subtipoFiltro : null,
    search,
    origen,
    onSelect: (id: string) => navigate(`/proveedores/${id}`),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Truck className="h-6 w-6 text-accent" />}
        title="Proveedores"
        description="Directorio de proveedores logísticos y de gastos operativos"
        actions={
          canEdit ? (
            <div className="hidden sm:flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Importar CSV
              </Button>
              <Button onClick={() => setNuevoOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo Proveedor
              </Button>
            </div>
          ) : null
        }
      />

      <ProveedoresFiltros
        search={search}
        onSearchChange={setSearch}
        origen={origen}
        onOrigenChange={setOrigen}
        tipoFiltro={tipoFiltro}
        onTipoChange={setTipoFiltro}
        subtipoFiltro={subtipoFiltro}
        onSubtipoChange={setSubtipoFiltro}
        categoriaTab={categoriaTab}
        onLimpiar={limpiarFiltros}
      />

      <Tabs value={categoriaTab} onValueChange={(v) => handleCategoriaChange(v as CategoriaTab)}>
        <TabsList className="h-auto">
          {CATEGORIA_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIA_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {categoriaTab === tab.value && <ProveedorTable {...tableProps} />}
          </TabsContent>
        ))}
      </Tabs>


      <NuevoProveedorDialog open={nuevoOpen} onOpenChange={setNuevoOpen} onSave={handleAdd} />

      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importar proveedores desde CSV"
        description="Carga un CSV con proveedores. Incluye la columna 'categoria' (Logistico o GastoOperativo) y, según el caso, 'tipo' o 'subtipo_gasto'."
        templateHeaders={PROVEEDOR_TEMPLATE_HEADERS}
        templateExampleRow={[
          "Maersk Line",
          "Logistico",
          "Naviera",
          "",
          "MLI010101AAA",
          "Sandra López",
          "55 1111 2222",
          "contacto@maersk.com",
          "USD",
          "Dinamarca",
        ]}
        templateFileName="plantilla-proveedores.csv"
        mapRows={(rows) => mapProveedorRows(rows, organizationId)}
        onCommit={async (payloads) => {
          for (const p of payloads) {
            await insertProveedor(p);
          }
          registrarActividad.mutate({
            accion: "crear",
            modulo: "proveedores",
            entidad_nombre: `Importación CSV (${payloads.length})`,
          });
        }}
        onSuccess={(n) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all });
          notifySuccess(toast, { title: `Importados ${n} proveedores` });
        }}
      />

      {canEdit && (
        <FloatingActionButton
          onClick={() => setNuevoOpen(true)}
          icon={<Plus className="h-6 w-6" />}
          label="Nuevo proveedor"
        />
      )}
    </div>
  );
}
