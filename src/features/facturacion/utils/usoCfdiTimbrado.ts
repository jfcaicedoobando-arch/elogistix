import { validarUsoCfdiIngreso, type ReceptorUsoCfdi } from "@/lib/financial/usoCfdiFiscal";
import type { TimbradoExitoWire } from "../services/timbradoWire";

/** Nunca aprende una sustitución del proveedor ni un resultado sin XML comprobado. */
export function usoCfdiParaPreferencia(res: TimbradoExitoWire, receptor: ReceptorUsoCfdi): string | undefined {
  if (res.fuente_uso_cfdi !== "xml" || res.uso_cfdi_efectivo !== receptor.usoCfdi) return undefined;
  if (res.uso_cfdi_solicitado !== receptor.usoCfdi || validarUsoCfdiIngreso(receptor).length) return undefined;
  return receptor.usoCfdi;
}

/** La discrepancia es informativa: el timbre ya existe y no hay acción de reemisión. */
export function descripcionTimbradoExitoso(res: TimbradoExitoWire): string {
  const folio = `Serie ${res.serie} · Folio ${res.folio}`;
  if (res.fuente_uso_cfdi !== "xml" || !res.uso_cfdi_efectivo || !res.uso_cfdi_solicitado) return folio;
  if (res.uso_cfdi_efectivo === res.uso_cfdi_solicitado) return folio;
  return `${folio}. Uso CFDI solicitado: ${res.uso_cfdi_solicitado}; efectivo en el XML: ${res.uso_cfdi_efectivo}. Se conserva el uso del XML timbrado.`;
}
