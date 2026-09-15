// v13.303.42 — helper único para etiquetar el `expediente` de un embarque.
// Los borradores creados desde una cotización ya no reservan folio; el
// expediente se asigna al confirmar. Este helper normaliza el fallback UI.

const PLACEHOLDER = "Sin folio";

/**
 * EMB-NEW-02 — estados en los que un embarque legítimamente no tiene folio.
 * En cualquier otro estado el folio es un invariante: si falta (dato legacy)
 * NUNCA se etiqueta como "Borrador", porque el embarque ya está operando.
 */
const ESTADOS_SIN_FOLIO = new Set(["Borrador", "Cotización", "Cancelado"]);

export function labelExpediente(
  expediente: string | null | undefined,
  fallbackId?: string | null,
  estado?: string | null,
): string {
  const trimmed = typeof expediente === "string" ? expediente.trim() : "";
  if (trimmed) return trimmed;
  if (estado && !ESTADOS_SIN_FOLIO.has(estado)) {
    return fallbackId ? `${PLACEHOLDER} (${fallbackId.slice(0, 8)})` : PLACEHOLDER;
  }
  if (fallbackId) return `Borrador ${fallbackId.slice(0, 8)}`;
  return PLACEHOLDER;
}
