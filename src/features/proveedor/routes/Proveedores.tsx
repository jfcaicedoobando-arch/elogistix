import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  // M8 (Ola 8): filtros del directorio en la URL (link compartible).
  const [search, setSearch] = useTextoUrl("q");
  const [origen, setOrigen] = useFiltroUrl<OrigenFiltro>("origen", ORIGENES_FILTRO, "todos");
  const [tipoFiltro, setTipoFiltro] = useTextoUrl("tipo", "todos") as readonly [TipoFiltro, (v: TipoFiltro) => void];
  const [nuevoOpen, setNuevoOpen] = useState(false);
  // Atajo desde la captura de facturas de proveedor: ?nuevo=1&rfc=&nombre=
  const [searchParams, setSearchParams] = useSearchParams();
  const prefillRfc = searchParams.get("rfc") ?? "";
  const prefillNombre = searchParams.get("nombre") ?? "";
  const pedirNuevo = searchParams.get("nuevo") === "1";
  useEffect(() => {
    if (pedirNuevo) setNuevoOpen(true);
  }, [pedirNuevo]);
  const cerrarNuevo = (abierto: boolean) => {
    setNuevoOpen(abierto);
    if (!abierto && pedirNuevo) {
      const next = new URLSearchParams(searchParams);
      next.delete("nuevo"); next.delete("rfc"); next.delete("nombre");
      setSearchParams(next, { replace: true });
    }
  };
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

      <NuevoProveedorDialog
        key={`${prefillRfc}|${prefillNombre}`}
        open={nuevoOpen}
        onOpenChange={cerrarNuevo}
        onSave={handleAdd}
        prefill={pedirNuevo ? { rfc: prefillRfc, nombre: prefillNombre } : undefined}
      />

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
