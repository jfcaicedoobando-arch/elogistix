// v13.303.42 — helper único para etiquetar el `expediente` de un embarque.
// Los borradores creados desde una cotización ya no reservan folio; el
// expediente se asigna al confirmar. Este helper normaliza el fallback UI.

const PLACEHOLDER = "Sin folio";

export function labelExpediente(
  expediente: string | null | undefined,
  fallbackId?: string | null,
): string {
  const trimmed = typeof expediente === "string" ? expediente.trim() : "";
  if (trimmed) return trimmed;
  if (fallbackId) return `Borrador ${fallbackId.slice(0, 8)}`;
  return PLACEHOLDER;
}

