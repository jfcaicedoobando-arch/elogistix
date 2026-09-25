/**
 * El expediente aún no se asigna al borrador. En el listado se identifica
 * por su ruta y fechas, sin promover un fragmento de UUID como nombre humano.
 */
export function etiquetaExpedienteAgente(
  expediente: string | null | undefined,
  _id: string,
): string {
  const limpio = String(expediente ?? "").trim();
  if (limpio) return limpio;
  return "Borrador de embarque";
}
