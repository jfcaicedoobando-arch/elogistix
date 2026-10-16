import { CxpFiltros } from "@/features/cxp/components/CxpFiltros";
import { useCxpPageState } from "@/features/cxp/hooks/useCxpPageState";

export function CxpFixture() {
  const c = useCxpPageState();
  const values = { search: c.search, estatus: c.estatus, moneda: c.moneda, origen: c.origen,
    aprobacion: c.aprobacion, proveedorId: c.proveedorId, categoriaPresupuestoId: c.categoriaPresupuestoId,
    fechaDesde: c.fechaDesde, fechaHasta: c.fechaHasta, page: c.page };
  return <main className="p-4 space-y-4">
    <h1>Filtros CxP aislados</h1>
    <CxpFiltros {...values} onSearchChange={c.setSearch} onEstatusChange={c.setEstatus}
      onMonedaChange={c.setMoneda} onOrigenChange={c.setOrigen} onAprobacionChange={c.setAprobacion}
      onProveedorChange={c.setProveedorId} onCategoriaPresupuestoChange={c.setCategoriaPresupuestoId}
      onFechaDesdeChange={c.setFechaDesde} onFechaHastaChange={c.setFechaHasta} />
    <output data-testid="applied">{JSON.stringify(values)}</output>
  </main>;
}
