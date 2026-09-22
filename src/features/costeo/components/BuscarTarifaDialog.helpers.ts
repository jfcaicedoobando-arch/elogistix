/**
 * Helpers puros y hook de filtros para BuscarTarifaDialog.
 * Extraído para respetar Power-of-10 (≤200 líneas por archivo).
 */
import { useEffect, useState } from "react";
import { todayLocalISO } from "@/lib/date/today";

export interface FiltrosTarifaInitial {
  puertoOrigenId?: string;
  puertoDestinoId?: string;
  tipoContenedorId?: string;
}

/** Filtros del buscador; se resetean al abrir con los valores iniciales. */
export function useFiltrosTarifa(open: boolean, initial: FiltrosTarifaInitial | undefined) {
  const [origen, setOrigenState] = useState(initial?.puertoOrigenId ?? "");
  const [destino, setDestino] = useState(initial?.puertoDestinoId ?? "");
  const [tipo, setTipo] = useState(initial?.tipoContenedorId ?? "");
  const [fecha, setFecha] = useState(todayLocalISO());

  useEffect(() => {
    if (open) {
      setOrigenState(initial?.puertoOrigenId ?? "");
      setDestino(initial?.puertoDestinoId ?? "");
      setTipo(initial?.tipoContenedorId ?? "");
    }
  }, [open, initial?.puertoOrigenId, initial?.puertoDestinoId, initial?.tipoContenedorId]);

  /** Si el nuevo origen coincide con el destino elegido, limpiamos destino. */
  const setOrigen = (id: string) => {
    setOrigenState(id);
    if (id && id === destino) setDestino("");
  };

  const mismoPuerto = !!origen && origen === destino;

  return { origen, setOrigen, destino, setDestino, tipo, setTipo, fecha, setFecha, mismoPuerto };
}
