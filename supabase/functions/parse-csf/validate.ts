// Validación pura del archivo CSF. Aislado del handler para permitir tests
// directos en Deno sin arrastrar imports HTTP/Logger.
export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateFile(file: File | null): string | null {
  if (!file) return "No se envió archivo PDF";
  if (file.type !== "application/pdf") return "Solo se aceptan archivos PDF";
  if (file.size > MAX_BYTES) return "El archivo excede el límite de 5 MB";
  return null;
}
