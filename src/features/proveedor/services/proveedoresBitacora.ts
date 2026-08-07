/**
 * Bitácora de proveedores — v13.453.1
 *
 * Envuelve el registro en la bitácora del sistema para altas/ediciones/bajas de
 * proveedores. Vive aparte de `proveedoresCrud.ts` para respetar el límite de
 * 200 líneas por archivo (Power of 10).
 */
import { registrarActividad } from "@/services/bitacora/registrar";

export function bitacoraProveedor(
  accion: "crear" | "editar" | "eliminar",
  entidadId: string,
  entidadNombre: string,
  detalles: Record<string, unknown>,
): Promise<void> {
  return registrarActividad({
    modulo: "proveedores",
    accion,
    entidadId,
    entidadNombre,
    detalles,
  });
}
