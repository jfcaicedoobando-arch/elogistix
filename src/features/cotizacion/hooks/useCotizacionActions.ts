/**
 * Acciones de fila de la lista de cotizaciones (navegación, eliminar, exportar).
 * Extraído de `useCotizacionesPageController` en v13.56.4 (auditoría — paso 12)
 * para separar orquestación de UI vs queries/derivaciones.
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeleteCotizacion, usePrefetchCotizacion } from "@/features/cotizacion/hooks/useCotizaciones";
import { exportToCsv } from "@/generators/exportCsv";
import { todayLocalISO } from "@/lib/date/today";
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";


export interface CotizacionExportRow {
  folio: string;
  cliente_nombre: string | null;
  /** v13.823.355 — en prospectos el nombre visible es la empresa del prospecto. */
  es_prospecto?: boolean | null;
  prospecto_empresa?: string | null;
  modo: string;
  origen?: string | null;
  destino?: string | null;
  subtotal: number | string | null;
  moneda: string | null;
  estado: string | null;
  fecha_vigencia?: string | null;
}

/** Nombre visible de la cotización: empresa del prospecto o cliente. */
export function nombreMostradoCotizacion(
  c: Pick<CotizacionExportRow, "cliente_nombre" | "es_prospecto" | "prospecto_empresa">,
): string {
  if (c.es_prospecto) return c.prospecto_empresa || c.cliente_nombre || "";
  return c.cliente_nombre || c.prospecto_empresa || "";
}

export function useCotizacionActions() {
  const navigate = useNavigate();
  
  const prefetchCotizacion = usePrefetchCotizacion();
  const deleteCotizacion = useDeleteCotizacion();

  const [cotizacionAEliminar, setCotizacionAEliminar] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const exportandoRef = useRef(false);


  const irANueva = () => navigate("/cotizaciones/nueva");
  const irAEditar = (id: string) => navigate(`/cotizaciones/${id}/editar`);
  const irADetalle = (id: string) => navigate(`/cotizaciones/${id}`);

  const confirmarEliminar = async () => {
    if (!cotizacionAEliminar) return;
    try {
      await deleteCotizacion.mutateAsync(cotizacionAEliminar);
      // Toast de éxito/error lo emite `useDeleteCotizacion` para evitar duplicado.
      setCotizacionAEliminar(null);
    } catch {
      // v13.823.348 — el diálogo permanece abierto para reintentar; cerrarlo
      // ocultaba el fallo y obligaba a rebuscar la cotización.
    }
  };

  /**
   * YG-03: recibe un *loader* (no un array ya en memoria) porque el listado es
   * server-side: el CSV debe incluir todo el resultado filtrado, trayéndolo por
   * lotes en el momento de exportar.
   *
   * v13.823.349: guard in-flight — dos clics rápidos disparaban dos cargas y
   * dos descargas, y un fallo de red quedaba como promesa rechazada sin aviso.
   */
  const exportar = async (cargarFilas: () => Promise<CotizacionExportRow[]>) => {
    if (exportandoRef.current) return;
    exportandoRef.current = true;
    setExportando(true);
    try {
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
          // v13.823.355 (YAGNI r2 · P1): mismo nombre que muestra la tabla; antes
          // el CSV de Prospectos salía con la columna Cliente vacía.
          cliente: nombreMostradoCotizacion(c),
          modo: c.modo,
          ruta: `${c.origen || ""} → ${c.destino || ""}`,
          subtotal: c.subtotal,
          moneda: c.moneda,
          estado: c.estado,
          vigencia: c.fecha_vigencia || "",
        })),
      );
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo exportar el CSV",
        description: getErrorMessage(error),
        error: error instanceof Error ? error : undefined,
        method: "COTIZACIONES_EXPORTAR_CSV",
      });
    } finally {
      exportandoRef.current = false;
      setExportando(false);
    }
  };

  return {
    cotizacionAEliminar,
    setCotizacionAEliminar,
    confirmarEliminar,
    isDeleting: deleteCotizacion.isPending,
    exportar,
    exportando,
    irANueva,
    irAEditar,
    irADetalle,
    prefetchCotizacion,
  };
}

