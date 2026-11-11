const noop = () => undefined;
export const announce = (message: string) => window.dispatchEvent(new CustomEvent("fixture-action", { detail: message }));

export const usePermissions = () => ({ canEmitirFactura: true });
export const useDocumentTitle = noop;
export const useFacturacionDateRange = () => ({ setRango: noop, limpiar: noop, desdeIso: null, hastaIso: null });
export const useFacturacionPageController = () => ({
  search: "", setSearch: noop, filterEstado: "todos", filterCliente: "todos", setFilter: noop,
  page: 0, setPage: noop, pageSize: 25, setPageSize: noop,
  paginatedFacturas: [], facturasFiltradas: [], totalPages: 1, totalCount: 1,
  loadingFacturas: false, errorFacturas: false, refetchFacturas: noop,
  clientesDisponibles: [], loadingClientes: false, errorClientes: false, refetchClientes: noop,
  rangoInvalido: false, exportando: false, exportDisabled: false,
  exportarFacturasCsv: noop, exportarLayoutContable: noop,
});
export const buildFacturaColumns = () => [];

export function useFacturasMasivas(selectedIds: ReadonlySet<string>, onMarked: (ids: readonly string[]) => void) {
  return {
    busy: null, progreso: null,
    descargarZip: () => announce("Descarga ZIP simulada; no se generó ningún archivo."),
    reenviarEmail: () => announce("Reenvío simulado; no se envió ningún correo."),
    marcarEnviada: () => { announce("Marca simulada, sólo en esta pantalla."); onMarked([...selectedIds]); },
  };
}
