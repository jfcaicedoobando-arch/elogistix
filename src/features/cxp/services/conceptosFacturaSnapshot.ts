/** Lectura consistente para editar conceptos: la cabecera versiona cada cambio de renglón. */
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";
import { fetchFacturaParaEdicion } from "./proveedorFacturas.update";
import { fetchConceptosCfdi } from "./conceptosCfdiFactura";

export async function fetchConceptosFacturaSnapshot(facturaId: string) {
  const factura = await fetchFacturaParaEdicion(facturaId);
  if (!factura) throw new Error("La factura ya no existe.");
  const conceptos = await fetchConceptosCfdi(facturaId);
  const posterior = await fetchFacturaParaEdicion(facturaId);
  if (!factura.updated_at || factura.updated_at !== posterior?.updated_at) {
    throw conflictoConcurrenciaError();
  }
  return { factura, conceptos };
}
