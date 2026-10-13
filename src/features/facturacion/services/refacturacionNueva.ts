/** Prechecks de UI; no sustituyen los guards transaccionales pendientes en las RPC. */
import { facturaNuevaLista } from "../domain/refacturacionEstadoFiscal";
import {
  duplicarFacturaParaRefacturacion,
  obtenerCasoRefacturacion,
  obtenerEstadoFacturaRefacturacion,
  type CasoRefacturacion,
} from "./refacturacion";

async function casoActual(originalId: string, casoId: string, assertActual: () => void): Promise<CasoRefacturacion> {
  assertActual();
  const caso = await obtenerCasoRefacturacion(originalId);
  assertActual();
  if (!caso || caso.id !== casoId) throw new Error("El caso cambió o no está disponible. Actualiza el estado.");
  return caso;
}

async function facturaVigente(id: string, assertActual: () => void) {
  assertActual();
  const factura = await obtenerEstadoFacturaRefacturacion(id);
  assertActual();
  if (!factura || factura.id !== id) throw new Error("La nueva factura vinculada no está disponible para consulta.");
  if (factura.deleted_at !== null) {
    throw new Error("No se confirmó una nueva factura vigente; puede estar dada de baja. No se creó ni restauró otro borrador.");
  }
  return factura;
}

export async function verificarNuevaRefacturacion(
  originalId: string, casoId: string, exigirTimbrada: boolean, esperadaId: string | undefined, assertActual: () => void,
) {
  const caso = await casoActual(originalId, casoId, assertActual);
  if (!caso.factura_nueva_id) throw new Error("El caso no tiene una nueva factura verificable.");
  if (esperadaId && caso.factura_nueva_id !== esperadaId) throw new Error("La referencia de la nueva factura cambió. Actualiza el estado.");
  const factura = await facturaVigente(caso.factura_nueva_id, assertActual);
  if (exigirTimbrada && !facturaNuevaLista(factura)) throw new Error("La nueva factura debe estar timbrada y vigente.");
  return factura;
}

export async function crearBorradorRefacturacionVerificado(originalId: string, casoId: string, assertActual: () => void) {
  const caso = await casoActual(originalId, casoId, assertActual);
  if (caso.factura_nueva_id !== null) throw new Error("El caso ya tiene una referencia de factura nueva. Actualiza el estado; no se creará otro borrador.");
  assertActual();
  const id = await duplicarFacturaParaRefacturacion(casoId);
  assertActual();
  // La RPC actual puede reutilizar un borrador eliminado en una carrera. Nunca
  // convertir ese retorno en éxito operativo ni intentar recuperación automática.
  if (!id) throw new Error("La duplicación no devolvió una referencia verificable.");
  await verificarNuevaRefacturacion(originalId, casoId, false, id, assertActual);
  return id;
}
