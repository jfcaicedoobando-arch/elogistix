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
const UMBRAL_VARIACION_PRESUPUESTO = 110;

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

  // Categoría de presupuesto con variación >110%
  const fueraDePresupuesto = input.presupuesto.filas.filter(
    (f) => f.presupuesto_mxn > 0 && f.cumplimiento_pct > UMBRAL_VARIACION_PRESUPUESTO,
  );
  if (fueraDePresupuesto.length > 0) {
    const peor = fueraDePresupuesto.sort((a, b) => b.cumplimiento_pct - a.cumplimiento_pct)[0];
    alertas.push({
      id: `presupuesto-${peor.categoria_id}`,
      severidad: "warning",
      titulo: `Categoría "${peor.categoria_nombre}" excedida`,
      descripcion: `Cumplimiento ${peor.cumplimiento_pct.toFixed(0)}% del presupuesto`,
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
  const delta = ingresosPrevios > 0 ? ((ingresos - ingresosPrevios) / ingresosPrevios) * 100 : 0;

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

  // Próximos 7 días de CxP usando primera semana del flujo
  const cxp7d = snapshot.flujo.semanas[0]?.salidas_mxn ?? 0;

  const totalPresup = snapshot.presupuesto.total_presupuesto_mxn;
  const totalReal = snapshot.presupuesto.total_real_mxn;
  const cumplimiento = totalPresup > 0 ? (totalReal / totalPresup) * 100 : 0;

  return {
    ingresos_mxn: ingresos,
    ingresos_delta_pct: delta,
    utilidad_mxn: utilidad,
    utilidad_delta_pct: utilidadDelta,
    margen_pct: margen,
    margen_delta_puntos: margenDelta,
    saldo_bancos_mxn: saldoBancos,
    cartera_vencida_mxn: carteraVencida,
    cartera_vencida_count: deudoresVencidos.length,
    cxp_7dias_mxn: cxp7d,
    cumplimiento_presupuesto_pct: cumplimiento,
  };
}
