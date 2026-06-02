/**
 * Resumen ejecutivo de Tesorería: saldos por cuenta + KPIs CxC/CxP +
 * flujo esperado 30 días + top 5 clientes/proveedores.
 *
 * Cálculo de saldo en banco:
 *   saldo = saldo_inicial + Σ(abonos) − Σ(cargos) sobre cuenta.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchCobranza } from "@/services/facturas/cobranza";
import { fetchFacturasCxP } from "@/services/cxp/proveedorFacturas";

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

export interface TopItem { nombre: string; saldo: number; moneda: string; dias?: number }

export interface ResumenTesoreria {
  cuentas: ResumenCuenta[];
  flujo: FlujoMes;
  top_deudores: TopItem[];
  top_acreedores: TopItem[];
}

async function calcularSaldoCuenta(cuentaId: string, saldoInicial: number): Promise<number> {
  const { data, error } = await supabase
    .from("bbva_movimientos")
    .select("cargo, abono")
    .eq("cuenta_bancaria_id", cuentaId);
  if (error) throw error;
  let s = saldoInicial;
  for (const m of data ?? []) {
    s += Number(m.abono) - Number(m.cargo);
  }
  return s;
}

export async function fetchResumenTesoreria(): Promise<ResumenTesoreria> {
  const { data: cuentas } = await supabase
    .from("cuentas_bancarias")
    .select("id, alias, banco, moneda, saldo_inicial")
    .eq("activa", true)
    .order("alias");

  const cuentasRes: ResumenCuenta[] = [];
  for (const c of cuentas ?? []) {
    const saldo = await calcularSaldoCuenta(c.id, Number(c.saldo_inicial));
    cuentasRes.push({ id: c.id, alias: c.alias, banco: c.banco, moneda: c.moneda, saldo });
  }

  const [cobranza, cxp] = await Promise.all([fetchCobranza({}), fetchFacturasCxP({})]);

  // Flujo: CxC con vencimiento en próximos 30 días vs CxP igual ventana.
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy); limite.setDate(limite.getDate() + 30);
  const enVentana = (iso: string | null) =>
    !!iso && new Date(iso + "T00:00:00") <= limite;

  const flujo: FlujoMes = {
    por_cobrar_mxn: 0, por_cobrar_usd: 0,
    por_pagar_mxn: 0, por_pagar_usd: 0,
    flujo_neto_mxn: 0, flujo_neto_usd: 0,
  };
  for (const f of cobranza) {
    if (!enVentana(f.fecha_vencimiento) || f.saldo <= 0) continue;
    if (f.moneda === "USD") flujo.por_cobrar_usd += f.saldo;
    else flujo.por_cobrar_mxn += f.saldo;
  }
  for (const f of cxp) {
    if (!enVentana(f.fecha_vencimiento) || f.saldo <= 0) continue;
    if (f.moneda === "USD") flujo.por_pagar_usd += f.saldo;
    else flujo.por_pagar_mxn += f.saldo;
  }
  flujo.flujo_neto_mxn = flujo.por_cobrar_mxn - flujo.por_pagar_mxn;
  flujo.flujo_neto_usd = flujo.por_cobrar_usd - flujo.por_pagar_usd;

  const top_deudores = cobranza
    .filter((f) => f.saldo > 0 && f.estatus_cobranza === "Vencida")
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 5)
    .map((f) => ({ nombre: f.cliente_nombre, saldo: f.saldo, moneda: f.moneda, dias: f.dias_vencido }));

  const top_acreedores = cxp
    .filter((f) => f.saldo > 0 && (f.estatus === "Por vencer" || f.estatus === "Vencida"))
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 5)
    .map((f) => ({ nombre: f.proveedor_nombre, saldo: f.saldo, moneda: f.moneda, dias: f.dias_vencido }));

  return { cuentas: cuentasRes, flujo, top_deudores, top_acreedores };
}
