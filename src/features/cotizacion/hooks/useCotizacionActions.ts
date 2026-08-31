/**
 * Acciones de fila de la lista de cotizaciones (navegación, eliminar, exportar).
 * Extraído de `useCotizacionesPageController` en v13.56.4 (auditoría — paso 12)
 * para separar orquestación de UI vs queries/derivaciones.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeleteCotizacion, usePrefetchCotizacion } from "@/features/cotizacion/hooks/useCotizaciones";
import { exportToCsv } from "@/generators/exportCsv";
import { todayLocalISO } from "@/lib/date/today";

export interface CotizacionExportRow {
  folio: string;
  cliente_nombre: string | null;
  modo: string;
  origen?: string | null;
  destino?: string | null;
  subtotal: number | string | null;
  moneda: string | null;
  estado: string | null;
  fecha_vigencia?: string | null;
}

export function useCotizacionActions() {
  const navigate = useNavigate();
  
  const prefetchCotizacion = usePrefetchCotizacion();
  const deleteCotizacion = useDeleteCotizacion();

  const [cotizacionAEliminar, setCotizacionAEliminar] = useState<string | null>(null);

  const irANueva = () => navigate("/cotizaciones/nueva");
  const irAEditar = (id: string) => navigate(`/cotizaciones/${id}/editar`);
  const irADetalle = (id: string) => navigate(`/cotizaciones/${id}`);

  const confirmarEliminar = async () => {
    if (!cotizacionAEliminar) return;
    try {
      await deleteCotizacion.mutateAsync(cotizacionAEliminar);
      // Toast de éxito/error lo emite `useDeleteCotizacion` para evitar duplicado.
    } catch {
      // Error ya notificado por la mutación; sólo cerramos el diálogo.
    }
    setCotizacionAEliminar(null);
  };

  /**
   * YG-03: recibe un *loader* (no un array ya en memoria) porque el listado es
   * server-side: el CSV debe incluir todo el resultado filtrado, trayéndolo por
   * lotes en el momento de exportar.
   */
  const exportar = async (cargarFilas: () => Promise<CotizacionExportRow[]>) => {
    const filas = await cargarFilas();

    exportToCsv(
      `cotizaciones_${todayLocalISO()}.csv`,
      [
        { key: "folio", label: "Folio" },
        { key: "cliente", label: "Cliente" },
        { key: "modo", label: "Modo" },
        { key: "ruta", label: "Ruta" },
        { key: "subtotal", label: "Subtotal" },
        { key: "moneda", label: "Moneda" },
        { key: "estado", label: "Estado" },
        { key: "vigencia", label: "Vigencia" },
      ],
      filas.map((c) => ({
        folio: c.folio,
        cliente: c.cliente_nombre ?? "",
        modo: c.modo,
        ruta: `${c.origen || ""} → ${c.destino || ""}`,
        subtotal: c.subtotal,
        moneda: c.moneda,
        estado: c.estado,
        vigencia: c.fecha_vigencia || "",
      })),
    );
  };

  return {
    cotizacionAEliminar,
    setCotizacionAEliminar,
    confirmarEliminar,
    isDeleting: deleteCotizacion.isPending,
    exportar,
    irANueva,
    irAEditar,
    irADetalle,
    prefetchCotizacion,
  };
}
