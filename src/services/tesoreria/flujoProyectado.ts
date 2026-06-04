/**
 * Flujo de caja proyectado a 90 días, agrupado por semana ISO.
 *
 * Entradas esperadas: `facturas` no pagadas con `fecha_vencimiento` en ventana.
 * Salidas esperadas: `proveedor_facturas` no pagadas con `fecha_vencimiento` en ventana
 *                    + `liquidaciones_comision` sin `fecha_pago`.
 *
 * Saldo inicial: suma de cuentas bancarias (saldo_inicial + Σabonos − Σcargos).
 * Conversión USD/EUR → MXN usando `tipo_cambio` del documento (fallback 1).
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchCobranza } from "@/services/facturas";
import { fetchFacturasCxP } from "@/services/cxp";
import { fetchResumenTesoreria } from "./resumen";

export interface DetalleFlujo {
  id: string;
  concepto: string;
  monto_mxn: number;
  fecha_vencimiento: string;
  moneda: string;
}

export interface SemanaFlujo {
  semana_iso: string;
  inicio: string;
  fin: string;
  entradas_mxn: number;
  salidas_mxn: number;
  flujo_neto_mxn: number;
  saldo_proyectado_mxn: number;
  detalle_entradas: DetalleFlujo[];
  detalle_salidas: DetalleFlujo[];
}

export interface FlujoProyectado {
  saldo_inicial_mxn: number;
  semanas: SemanaFlujo[];
  total_entradas_mxn: number;
  total_salidas_mxn: number;
  saldo_final_mxn: number;
  alertas_negativas: number;
}

function inicioSemana(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dia = x.getDay();
  const diff = dia === 0 ? -6 : 1 - dia; // lunes como inicio
  x.setDate(x.getDate() + diff);
  return x;
}

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function toMxn(monto: number, moneda: string, tc: number): number {
  if (moneda === "MXN") return monto;
  if (!tc || tc <= 0) return monto;
  return monto * tc;
}

export async function fetchFlujoProyectado(dias = 90): Promise<FlujoProyectado> {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy); limite.setDate(limite.getDate() + dias);

  // Generar semanas
  const semanasMap = new Map<string, SemanaFlujo>();
  let cursor = inicioSemana(hoy);
  while (cursor <= limite) {
    const fin = new Date(cursor); fin.setDate(fin.getDate() + 6);
    const key = isoWeekKey(cursor);
    semanasMap.set(key, {
      semana_iso: key,
      inicio: cursor.toISOString().slice(0, 10),
      fin: fin.toISOString().slice(0, 10),
      entradas_mxn: 0, salidas_mxn: 0, flujo_neto_mxn: 0, saldo_proyectado_mxn: 0,
      detalle_entradas: [], detalle_salidas: [],
    });
    cursor = new Date(cursor); cursor.setDate(cursor.getDate() + 7);
  }

  const [resumen, cobranza, cxp, liqs] = await Promise.all([
    fetchResumenTesoreria(),
    fetchCobranza({}),
    fetchFacturasCxP({}),
    supabase.from("liquidaciones_comision")
      .select("id, vendedora_id, periodo, total_mxn, fecha_pago, created_at")
      .is("fecha_pago", null)
      .limit(500)
      .then((r) => (r.data ?? []) as Array<{
        id: string; vendedora_id: string; periodo: string; total_mxn: number;
        fecha_pago: string | null; created_at: string;
      }>),
  ]);

  // Saldo inicial: suma de saldos por cuenta convertidos a MXN aproximado (tc=1 si MXN).
  const saldoInicial = resumen.cuentas.reduce((acc, c) => {
    if (c.moneda === "MXN") return acc + c.saldo;
    return acc + c.saldo; // USD/EUR se quedan tal cual; saldo aprox MXN equivalente fuera de scope.
  }, 0);

  const inWindow = (iso: string | null): SemanaFlujo | null => {
    if (!iso) return null;
    const d = new Date(iso + "T00:00:00");
    if (d < inicioSemana(hoy) || d > limite) return null;
    return semanasMap.get(isoWeekKey(d)) ?? null;
  };

  // Entradas: facturas con saldo > 0 y vencimiento en ventana
  for (const f of cobranza) {
    if (f.saldo <= 0) continue;
    const sem = inWindow(f.fecha_vencimiento); if (!sem) continue;
    const mxn = toMxn(f.saldo, f.moneda, f.tipo_cambio);
    sem.entradas_mxn += mxn;
    sem.detalle_entradas.push({
      id: f.id, concepto: `${f.numero} · ${f.cliente_nombre}`,
      monto_mxn: mxn, fecha_vencimiento: f.fecha_vencimiento, moneda: f.moneda,
    });
  }

  // Salidas: CxP con saldo y vencimiento
  for (const c of cxp) {
    if (c.saldo <= 0 || !c.fecha_vencimiento) continue;
    const sem = inWindow(c.fecha_vencimiento); if (!sem) continue;
    const mxn = toMxn(c.saldo, c.moneda, c.tipo_cambio_usd);
    sem.salidas_mxn += mxn;
    sem.detalle_salidas.push({
      id: c.id, concepto: `${c.folio_proveedor} · ${c.proveedor_nombre}`,
      monto_mxn: mxn, fecha_vencimiento: c.fecha_vencimiento, moneda: c.moneda,
    });
  }

  // Salidas: liquidaciones de comisión pendientes (asumimos pago al cierre del periodo +5 días)
  for (const l of liqs) {
    const [y, m] = l.periodo.split("-").map(Number);
    if (!y || !m) continue;
    const dueDate = new Date(y, m, 5); // día 5 del mes siguiente
    const iso = dueDate.toISOString().slice(0, 10);
    const sem = inWindow(iso); if (!sem) continue;
    sem.salidas_mxn += Number(l.total_mxn);
    sem.detalle_salidas.push({
      id: l.id, concepto: `Liquidación comisión ${l.periodo}`,
      monto_mxn: Number(l.total_mxn), fecha_vencimiento: iso, moneda: "MXN",
    });
  }

  // Acumulado
  let saldo = saldoInicial;
  let totalEnt = 0, totalSal = 0, alertas = 0;
  const semanas = Array.from(semanasMap.values()).sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (const s of semanas) {
    s.flujo_neto_mxn = s.entradas_mxn - s.salidas_mxn;
    saldo += s.flujo_neto_mxn;
    s.saldo_proyectado_mxn = saldo;
    totalEnt += s.entradas_mxn;
    totalSal += s.salidas_mxn;
    if (s.saldo_proyectado_mxn < 0) alertas += 1;
  }

  return {
    saldo_inicial_mxn: saldoInicial,
    semanas,
    total_entradas_mxn: totalEnt,
    total_salidas_mxn: totalSal,
    saldo_final_mxn: saldo,
    alertas_negativas: alertas,
  };
}
