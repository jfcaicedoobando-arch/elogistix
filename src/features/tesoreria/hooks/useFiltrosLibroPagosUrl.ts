/**
 * Ola 8 (M8): filtros y periodo del libro maestro de pagos sincronizados con
 * la URL, para que un enlace compartido reproduzca exactamente la misma vista.
 *
 * Mantiene la misma forma (`FiltrosLibroPagos` + `RangoPagos`) que ya consume
 * la pantalla, así que el resto del código no cambia.
 */
import { useCallback, useMemo } from "react";
import { useTextoUrl } from "@/hooks/shared";
import {
  FILTROS_LIBRO_PAGOS_INICIALES,
  type FiltrosLibroPagos,
} from "@/features/tesoreria/domain/libroPagos";
import { rangoMesPagos, type RangoPagos } from "@/features/tesoreria/domain/libroPagosRangos";

interface Resultado {
  rango: RangoPagos;
  setRango: (r: RangoPagos) => void;
  filtros: FiltrosLibroPagos;
  actualizarFiltros: (patch: Partial<FiltrosLibroPagos>) => void;
}

export function useFiltrosLibroPagosUrl(): Resultado {
  const mes = useMemo(() => rangoMesPagos(), []);
  const [desde, setDesde] = useTextoUrl("desde", mes.desde);
  const [hasta, setHasta] = useTextoUrl("hasta", mes.hasta);

  const ini = FILTROS_LIBRO_PAGOS_INICIALES;
  const [vista, setVista] = useTextoUrl("vista", ini.vista);
  const [cuentaId, setCuentaId] = useTextoUrl("cuenta", ini.cuentaId);
  const [moneda, setMoneda] = useTextoUrl("moneda", ini.moneda);
  const [metodo, setMetodo] = useTextoUrl("metodo", ini.metodo);
  const [conciliacion, setConciliacion] = useTextoUrl("conciliacion", ini.conciliacion);
  const [rep, setRep] = useTextoUrl("rep", ini.rep);
  const [texto, setTexto] = useTextoUrl("q", ini.texto);

  const filtros = useMemo(
    () => ({
      vista: vista as FiltrosLibroPagos["vista"],
      cuentaId,
      moneda,
      metodo,
      conciliacion: conciliacion as FiltrosLibroPagos["conciliacion"],
      rep: rep as FiltrosLibroPagos["rep"],
      texto,
    }),
    [vista, cuentaId, moneda, metodo, conciliacion, rep, texto],
  );

  const actualizarFiltros = useCallback(
    (patch: Partial<FiltrosLibroPagos>) => {
      if (patch.vista !== undefined) setVista(patch.vista);
      if (patch.cuentaId !== undefined) setCuentaId(patch.cuentaId);
      if (patch.moneda !== undefined) setMoneda(patch.moneda);
      if (patch.metodo !== undefined) setMetodo(patch.metodo);
      if (patch.conciliacion !== undefined) setConciliacion(patch.conciliacion);
      if (patch.rep !== undefined) setRep(patch.rep);
      if (patch.texto !== undefined) setTexto(patch.texto);
    },
    [setVista, setCuentaId, setMoneda, setMetodo, setConciliacion, setRep, setTexto],
  );

  const setRango = useCallback(
    (r: RangoPagos) => { setDesde(r.desde); setHasta(r.hasta); },
    [setDesde, setHasta],
  );

  const rango = useMemo(() => ({ desde, hasta }), [desde, hasta]);

  return { rango, setRango, filtros, actualizarFiltros };
}
