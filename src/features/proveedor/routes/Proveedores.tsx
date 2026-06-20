import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Plus, Upload } from "lucide-react";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NuevoProveedorDialog from "@/features/proveedor/components/NuevoProveedorDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { usePermissions } from "@/hooks/shared";
import { ProveedorTable } from "../components/ProveedorTable";
import {
  ProveedoresFiltros,
  type CategoriaTab,
  type OrigenFiltro,
  type TipoFiltro,
  type SubtipoFiltro,
} from "../components/ProveedoresFiltros";
import { useProveedoresCrear } from "@/features/proveedor/hooks/useProveedoresCrear";
import { ProveedoresImportDialog } from "../components/ProveedoresImportDialog";

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
  const { canEdit } = usePermissions();
  const handleAdd = useProveedoresCrear();

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
    // pb-24 md:pb-0: evita que el FAB tape la última fila en mobile.
    <div className="space-y-6 pb-24 md:pb-0">

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

      <ProveedoresImportDialog open={importOpen} onOpenChange={setImportOpen} />

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
