/**
 * useAutoAbrirTimbrar — abre el diálogo de timbrado cuando la URL trae
 * `?accion=timbrar` (redirección tras convertir proforma → factura).
 * Extraído de `FacturaDetalle` para reducir complejidad ciclomática.
 */
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export function useAutoAbrirTimbrar(
  puedeTimbrarDesdeSistema: boolean,
  puedeEmitir: boolean,
  abrir: () => void,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("accion") === "timbrar") {
      if (puedeTimbrarDesdeSistema && puedeEmitir) {
        abrir();
      }
      const next = new URLSearchParams(searchParams);
      next.delete("accion");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, puedeTimbrarDesdeSistema, puedeEmitir, setSearchParams, abrir]);
}
