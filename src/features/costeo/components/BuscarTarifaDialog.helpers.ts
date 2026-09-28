/**
 * Helpers puros y hook de filtros para BuscarTarifaDialog.
 * Extraído para respetar Power-of-10 (≤200 líneas por archivo).
 */
import { useEffect, useRef, useState } from "react";
import { todayLocalISO } from "@/lib/date/today";

export interface FiltrosTarifaInitial {
  puertoOrigenId?: string;
  puertoDestinoId?: string;
  tipoContenedorId?: string;
}

/** Filtros del buscador; se resetean al abrir con los valores iniciales. */
export function useFiltrosTarifa(open: boolean, initial: FiltrosTarifaInitial | undefined) {
  const [origen, setOrigenState] = useState(initial?.puertoOrigenId ?? "");
  const [destino, setDestinoState] = useState(initial?.puertoDestinoId ?? "");
  const [tipo, setTipoState] = useState(initial?.tipoContenedorId ?? "");
  const [fecha, setFecha] = useState(todayLocalISO());
  const wasOpenRef = useRef(false);
  const touchedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      touchedRef.current = false;
    }
    // La precarga puede llegar después de abrir el diálogo. No debe borrar
    // los filtros que el operador ya empezó a capturar mientras cargaba.
    if (!touchedRef.current) {
      setOrigenState(initial?.puertoOrigenId ?? "");
      setDestinoState(initial?.puertoDestinoId ?? "");
      setTipoState(initial?.tipoContenedorId ?? "");
    }
  }, [open, initial?.puertoOrigenId, initial?.puertoDestinoId, initial?.tipoContenedorId]);

  /** Si el nuevo origen coincide con el destino elegido, limpiamos destino. */
  const setOrigen = (id: string) => {
    touchedRef.current = true;
    setOrigenState(id);
    if (id && id === destino) setDestinoState("");
  };
  const setDestino = (id: string) => {
    touchedRef.current = true;
    setDestinoState(id);
  };
  const setTipo = (id: string) => {
    touchedRef.current = true;
    setTipoState(id);
  };

  const mismoPuerto = !!origen && origen === destino;

  return { origen, setOrigen, destino, setDestino, tipo, setTipo, fecha, setFecha, mismoPuerto };
}
