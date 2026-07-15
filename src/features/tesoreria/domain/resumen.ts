/**
 * Lógica pura del dominio Tesorería: cálculo de resumen (flujo 30d, top
 * deudores/acreedores) y flujo proyectado semanal a N días.
 *
 * Extraído en v12.95.11 (Auditoría Paso 4) para romper el acoplamiento
 * service→service: `services/tesoreria/{resumen,flujoProyectado}.ts`
 * importaban directamente `@/services/facturas` y `@/services/cxp`. Ahora
 * los hooks componen las fuentes y pasan los datos a estas funciones puras.
 */

export interface ResumenCuenta {
  id: string;
  alias: string;
  banco: string;
  moneda: string;
  saldo: number;
}

export interface FlujoMes {
  por_cobrar_mxn: number;
  por_cobrar_usd: number;
  por_pagar_mxn: number;
  por_pagar_usd: number;
  flujo_neto_mxn: number;
  flujo_neto_usd: number;
}

export interface TopItem {
  nombre: string;
  saldo: number;
  moneda: string;
  dias?: number;
}

export interface ResumenTesoreria {
  cuentas: ResumenCuenta[];
  flujo: FlujoMes;
  top_deudores: TopItem[];
  top_acreedores: TopItem[];
}

export interface CobranzaRow {
  id: string;
  numero: string;
  cliente_nombre: string;
  moneda: string;
  saldo: number;
  fecha_vencimiento: string | null;
  estatus_cobranza?: string;
  dias_vencido?: number;
  tipo_cambio?: number;
}

export interface CxpRow {
  id: string;
  folio_proveedor: string;
  proveedor_nombre: string;
  moneda: string;
  saldo: number;
  fecha_vencimiento: string | null;
  estatus?: string;
  dias_vencido?: number;
  tipo_cambio_usd?: number;
}

export interface LiquidacionRow {
  id: string;
  vendedora_id: string;
  periodo: string;
  total_mxn: number;
  fecha_pago: string | null;
  created_at: string;
}

export function calcularResumenTesoreria(args: {
  cuentas: ResumenCuenta[];
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
  hoy?: Date;
}): ResumenTesoreria {
  const hoy = args.hoy ?? new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + 30);
  const enVentana = (iso: string | null) =>
    !!iso && new Date(iso + "T00:00:00") <= limite;

  const flujo: FlujoMes = {
    por_cobrar_mxn: 0, por_cobrar_usd: 0,
    por_pagar_mxn: 0, por_pagar_usd: 0,
    flujo_neto_mxn: 0, flujo_neto_usd: 0,
  };
  for (const f of args.cobranza) {
    if (!enVentana(f.fecha_vencimiento) || f.saldo <= 0) continue;
    if (f.moneda === "USD") flujo.por_cobrar_usd += f.saldo;
    else flujo.por_cobrar_mxn += f.saldo;
  }
  for (const f of args.cxp) {
    if (!enVentana(f.fecha_vencimiento) || f.saldo <= 0) continue;
    if (f.moneda === "USD") flujo.por_pagar_usd += f.saldo;
    else flujo.por_pagar_mxn += f.saldo;
  }
  flujo.flujo_neto_mxn = flujo.por_cobrar_mxn - flujo.por_pagar_mxn;
  flujo.flujo_neto_usd = flujo.por_cobrar_usd - flujo.por_pagar_usd;

  const top_deudores = agruparTop(
    args.cobranza,
    (f) => f.saldo > 0 && f.estatus_cobranza === "Vencida",
    (f) => f.cliente_nombre,
    (f) => f.moneda,
    (f) => f.saldo,
    (f) => f.dias_vencido,
  );

  const top_acreedores = agruparTop(
    args.cxp,
    (f) => f.saldo > 0 && (f.estatus === "Por vencer" || f.estatus === "Vencida"),
    (f) => f.proveedor_nombre,
    (f) => f.moneda,
    (f) => f.saldo,
    (f) => f.dias_vencido,
  );

  return { cuentas: args.cuentas, flujo, top_deudores, top_acreedores };
}

/**
 * Agrupa facturas/CxP por nombre+moneda antes de rankear (fix bug: antes
 * el top mostraba facturas individuales, por lo que un mismo cliente con
 * múltiples facturas vencidas aparecía varias veces en el top 5).
 * `dias` se conserva como el peor caso (más días vencidos) del grupo.
 */
function agruparTop<T>(
  rows: T[],
  filtro: (r: T) => boolean,
  nombreOf: (r: T) => string,
  monedaOf: (r: T) => string,
  saldoOf: (r: T) => number,
  diasOf: (r: T) => number | undefined,
): TopItem[] {
  const acc = new Map<string, TopItem>();
  for (const r of rows) {
    if (!filtro(r)) continue;
    const nombre = nombreOf(r);
    const moneda = monedaOf(r);
    const key = `${nombre}||${moneda}`;
    const dias = diasOf(r);
    const prev = acc.get(key);
    if (prev) {
      prev.saldo += saldoOf(r);
      if (dias != null && (prev.dias == null || dias > prev.dias)) prev.dias = dias;
    } else {
      acc.set(key, { nombre, saldo: saldoOf(r), moneda, dias });
    }
  }
  return Array.from(acc.values())
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 5);
}
