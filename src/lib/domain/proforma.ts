/**
 * Lógica de dominio pura para proformas. Sin dependencias de React, Supabase ni I/O.
 * Testeable de forma aislada.
 */
import { calcularIVA } from "@/lib/financial/financialUtils";

export type Moneda = "USD" | "MXN";

export interface ConceptoVentaLite {
  id: string;
  cantidad: number | string;
  precio_unitario: number | string;
  moneda: string;
  aplica_iva?: boolean | null;
}

export interface TotalesProforma {
  subtotal_usd: number;
  iva_usd: number;
  total_usd: number;
  subtotal_mxn: number;
  iva_mxn: number;
  total_mxn: number;
}

/**
 * Calcula los totales (subtotal, IVA, total) por moneda para un conjunto de conceptos.
 * - MXN siempre lleva IVA.
 * - USD usa el override del usuario o el flag del concepto.
 */
export function calcularTotalesProforma(
  conceptos: ConceptoVentaLite[],
  tasaIva: number,
  ivaOverridesUSD: Record<string, boolean> = {},
): TotalesProforma {
  const usd = conceptos.filter((c) => c.moneda === "USD");
  const mxn = conceptos.filter((c) => c.moneda === "MXN");

  const subtotal_usd = usd.reduce(
    (s, c) => s + Number(c.cantidad) * Number(c.precio_unitario),
    0,
  );
  const iva_usd = usd.reduce((s, c) => {
    const sub = Number(c.cantidad) * Number(c.precio_unitario);
    const aplica = c.id in ivaOverridesUSD ? ivaOverridesUSD[c.id] : !!c.aplica_iva;
    return aplica ? s + calcularIVA(sub, tasaIva) : s;
  }, 0);

  const subtotal_mxn = mxn.reduce(
    (s, c) => s + Number(c.cantidad) * Number(c.precio_unitario),
    0,
  );
  const iva_mxn = calcularIVA(subtotal_mxn, tasaIva);

  return {
    subtotal_usd,
    iva_usd,
    total_usd: subtotal_usd + iva_usd,
    subtotal_mxn,
    iva_mxn,
    total_mxn: subtotal_mxn + iva_mxn,
  };
}

// ─── Agrupación de proformas pendientes (UI helper puro) ─────────────────────

/**
 * Forma mínima de proforma pendiente que esta lógica necesita.
 * Definida aquí para no acoplar el dominio al tipo Supabase del hook.
 */
export interface ProformaPendienteLite {
  id: string;
  numero: string;
  expediente: string;
  embarque_id: string | null;
  cliente_id: string;
  cliente_nombre: string;
  operador: string | null;
  dias_credito: number | null;
  bl_master: string | null;
  total_usd: number | string | null;
  total_mxn: number | string | null;
  embarques?: {
    bl_master?: string | null;
    contenedor?: string | null;
    tipo_contenedor?: string | null;
  } | null;
}

export interface GrupoContenedor<T extends ProformaPendienteLite = ProformaPendienteLite> {
  contenedor: string | null;
  tipo_contenedor: string | null;
  proformas: T[];
}

export interface GrupoExpediente<T extends ProformaPendienteLite = ProformaPendienteLite> {
  expediente: string;
  embarqueId: string;
  blMaster: string | null;
  clienteId: string;
  clienteNombre: string;
  operador: string | null;
  diasCredito: number | null;
  proformas: T[];
  contenedores: GrupoContenedor<T>[];
}

/**
 * Agrupa proformas por expediente y, dentro de cada expediente, por contenedor.
 * Devuelve los grupos ordenados alfabéticamente por expediente.
 */
export function agruparProformasPendientes<T extends ProformaPendienteLite>(
  proformas: T[],
): GrupoExpediente<T>[] {
  const porExpediente = new Map<string, GrupoExpediente<T>>();

  for (const p of proformas) {
    const key = p.expediente;
    if (!porExpediente.has(key)) {
      porExpediente.set(key, {
        expediente: p.expediente,
        embarqueId: p.embarque_id!,
        blMaster: p.embarques?.bl_master ?? p.bl_master ?? null,
        clienteId: p.cliente_id,
        clienteNombre: p.cliente_nombre,
        operador: p.operador,
        diasCredito: p.dias_credito,
        proformas: [],
        contenedores: [],
      });
    }
    porExpediente.get(key)!.proformas.push(p);
  }

  for (const grupo of porExpediente.values()) {
    const porContenedor = new Map<string, GrupoContenedor<T>>();
    for (const p of grupo.proformas) {
      const cont = p.embarques?.contenedor ?? null;
      const tipoCont = p.embarques?.tipo_contenedor ?? null;
      const key = cont ?? "__sin_contenedor__";
      if (!porContenedor.has(key)) {
        porContenedor.set(key, { contenedor: cont, tipo_contenedor: tipoCont, proformas: [] });
      }
      porContenedor.get(key)!.proformas.push(p);
    }
    grupo.contenedores = Array.from(porContenedor.values());
  }

  return Array.from(porExpediente.values()).sort((a, b) =>
    a.expediente.localeCompare(b.expediente),
  );
}

/**
 * Devuelve el monto principal a mostrar de una proforma pendiente:
 * USD si hay, en caso contrario MXN.
 */
export function montoPrincipalProforma(
  p: Pick<ProformaPendienteLite, "total_usd" | "total_mxn">,
): { valor: number; moneda: Moneda } {
  const usd = Number(p.total_usd ?? 0);
  const mxn = Number(p.total_mxn ?? 0);
  if (usd > 0) return { valor: usd, moneda: "USD" };
  return { valor: mxn, moneda: "MXN" };
}

/**
 * Suma totales (USD/MXN) de un subconjunto de proformas seleccionadas por id.
 */
export function totalesProformasSeleccionadas<T extends ProformaPendienteLite>(
  proformas: T[],
  selectedIds: ReadonlySet<string>,
): { usd: number; mxn: number } {
  let usd = 0;
  let mxn = 0;
  for (const p of proformas) {
    if (selectedIds.has(p.id)) {
      usd += Number(p.total_usd ?? 0);
      mxn += Number(p.total_mxn ?? 0);
    }
  }
  return { usd, mxn };
}
