import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Plus, Upload } from "lucide-react";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { Button } from "@/components/ui/button";
import NuevoProveedorDialog from "@/features/proveedor/components/NuevoProveedorDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { usePermissions } from "@/hooks/shared";
import { ProveedorTable } from "../components/ProveedorTable";
import {
  ProveedoresFiltros,
  type OrigenFiltro,
  type TipoFiltro,
} from "../components/ProveedoresFiltros";
import { useProveedoresCrear } from "@/features/proveedor/hooks/useProveedoresCrear";
import { ProveedoresImportDialog } from "../components/ProveedoresImportDialog";

import { PageContainer } from "@/components/shared/PageContainer";
import { useDocumentTitle } from "@/hooks/shared";

export default function Proveedores() {
  useDocumentTitle("Proveedores");
  const [search, setSearch] = useState("");
  const [origen, setOrigen] = useState<OrigenFiltro>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const handleAdd = useProveedoresCrear();

  const limpiarFiltros = () => {
    setOrigen("todos");
    setTipoFiltro("todos");
  };

  return (
    // pb-24 md:pb-0: evita que el FAB tape la última fila en mobile.
    <PageContainer className="pb-24 md:pb-6">

      <PageHeader
        icon={<Truck className="h-6 w-6 text-accent" />}
        title="Proveedores"
        description="Directorio único de proveedores. La categoría contable de cada gasto se asigna por factura."
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
        onLimpiar={limpiarFiltros}
      />

      <ProveedorTable
        tipo={tipoFiltro !== "todos" ? tipoFiltro : null}
        search={search}
        origen={origen}
        onSelect={(id) => navigate(`/proveedores/${id}`)}
        canCreate={canEdit}
        onCreateNew={() => setNuevoOpen(true)}
      />

      <NuevoProveedorDialog open={nuevoOpen} onOpenChange={setNuevoOpen} onSave={handleAdd} />

      <ProveedoresImportDialog open={importOpen} onOpenChange={setImportOpen} />

      {canEdit && (
        <FloatingActionButton
          onClick={() => setNuevoOpen(true)}
          icon={<Plus className="h-6 w-6" />}
          label="Nuevo proveedor"
        />
      )}
    </PageContainer>
  );
}
