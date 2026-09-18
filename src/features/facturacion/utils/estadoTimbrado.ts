/**
 * O7 — Estado derivado del diálogo de timbrado (checks + fast path).
 * Se extrae del componente para mantener su complejidad ciclomática baja
 * y poder testear la política de "todo listo" sin renderizar el diálogo.
 */
import { buildChecksTimbrado, type CheckTimbrado } from "@/features/facturacion/utils/validarDatosTimbrado";
import {
  AVISO_NO_OBJETO_PPD_REP,
  ppdConNoObjetoRequiereAviso,
  type LineaNoObjeto,
} from "@/lib/financial/noObjetoFiscal";
import { avisoFechaEmisionDesfasada } from "@/features/facturacion/utils/avisoFechaTimbrado";


interface FacturaLike {
  rfc_cliente?: string | null;
  fecha_emision?: string | null;
  moneda?: string | null;
  tipo_cambio?: number | string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
}

interface ClienteLike {
  rfc?: string | null;
  codigo_postal?: string | null;
  regimen_fiscal?: string | null;
}

interface SeleccionTimbrado {
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
}

export interface EstadoTimbrado {
  checks: CheckTimbrado[];
  puedeTimbrar: boolean;
  esFastPath: boolean;
  /** Advertencias informativas: NO impiden timbrar. */
  advertencias: string[];
}

export function buildEstadoTimbrado(
  factura: FacturaLike,
  cliente: ClienteLike | null | undefined,
  seleccion: SeleccionTimbrado,
  conceptos?: LineaNoObjeto[] | null,
): EstadoTimbrado {
  const { checks, puedeTimbrar } = buildChecksTimbrado({
    rfc: cliente?.rfc ?? factura.rfc_cliente ?? "",
    cp: cliente?.codigo_postal ?? "",
    regimen: cliente?.regimen_fiscal ?? "",
    usoCfdi: seleccion.usoCfdi,
    formaPago: seleccion.formaPago,
    metodoPago: seleccion.metodoPago,
    moneda: factura.moneda ?? "MXN",
    tipoCambio: factura.tipo_cambio == null ? null : Number(factura.tipo_cambio),
  });

  const advertencias = construirAdvertencias(factura, seleccion, conceptos);

  const esFastPath =
    puedeTimbrar &&
    advertencias.length === 0 &&
    Boolean(factura.uso_cfdi && factura.forma_pago && factura.metodo_pago);

  return { checks, puedeTimbrar, esFastPath, advertencias };
}

