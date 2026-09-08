import { useEffect } from "react";

export type SyncNombreCampo = "naviera" | "agente";

/**
 * R215-COT-02: la cotización guarda `naviera_id` / `agente_id` pero no siempre
 * el nombre. El validador y el payload usan el TEXTO, así que el paso 2 pedía
 * "selecciona una opción" con la naviera ya dibujada. Al resolver el catálogo
 * se copia el nombre sin marcar override manual (`shouldDirty: false`).
 */
export function useSyncNombreDesdeCatalogo(
  campo: SyncNombreCampo,
  currentId: string | null | undefined,
  nombreGuardado: string | null | undefined,
  buscarNombre: (id: string) => string | undefined,
  setValue: (campo: SyncNombreCampo, nombre: string) => void,
) {
  useEffect(() => {
    if (!currentId) return;
    if ((nombreGuardado ?? "").trim()) return;
    const nombre = buscarNombre(currentId);
    if (nombre) setValue(campo, nombre);
  }, [campo, currentId, nombreGuardado, buscarNombre, setValue]);
}
