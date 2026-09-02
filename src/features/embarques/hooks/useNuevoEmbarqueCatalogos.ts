/**
 * Catálogos del wizard "Nuevo embarque" (clientes, proveedores, cotizaciones).
 *
 * P1-1: los catálogos alimentan los selects del paso 1 y 4. Si fallan, el
 * wizard debe decirlo y ofrecer reintento en lugar de mostrar listas vacías.
 *
 * v13.410.1 — extraído de `useNuevoEmbarqueWizard` para respetar el límite de
 * 200 líneas por archivo productivo (Power of 10).
 */
import { useProveedoresForSelect } from "@/features/embarques/hooks/useEmbarques";
import { useClientesForSelect } from "@/features/cliente/hooks/useClientes";
import { useCotizacionesAceptadas } from "@/features/cotizacion/hooks";

export function useNuevoEmbarqueCatalogos() {
  const qClientes = useClientesForSelect();
  const qProveedores = useProveedoresForSelect();
  const qCotizaciones = useCotizacionesAceptadas();

  // v13.823.32: en el ALTA sólo se ofrecen cotizaciones `Aceptada` y sin
  // embarque vinculado. Antes también aparecían las `En operación` (ya
  // convertidas), y elegirlas generaba un segundo embarque para la misma
  // cotización. La pantalla de EDICIÓN usa la lista completa.
  const disponiblesParaAlta = (qCotizaciones.data ?? []).filter(
    (cot) => cot.estado === "Aceptada" && !cot.embarque_id,
  );

  return {
    clientes: qClientes.data ?? [],
    proveedoresDb: qProveedores.data ?? [],
    cotizacionesAceptadas: disponiblesParaAlta,

    catalogosCargando:
      qClientes.isLoading || qProveedores.isLoading || qCotizaciones.isLoading,
    catalogosError:
      qClientes.isError || qProveedores.isError || qCotizaciones.isError,
    recargarCatalogos: () => {
      void qClientes.refetch();
      void qProveedores.refetch();
      void qCotizaciones.refetch();
    },
  };
}
