import { useTabProformasPendientesController } from "@/features/facturacion/hooks";
import { TabProformasPendientesToolbar } from "./TabProformasPendientesToolbar";
import { TabProformasPendientesGrupos } from "./TabProformasPendientesGrupos";

export function TabProformasPendientes({ isInRange }: { isInRange?: (fecha: string | null | undefined) => boolean }) {
  const c = useTabProformasPendientesController({ isInRange });
  return (
    <div className="space-y-4">
      <TabProformasPendientesToolbar
        search={c.search}
        setSearch={c.setSearch}
        filtroCliente={c.filtroCliente}
        setFiltroCliente={c.setFiltroCliente}
        clientesDisponibles={c.clientesDisponibles}
        filtroAntiguedad={c.filtroAntiguedad}
        setFiltroAntiguedad={c.setFiltroAntiguedad}
        totalSeleccionadas={c.totalSeleccionadas}
        totalesSeleccion={c.totalesSeleccion}
        puedeConsolidar={c.puedeConsolidar}
        isConsolidarPending={c.isConsolidarPending}
        handleConsolidar={c.handleConsolidar}
        puedeAprobar={c.puedeAprobar}
        isAprobarPending={c.isAprobarPending}
        handleAprobar={c.handleAprobar}
        embarquesEnSeleccion={c.embarquesEnSeleccion}
      />
      <TabProformasPendientesGrupos
        isLoading={c.isLoading}
        grupos={c.grupos}
        collapsed={c.collapsed}
        selectedIds={c.selectedIds}
        toggleCollapse={c.toggleCollapse}
        toggleSelect={c.toggleSelect}
      />
    </div>
  );
}
