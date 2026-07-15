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

export interface AlertasInput {
  flujo: FlujoProyectado;
  tesoreria: ResumenTesoreria;
  presupuesto: ResumenVsReal;
  umbralCarteraVencida?: number;
}

const UMBRAL_CARTERA_DEFAULT = 50_000;

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

  // B2 fix (v13.300.49): conteo sobre el universo completo de deudores
  // vencidos (`cartera_vencida_count`), no sobre el Top-5.
  const deudoresVencidosCount = input.tesoreria.cartera_vencida_count;
  if (deudoresVencidosCount > 0 && input.tesoreria.cartera_vencida_total_mxn >= umbral) {
    const top = input.tesoreria.top_deudores[0];
    alertas.push({
      id: "cartera-vencida-alta",
      severidad: "warning",
      titulo: `${deudoresVencidosCount} cliente(s) con cartera vencida`,
      descripcion: top
        ? `Top: ${top.nombre} (${top.saldo.toFixed(0)} ${top.moneda})`
        : "Ver detalle en Facturación",
      url: "/facturacion",
    });
  }

  // CxP vencidas — conteo sobre universo completo (B2 fix).
  const acreedoresVencidosCount = input.tesoreria.cxp_vencidas_count;
  if (acreedoresVencidosCount > 0) {
    const top = input.tesoreria.top_acreedores[0];
    alertas.push({
      id: "cxp-vencidas",
      severidad: "warning",
      titulo: `${acreedoresVencidosCount} proveedor(es) con pagos vencidos`,
      descripcion: top
        ? `Top: ${top.nombre} (${top.saldo.toFixed(0)} ${top.moneda})`
        : "Ver detalle en Compras",
      url: "/compras/facturas",
    });
  }

  // C2 fix (v13.300.49): consumir `categorias_en_exceso` y `top_exceso` que
  // ya calculó el servicio `fetchPresupuestoVsReal`, en vez de recalcular
  // el mismo filtro con lógica potencialmente desincronizada.
  const fueraDePresupuestoCount = input.presupuesto.categorias_en_exceso;
  const topExceso = input.presupuesto.top_exceso;
  if (fueraDePresupuestoCount > 0 && topExceso.length > 0) {
    const peor = topExceso[0];
    const critico = fueraDePresupuestoCount >= 3 || peor.cumplimiento_pct >= 200;
    alertas.push({
      id: "presupuesto-exceso-categoria",
      severidad: critico ? "critica" : "warning",
      titulo:
        fueraDePresupuestoCount === 1
          ? `Categoría "${peor.categoria_nombre}" excedida`
          : `${fueraDePresupuestoCount} categorías excedidas`,
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

  // A1 fix (v13.300.49): `saldo_bancos_mxn` viene ya convertido a MXN
  // desde el servicio de tesorería (antes se sumaba `c.saldo` directo,
  // mezclando USD y MXN indistintamente).
  const saldoBancos = snapshot.tesoreria.saldo_bancos_mxn;

  // B1 fix (v13.300.49): usar el conteo/monto sobre el universo completo
  // (no sobre el Top-5 truncado). El desglose por antigüedad (>30d) se
  // sacrifica porque no se conserva en el dataset agregado; el filtro por
  // "vencida" a nivel factura ya captura el 100% de exposición vencida.
  const carteraVencida = snapshot.tesoreria.cartera_vencida_total_mxn;
  const carteraVencidaCount = snapshot.tesoreria.cartera_vencida_count;

  const cxp7d = snapshot.flujo.semanas[0]?.salidas_mxn ?? 0;

  const totalPresup = snapshot.presupuesto.total_presupuesto_mxn;
  const totalReal = snapshot.presupuesto.total_real_mxn;
  const cumplimiento = totalPresup > 0 ? (totalReal / totalPresup) * 100 : 0;

  // C2 fix (v13.300.49): usar el conteo ya calculado por el servicio.
  const categoriasEnExceso = snapshot.presupuesto.categorias_en_exceso;

  // A2 fix (v13.300.49): DSO/DPO consideran también la porción USD
  // (convertida a MXN por el servicio de tesorería).
  const cxc30d = snapshot.tesoreria.flujo.por_cobrar_total_mxn;
  const cxp30d = snapshot.tesoreria.flujo.por_pagar_total_mxn;
  const costos = eerr.totalCostos.total;
  const dsoDias: number | null = ingresos > 0 ? (cxc30d / ingresos) * 30 : null;
  const dpoDias: number | null = costos > 0 ? (cxp30d / costos) * 30 : null;
  const burnMensual = costos - ingresos;
  // C4 fix (v13.300.49): si `saldoBancos <= 0` la empresa ya está sin caja
  // → devolvemos `0` (la UI muestra "Saldo bancario negativo"). Antes el
  // resultado era `null` (mismo mensaje que "sin burn"), engañosamente
  // tranquilizador.
  let runwayMeses: number | null;
  if (burnMensual <= 0) runwayMeses = null; // sin burn (utilidad ≥ 0)
  else if (saldoBancos <= 0) runwayMeses = 0; // caja agotada
  else runwayMeses = saldoBancos / burnMensual;

  return {
    ingresos_mxn: ingresos,
    ingresos_delta_pct: ingresosDelta,
    utilidad_mxn: utilidad,
    utilidad_delta_pct: utilidadDelta,
    margen_pct: margen,
    margen_delta_puntos: margenDelta,
    saldo_bancos_mxn: saldoBancos,
    cartera_vencida_mxn: carteraVencida,
    cartera_vencida_count: carteraVencidaCount,
    cxp_7dias_mxn: cxp7d,
    cumplimiento_presupuesto_pct: cumplimiento,
    categorias_en_exceso: categoriasEnExceso,
    dso_dias: dsoDias,
    dpo_dias: dpoDias,
    runway_meses: runwayMeses,
  };
}
