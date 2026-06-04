import type { StepValidationErrors } from "./embarqueWizardSchemas";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, ALLOWED_MIME_TYPES } from "./embarqueWizardConstants";
import { getMessage } from "@/lib/domain/errorCatalog";

export interface DocumentoArchivoValidacion {
  nombre: string;
  size: number;
  type: string;
}

export function validateArchivo(file: DocumentoArchivoValidacion): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    return getMessage("3.documento.tooLarge", {
      nombre: file.nombre,
      sizeMb,
      maxMb: MAX_FILE_SIZE_MB,
    });
  }
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type as never)) {
    return getMessage("3.documento.badFormat", { nombre: file.nombre });
  }
  return null;
}

export function validateStepDocumentos(
  archivos: Record<string, { size: number; type: string }>,
): StepValidationErrors {
  const errors: StepValidationErrors = {};
  for (const [nombre, file] of Object.entries(archivos)) {
    const err = validateArchivo({ nombre, size: file.size, type: file.type });
    if (err) errors[nombre] = err;
  }
  return errors;
}
