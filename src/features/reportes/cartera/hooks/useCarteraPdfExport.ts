import { useLayoutEffect, useRef, useState } from "react";
import { descargarCarteraPdf, type BloqueCartera } from "../services/carteraDescargas";
import type { CarteraDataScope } from "../services/carteraSnapshot";

type SeleccionCartera = {
  fechaCorte: string;
  leyenda: string;
  bloques: readonly BloqueCartera[];
  dataScope: CarteraDataScope | undefined;
  puedeExportar: boolean;
  busqueda: string;
};

/** Una selección sustituida o desmontada nunca recupera su trabajo pendiente. */
export function useCarteraPdfExport(seleccion: SeleccionCartera) {
  const { fechaCorte, leyenda, bloques, dataScope, puedeExportar, busqueda } = seleccion;
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const montado = useRef(false);
  const secuencia = useRef(0);
  const trabajo = useRef<{ id: number; controller: AbortController } | null>(null);
  const exportActual = useRef(seleccion);
  exportActual.current = seleccion;

  useLayoutEffect(() => {
    // También se ejecuta tras el ciclo setup/cleanup/setup de StrictMode.
    montado.current = true;
    setGenerandoPdf(false);
    return () => {
      montado.current = false;
      secuencia.current += 1;
      trabajo.current?.controller.abort();
      trabajo.current = null;
    };
  }, [fechaCorte, leyenda, bloques, dataScope, puedeExportar, busqueda]);

  const exportarPdf = async () => {
    // El ref evita dos inicios en el mismo turno, antes del siguiente render.
    if (!montado.current || !puedeExportar || !dataScope || trabajo.current) return;
    const id = ++secuencia.current;
    const controller = new AbortController();
    trabajo.current = { id, controller };
    setGenerandoPdf(true);
    const sigueVigente = () => {
      const actual = exportActual.current;
      return montado.current && secuencia.current === id && trabajo.current?.id === id
        && !controller.signal.aborted && actual.puedeExportar
        && actual.fechaCorte === fechaCorte && actual.bloques === bloques
        && actual.dataScope === dataScope && actual.busqueda === busqueda;
    };
    try {
      await descargarCarteraPdf(fechaCorte, leyenda, bloques, dataScope, {
        busqueda, sigueVigente, signal: controller.signal,
      });
    } finally {
      // Una finalización obsoleta no libera los controles de un trabajo nuevo.
      if (montado.current && secuencia.current === id && trabajo.current?.id === id) {
        trabajo.current = null;
        setGenerandoPdf(false);
      }
    }
  };

  return { generandoPdf, exportarPdf };
}
