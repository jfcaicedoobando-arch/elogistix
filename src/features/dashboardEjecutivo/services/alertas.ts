/**
 * Reglas deterministas de alertas ejecutivas. Función pura, sin I/O.
 */
import type {
  AlertaEjecutiva,
  SnapshotEjecutivo,
} from "./types";
import type { FlujoProyectado } from "@/features/tesoreria/services";
import type { ResumenTesoreria } from "@/features/tesoreria/services";
import type { ResumenVsReal } from "@/features/presupuesto/services";
import { UMBRAL_SOBREEJERCICIO_PCT } from "@/features/presupuesto/constants";

export interface AlertasInput {
  flujo: FlujoProyectado;
  tesoreria: ResumenTesoreria;
  presupuesto: ResumenVsReal;
  umbralCarteraVencida?: number;
}

const UMBRAL_CARTERA_DEFAULT = 50_000;
const UMBRAL_VARIACION_PRESUPUESTO = UMBRAL_SOBREEJERCICIO_PCT;

export function calcularAlertas(input: AlertasInput): AlertaEjecutiva[] {
  const alertas: AlertaEjecutiva[] = [];
  const umbral = input.umbralCarteraVencida ?? UMBRAL_CARTERA_DEFAULT;

  // Saldo bancario proyectado < 0 en próximas semanas
  const semanasNegativas = input.flujo.semanas.filter((s) => s.saldo_proyectado_mxn < 0);
  if (semanasNegativas.length > 0) {
    const primera = semanasNegativas[0];
    alertas.push({
      id: `flujo-negativo-${primera.semana_iso}`,
      severidad: "critica",
      titulo: "Saldo proyectado negativo",
      descripcion: `Semana ${primera.semana_iso}: saldo estimado ${primera.saldo_proyectado_mxn.toFixed(0)} MXN`,
      url: "/tesoreria/flujo",
    });
  }

  // Top deudores con saldo >umbral
  const deudoresAltos = input.tesoreria.top_deudores.filter(
    (d) => d.saldo >= umbral && (d.dias ?? 0) > 30,
  );
  if (deudoresAltos.length > 0) {
    alertas.push({
      id: "cartera-vencida-alta",
      severidad: "warning",
      titulo: `${deudoresAltos.length} cliente(s) con cartera vencida >30 días`,
      descripcion: `Top: ${deudoresAltos[0].nombre} (${deudoresAltos[0].saldo.toFixed(0)} ${deudoresAltos[0].moneda})`,
      url: "/facturacion",
    });
  }

  // CxP vencidas
  const acreedoresVencidos = input.tesoreria.top_acreedores.filter(
    (a) => (a.dias ?? 0) > 0,
  );
  if (acreedoresVencidos.length > 0) {
    alertas.push({
      id: "cxp-vencidas",
      severidad: "warning",
      titulo: `${acreedoresVencidos.length} proveedor(es) con pagos vencidos`,
      descripcion: `Top: ${acreedoresVencidos[0].nombre} (${acreedoresVencidos[0].saldo.toFixed(0)} ${acreedoresVencidos[0].moneda})`,
      url: "/compras/facturas",
    });
  }

  // Fase J: categorías con cumplimiento >110% del presupuesto. Antes se
  // emitía una alerta por la "peor" categoría; ahora se agrega una única alerta
  // consolidada con severidad escalada por cantidad/gravedad para reflejar
  // riesgo real de sobreejercicio.
  const fueraDePresupuesto = input.presupuesto.filas.filter(
    (f) => f.presupuesto_mxn > 0 && f.cumplimiento_pct > UMBRAL_VARIACION_PRESUPUESTO,
  );
  if (fueraDePresupuesto.length > 0) {
    const ordenadas = [...fueraDePresupuesto].sort((a, b) => b.cumplimiento_pct - a.cumplimiento_pct);
    const peor = ordenadas[0];
    const critico = fueraDePresupuesto.length >= 3 || peor.cumplimiento_pct >= 200;
    alertas.push({
      id: "presupuesto-exceso-categoria",
      severidad: critico ? "critica" : "warning",
      titulo:
        fueraDePresupuesto.length === 1
          ? `Categoría "${peor.categoria_nombre}" excedida`
          : `${fueraDePresupuesto.length} categorías excedidas`,
      descripcion: `Peor: ${peor.categoria_nombre} al ${peor.cumplimiento_pct.toFixed(0)}%`,
      url: "/profit/presupuesto",
    });
  }

  return alertas;
}

export function calcularKPIsEjecutivos(
  snapshot: Omit<SnapshotEjecutivo, "kpis" | "alertas" | "topDeudores" | "topAcreedores" | "generadoEn">,
  ingresosPrevios: number,
  eerrPrevio?: SnapshotEjecutivo["eerrPeriodo"],
): SnapshotEjecutivo["kpis"] {
  const eerr = snapshot.eerrPeriodo;
  const ingresos = eerr.totalIngresos.total;
  const utilidad = eerr.utilidad.total;
  const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;

  // Fase I fix #2: `null` cuando el mes previo tiene ingresos = 0 — antes
  // devolvíamos `0` y la UI mostraba "Sin cambio" indistinguible de "no había
  // dato". Ahora `formatDelta` puede pintar "sin comparable previo".
  const ingresosDelta: number | null = ingresosPrevios > 0
    ? ((ingresos - ingresosPrevios) / ingresosPrevios) * 100
    : null;

  // Variación de utilidad y margen vs. mes anterior (Fase I).
  // Convención: `null` cuando el mes previo es 0 (evita `Infinity`) o negativo
  // (comparar contra pérdidas no aporta señal accionable en la UI).
  let utilidadDelta: number | null = null;
  let margenDelta: number | null = null;
  if (eerrPrevio) {
    const utilPrev = eerrPrevio.utilidad.total;
    const ingPrev = eerrPrevio.totalIngresos.total;
    if (utilPrev > 0) {
      utilidadDelta = ((utilidad - utilPrev) / utilPrev) * 100;
    }
    if (ingPrev > 0) {
      const margenPrev = (utilPrev / ingPrev) * 100;
      margenDelta = margen - margenPrev;
    }
  }

  const saldoBancos = snapshot.tesoreria.cuentas.reduce((acc, c) => acc + c.saldo, 0);

  // Cartera vencida: sólo deudores con >30 días — alineado con la alerta
  // "cartera-vencida-alta" (antes se sumaba TODA la cartera y no cuadraba).
  const deudoresVencidos = snapshot.tesoreria.top_deudores.filter(
    (d) => (d.dias ?? 0) > 30,
  );
  const carteraVencida = deudoresVencidos.reduce((acc, d) => acc + d.saldo, 0);

  const cxp7d = snapshot.flujo.semanas[0]?.salidas_mxn ?? 0;

  const totalPresup = snapshot.presupuesto.total_presupuesto_mxn;
  const totalReal = snapshot.presupuesto.total_real_mxn;
  const cumplimiento = totalPresup > 0 ? (totalReal / totalPresup) * 100 : 0;

  // Fase J: conteo de categorías en exceso (>110% del cumplimiento).
  const categoriasEnExceso = snapshot.presupuesto.filas.filter(
    (f) => f.presupuesto_mxn > 0 && f.cumplimiento_pct > UMBRAL_VARIACION_PRESUPUESTO,
  ).length;

  // Fase 4 UI/UX: KPIs financieros derivados.
  const cxc30d = snapshot.tesoreria.flujo.por_cobrar_mxn;
  const cxp30d = snapshot.tesoreria.flujo.por_pagar_mxn;
  const costos = eerr.totalCostos.total;
  const dsoDias: number | null = ingresos > 0 ? (cxc30d / ingresos) * 30 : null;
  const dpoDias: number | null = costos > 0 ? (cxp30d / costos) * 30 : null;
  const burnMensual = costos - ingresos;
  const runwayMeses: number | null =
    burnMensual > 0 && saldoBancos > 0 ? saldoBancos / burnMensual : null;

  return {
    ingresos_mxn: ingresos,
    ingresos_delta_pct: ingresosDelta,
    utilidad_mxn: utilidad,
    utilidad_delta_pct: utilidadDelta,
    margen_pct: margen,
    margen_delta_puntos: margenDelta,
    saldo_bancos_mxn: saldoBancos,
    cartera_vencida_mxn: carteraVencida,
    cartera_vencida_count: deudoresVencidos.length,
    cxp_7dias_mxn: cxp7d,
    cumplimiento_presupuesto_pct: cumplimiento,
    categorias_en_exceso: categoriasEnExceso,
    dso_dias: dsoDias,
    dpo_dias: dpoDias,
    runway_meses: runwayMeses,
  };
}
