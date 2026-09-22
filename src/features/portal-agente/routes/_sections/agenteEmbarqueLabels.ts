/**
 * P2 auditoría v13.824.3 — los borradores llegaban sin expediente y el agente
 * veía filas idénticas con la celda vacía. Se muestra un identificador corto
 * derivado del ID interno (igual que ve Operaciones: "Borrador f7e31d5a"),
 * sin revelar datos comerciales.
 */
export function etiquetaExpedienteAgente(
  expediente: string | null | undefined,
  id: string,
): string {
  const limpio = String(expediente ?? "").trim();
  if (limpio) return limpio;
  const corto = String(id ?? "").trim().slice(0, 8);
  return corto ? `Borrador ${corto}` : "Borrador";
}
