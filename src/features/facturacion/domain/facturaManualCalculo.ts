/** BL-12: cantidad fiscal, base redondeada y después IVA por línea. */
import { subtotalLinea } from "@/lib/financial/financialUtils";
import { parseCantidadFiscal } from "@/lib/domain/facturaConceptos";
import { TASA_IVA_FRONTERA_MX, type TipoIvaSat } from "@/lib/financial/tipoIvaSat";

export function tasaAplicada(tipo: TipoIvaSat | undefined, tasaGlobal: number): number | null {
  const tratamiento = tipo ?? "gravado_16";
  if (tratamiento === "gravado_16") return tasaGlobal;
  if (tratamiento === "gravado_8") return TASA_IVA_FRONTERA_MX;
  if (tratamiento === "tasa_0") return 0;
  return null;
}

export function calcularImportesManual(concepto: {
  cantidad: number;
  precio_unitario: number;
  tipo_iva?: TipoIvaSat;
}, tasaGlobal: number) {
  // Captura incompleta: cero en preview; el servicio valida antes de persistir.
  const cantidad = parseCantidadFiscal(concepto.cantidad, 0);
  const totalLinea = subtotalLinea(cantidad, concepto.precio_unitario);
  const tasaFila = tasaAplicada(concepto.tipo_iva, tasaGlobal);
  const ivaLinea = tasaFila == null ? 0 : subtotalLinea(totalLinea, tasaFila);
  return { cantidad, totalLinea, ivaLinea, tasaFila };
}
