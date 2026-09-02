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

export const PAISES_CN = ["CN", "China"];
export const PAISES_MX = ["MX", "Mexico", "México"];

interface PuertoLite {
  country?: string | null;
}

export function filtrarPorPais<T extends PuertoLite>(puertos: T[], paises: string[]): T[] {
  return puertos.filter((p) => paises.includes(String(p.country ?? "")));
}

/** Filtros del buscador; se resetean al abrir con los valores iniciales. */
export function useFiltrosTarifa(open: boolean, initial: FiltrosTarifaInitial | undefined) {
  const [origen, setOrigen] = useState(initial?.puertoOrigenId ?? "");
  const [destino, setDestino] = useState(initial?.puertoDestinoId ?? "");
  const [tipo, setTipo] = useState(initial?.tipoContenedorId ?? "");
  const [fecha, setFecha] = useState(todayLocalISO());

  useEffect(() => {
    if (open) {
      setOrigen(initial?.puertoOrigenId ?? "");
      setDestino(initial?.puertoDestinoId ?? "");
      setTipo(initial?.tipoContenedorId ?? "");
    }
  }, [open, initial?.puertoOrigenId, initial?.puertoDestinoId, initial?.tipoContenedorId]);

  return { origen, setOrigen, destino, setDestino, tipo, setTipo, fecha, setFecha };
}
