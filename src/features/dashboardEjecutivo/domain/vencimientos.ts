import type { CobranzaRow, CxpRow, TasasCambio, TopItem } from "@/features/tesoreria/domain";
import { diasVencidos, formatDateOnlyLocal, parseDateOnlyLocal } from "@/lib/date/dateOnly";
import { todayLocalISO } from "@/lib/date/today";
import { esCxcVencida } from "@/lib/domain/vencimiento";
import { aMxn } from "@/lib/financial/convertir";
import { roundMoney } from "@/lib/financial/financialUtils";

export interface ResumenVencimientos {
  total_mxn: number;
  count: number;
  top: TopItem[];
  excluido_por_moneda: Record<string, number>;
}

export interface VencimientosEjecutivos {
  fechaReferencia: string;
  cobranzaMayor30: ResumenVencimientos;
  cxpProximos7: ResumenVencimientos;
}

interface SaldoVencimiento {
  nombre: string;
  saldo: number;
  moneda: string;
  /** Convención canónica: positivo = vencido, negativo = por vencer. */
  dias: number;
}

function resumir(rows: SaldoVencimiento[], tasas: TasasCambio): ResumenVencimientos {
  const grupos = new Map<string, TopItem>();
  const nombres = new Set<string>();
  const excluido_por_moneda: Record<string, number> = {};
  let total_mxn = 0;
  for (const row of rows) {
    const moneda = (row.moneda || "MXN").toUpperCase();
    const tc = moneda === "USD" ? tasas.usdMxn : moneda === "EUR" ? tasas.eurMxn : undefined;
    const conversion = aMxn(row.saldo, moneda, tc);
    if (conversion.completo) total_mxn += conversion.monto;
    else excluido_por_moneda[moneda] = (excluido_por_moneda[moneda] ?? 0) + row.saldo;
    nombres.add(row.nombre);
    const key = `${row.nombre}||${moneda}`;
    const prev = grupos.get(key);
    grupos.set(key, {
      nombre: row.nombre, moneda, saldo: (prev?.saldo ?? 0) + row.saldo,
      dias: Math.max(prev?.dias ?? row.dias, row.dias),
    });
  }
  return {
    total_mxn: roundMoney(total_mxn), count: nombres.size, excluido_por_moneda,
    top: [...grupos.values()].sort((a, b) => b.saldo - a.saldo).slice(0, 5),
  };
}

/** KPI y drill-down comparten la misma ventana, independiente de semanas del flujo. */
export function calcularVencimientosEjecutivos(args: {
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
  tasas?: TasasCambio;
  hoy?: Date;
}): VencimientosEjecutivos {
  const hoy = args.hoy ?? parseDateOnlyLocal(todayLocalISO());
  const deuda: SaldoVencimiento[] = [];
  const porVencer: SaldoVencimiento[] = [];
  for (const row of args.cobranza) {
    const dias = row.fecha_vencimiento ? diasVencidos(row.fecha_vencimiento, hoy) : row.dias_vencido;
    if (!esCxcVencida({ ...row, dias_vencido: dias }) || dias == null || !Number.isFinite(dias) || dias <= 30) continue;
    deuda.push({ nombre: row.cliente_nombre, saldo: row.saldo, moneda: row.moneda, dias });
  }
  for (const row of args.cxp) {
    if (row.saldo <= 0 || !row.fecha_vencimiento) continue;
    const dias = diasVencidos(row.fecha_vencimiento, hoy);
    // Vencimientos reales: hoy hasta hoy + 7, inclusive. No pagos programados ni vencidos.
    if (!Number.isFinite(dias) || dias > 0 || dias < -7) continue;
    porVencer.push({ nombre: row.proveedor_nombre, saldo: row.saldo, moneda: row.moneda, dias });
  }
  return {
    fechaReferencia: formatDateOnlyLocal(hoy),
    cobranzaMayor30: resumir(deuda, args.tasas ?? {}),
    cxpProximos7: resumir(porVencer, args.tasas ?? {}),
  };
}
