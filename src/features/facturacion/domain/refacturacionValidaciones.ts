/**
 * Validaciones fiscales puras del caso de refacturación (Ola 12).
 * Reflejan las reglas duras de la base (`LC_REFACT_*`) para poder avisar al
 * usuario antes de intentar la operación.
 */
import { esRfcMxValido, normalizarRfc } from "@/lib/validation/rfcMx";

export interface ReceptorFiscal {
  nombre: string | null;
  rfc: string | null;
  regimen_fiscal: string | null;
  codigo_postal: string | null;
}

/** Datos fiscales que le faltan al receptor para poder timbrarle (CFDI 4.0). */
export function pendientesReceptorFiscal(receptor: ReceptorFiscal | null): string[] {
  if (!receptor) return ["razón social", "RFC", "régimen fiscal", "código postal"];
  const faltan: string[] = [];
  if (!(receptor.nombre ?? "").trim()) faltan.push("razón social");
  if (!esRfcMxValido(receptor.rfc, { permitirGenerico: false })) faltan.push("RFC válido (no genérico)");
  if (!(receptor.regimen_fiscal ?? "").trim()) faltan.push("régimen fiscal");
  if (!/^\d{5}$/.test((receptor.codigo_postal ?? "").trim())) faltan.push("código postal (5 dígitos)");
  return faltan;
}

export function receptorListoParaFacturar(receptor: ReceptorFiscal | null): boolean {
  return pendientesReceptorFiscal(receptor).length === 0;
}

/**
 * Motivo por el que no se puede registrar el ordenante del depósito.
 * `null` significa "capturado correctamente".
 */
export function bloqueoOrdenante(nombre: string, rfc: string): string | null {
  if (!nombre.trim()) {
    return "Captura el nombre de la empresa desde la que se recibió el depósito.";
  }
  const rfcNorm = normalizarRfc(rfc);
  if (rfcNorm !== "" && !esRfcMxValido(rfcNorm)) {
    return "El RFC del ordenante no tiene formato válido del SAT (12 o 13 caracteres).";
  }
  return null;
}

export interface ImportesFactura {
  moneda: string;
  tipo_cambio: number | null;
  subtotal: number | null;
  iva: number | null;
  ret_isr: number | null;
  ret_iva: number | null;
  total: number | null;
}

export interface DiferenciaImportes {
  campo: string;
  original: number;
  nueva: number;
}

const CENTAVO = 0.005;

function num(v: number | null | undefined): number {
  return Number(v ?? 0);
}

/** Diferencias mayores a un centavo entre la factura original y la nueva. */
export function diferenciasImportes(
  original: ImportesFactura | null,
  nueva: ImportesFactura | null,
): DiferenciaImportes[] {
  if (!original || !nueva) return [];
  const campos: Array<[string, keyof ImportesFactura]> = [
    ["Subtotal", "subtotal"],
    ["IVA trasladado", "iva"],
    ["Retención de ISR", "ret_isr"],
    ["Retención de IVA", "ret_iva"],
    ["Total", "total"],
  ];
  return campos
    .map(([campo, key]) => ({
      campo,
      original: num(original[key] as number | null),
      nueva: num(nueva[key] as number | null),
    }))
    .filter((d) => Math.abs(d.original - d.nueva) > CENTAVO);
}

/** Avisos de moneda y tipo de cambio entre original y nueva. */
export function avisosMoneda(
  original: ImportesFactura | null,
  nueva: ImportesFactura | null,
): string[] {
  if (!original || !nueva) return [];
  const avisos: string[] = [];
  if (original.moneda !== nueva.moneda) {
    avisos.push(`La factura original está en ${original.moneda} y la nueva en ${nueva.moneda}.`);
  }
  if (nueva.moneda !== "MXN" && num(nueva.tipo_cambio) <= 0) {
    avisos.push("Falta el tipo de cambio de la nueva factura.");
  }
  return avisos;
}
