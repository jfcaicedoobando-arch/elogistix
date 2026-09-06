/**
 * Reset del formulario de tarifas.
 *
 * P2 (auditoría v13.823.143 · bug 3): antes el efecto de reset dependía de la
 * identidad del objeto `initial`, así que cualquier refetch del padre lo
 * reconstruía y borraba lo capturado (p. ej. la naviera seleccionada en el
 * portal del agente). Aquí `initial` se estabiliza por contenido: se sigue
 * hidratando cuando los datos llegan después de abrir, pero no se pierde la
 * captura si el contenido no cambió.
 */
import { useEffect, useMemo } from "react";
import type { TarifaInput } from "@/features/costeo/services/tarifas";

interface Params {
  open: boolean;
  initial?: Partial<TarifaInput>;
  agenteIdFijo?: string;
  /** Debe ser estable (`useCallback`) para no reiniciar en cada render. */
  onReset: (initial: Partial<TarifaInput> | undefined) => void;
}

export function useTarifaFormReset({ open, initial, agenteIdFijo, onReset }: Params) {
  const initialKey = JSON.stringify(initial ?? null);
  // Se estabiliza por CONTENIDO: se reconstruye desde el JSON, así el objeto
  // sólo cambia de identidad cuando su contenido cambia y un refetch del padre
  // no vuelve a disparar el reset (sin desactivar reglas de React).
  const initialEstable = useMemo<Partial<TarifaInput> | undefined>(
    () => (initialKey === "null" ? undefined : (JSON.parse(initialKey) as Partial<TarifaInput>)),
    [initialKey],
  );

  useEffect(() => {
    if (!open) return;
    onReset(agenteIdFijo ? { ...initialEstable, agente_id: agenteIdFijo } : initialEstable);
  }, [open, initialEstable, agenteIdFijo, onReset]);
}
