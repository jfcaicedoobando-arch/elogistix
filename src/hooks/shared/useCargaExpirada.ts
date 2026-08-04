/**
 * R7-FIX6 — Detecta cargas que se quedan "colgadas".
 *
 * Cuando una consulta tarda más de `ms` sin resolverse, la pantalla no debe
 * quedarse con el esqueleto para siempre: este hook devuelve `true` para que la
 * UI ofrezca un reintento explícito.
 */
import { useEffect, useState } from "react";

export function useCargaExpirada(cargando: boolean, ms = 20_000): boolean {
  const [expirada, setExpirada] = useState(false);

  useEffect(() => {
    if (!cargando) {
      setExpirada(false);
      return;
    }
    const t = setTimeout(() => setExpirada(true), ms);
    return () => clearTimeout(t);
  }, [cargando, ms]);

  return expirada;
}
