import { getErrorMessage } from "@/lib/errors";

/** Datos de diagnóstico de la respuesta; nunca contiene tokens ni headers. */
export class DescargaCfdiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string, readonly requestId?: string, readonly originalRequestId?: string) {
    super(message);
    this.name = "DescargaCfdiError";
  }
}

export function esAutenticacionDescarga(error: unknown): boolean {
  return error instanceof DescargaCfdiError && (error.status === 401 || error.code === "unauthorized");
}

export function mensajeDescargaCfdi(error: unknown): string {
  if (esAutenticacionDescarga(error)) {
    return "No se pudo validar tu sesión para descargar el comprobante. Vuelve a iniciar sesión y reintenta la descarga.";
  }
  if (error instanceof DescargaCfdiError && error.status === 403) {
    return "No tienes permiso para descargar este comprobante. Verifica la organización y tu acceso.";
  }
  if ((error instanceof DescargaCfdiError && [404, 422].includes(error.status))
    || (error instanceof Error && error.message === "Archivo no disponible")) {
    return "Este comprobante no tiene archivo disponible. Verifica su estado de timbrado antes de reintentar.";
  }
  if (error instanceof Error && /failed to fetch|networkerror|network request failed|failed to send a request/i.test(error.message)) {
    return "No se pudo contactar el servicio de descarga. Revisa tu conexión a internet y reintenta.";
  }
  return getErrorMessage(error);
}
