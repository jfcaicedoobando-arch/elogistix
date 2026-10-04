/**
 * Helper para procesar un CFDI recién parseado antes de aplicar el resultado
 * al estado del formulario. Extraído del hook controller para respetar el
 * límite Power-of-10 de 200 líneas por función.
 *
 * No toca React ni componentes: sólo valida el cuadre fiscal, resuelve el
 * proveedor por RFC y calcula los valores a inyectar. La UI decide cómo
 * reaccionar al resultado (mostrar error, pedir crear proveedor, etc.).
 */
import { normalizarConceptoPersistible, cantidadesCapturaValidas, calcularCuadreCaptura } from "../utils/conceptosPersistibles";
import type { CfdiParsedResponse, CfdiConceptoParsed } from "@/features/cxp/services";
import { validarCuadreCfdi } from "@/features/cxp/services";
import { findProveedorByRfcEnOrg } from "@/features/proveedor/services";
import type { FacturaFormValues } from "@/features/cxp/types";
import type { TcOrigen } from "@/features/cxp/types";
import { mapCfdiToValues, type PendingCfdi } from "./useNuevaFacturaProveedorForm.helpers";

export type ProcesarCfdiResult =
  | { ok: false; cuadreError: string }
  | {
      ok: true;
      values: FacturaFormValues;
      pendingCfdi: PendingCfdi;
      tcOrigen: TcOrigen;
      tcFechaAplicada?: string;
      askCrearProv: { rfc: string; nombre: string } | null;
      conceptos: CfdiConceptoParsed[];
    };

export async function procesarCfdiParsed(
  data: CfdiParsedResponse,
  files: { xml: File; pdf: File | null },
  organizationId: string | null,
): Promise<ProcesarCfdiResult> {
  const c = data.cfdi;

  // Validación fiscal: el desglose de IVA/IEPS por concepto debe cuadrar
  // contra los totales declarados en el CFDI antes de registrar el gasto.
  const conceptos = (c.conceptos ?? []).map(normalizarConceptoPersistible);
  if (!cantidadesCapturaValidas(conceptos)) {
    return { ok: false, cuadreError: "Cada concepto requiere cantidad mínima de 0.000001 (hasta 6 decimales)." };
  }
  const cuadre = validarCuadreCfdi({ ...c, conceptos });
  if (!cuadre.ok) return { ok: false, cuadreError: `La captura usa precios a 2 decimales. ${cuadre.errores.join(" ")}` };
  const subtotalPersistible = calcularCuadreCaptura(c.subtotal, conceptos.map((linea) => ({ monto: linea.importe, cantidad: linea.cantidad })));
  if (!subtotalPersistible.puedeAprobar) {
    return { ok: false, cuadreError: "Los conceptos normalizados a 2 decimales no cuadran con el subtotal (tolerancia 0.01)." };
  }

  let provId = "";
  let provNombre = c.emisor.nombre;
  let askCrearProv: { rfc: string; nombre: string } | null = null;
  try {
    const found = await findProveedorByRfcEnOrg(c.emisor.rfc, organizationId);
    if (found) { provId = found.id; provNombre = found.nombre; }
    else askCrearProv = { rfc: c.emisor.rfc, nombre: c.emisor.nombre };
  } catch { /* lookup opcional */ }

  const values = mapCfdiToValues(data, provId, provNombre);
  const pendingCfdi: PendingCfdi = {
    uuid: c.uuid, rfcEmisor: c.emisor.rfc, xmlFile: files.xml, pdfFile: files.pdf,
    origen: "cfdi",
  };

  // El XML del CFDI trae el tipo_cambio oficial del emisor — respetarlo.
  const usaTcCfdi = c.moneda !== "MXN" && Number(c.tipo_cambio) > 0;
  return {
    ok: true,
    values,
    pendingCfdi,
    tcOrigen: usaTcCfdi ? "cfdi" : "vacio",
    tcFechaAplicada: usaTcCfdi ? c.fecha : undefined,
    askCrearProv,
    conceptos,
  };
}
