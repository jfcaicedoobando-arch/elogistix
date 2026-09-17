/**
 * Vinculación de un movimiento bancario con un pago (conciliación).
 *
 * Extraído de `conciliacion.ts` para respetar el límite de 200 líneas
 * (Power of 10).
 */
import { supabase } from "@/integrations/supabase/client";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { bitacoraConciliarMovimiento } from "./conciliacionBitacora";
import { mapConciliacionError, MovimientoVinculoError } from "./conciliacionErrors";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";
import {
  importeMovimiento,
  montosCuadran,
} from "@/features/tesoreria/domain/conciliacionMonto";
import { toleranciaMonto } from "@/features/tesoreria/domain/tolerancia";
import { formatCurrency } from "@/lib/formatters/numbers";

/**
 * N11: el importe del movimiento debe coincidir con el del pago. Se valida
 * antes del UPDATE para dar un mensaje claro; el disparador de base de datos
 * es la última línea de defensa.
 */
async function assertMontosCuadran(movId: string, tipo: "cxc" | "cxp", pagoId: string) {
  const [{ data: mov }, { data: pago }] = await Promise.all([
    supabase.from("bbva_movimientos").select("cargo, abono").eq("id", movId).maybeSingle(),
    supabase
      .from(tipo === "cxc" ? "pagos_factura" : "pagos_proveedor")
      .select("monto, moneda")
      .eq("id", pagoId)
      .maybeSingle(),
  ]);
  if (!mov || !pago) return;
  const montoMov = importeMovimiento(mov);
  const montoPago = Number(pago.monto ?? 0);
  // MNY P1.2: la tolerancia se toma de la moneda del pago (= la de la cuenta).
  if (montosCuadran(montoMov, montoPago, pago.moneda)) return;
  const tol = toleranciaMonto(pago.moneda);
  throw new MovimientoVinculoError(
    "LC_MOVIMIENTO_MONTO_MISMATCH",
    `El movimiento por ${formatCurrency(montoMov, pago.moneda)} no coincide con el pago por ${formatCurrency(montoPago, pago.moneda)} (tolerancia ${formatCurrency(tol, pago.moneda)}). Registra un pago por el importe real o corrige el movimiento.`,
  );
}

/**
 * N5 (v13.823.386): el sentido bancario debe coincidir con el tipo de pago.
 * Un cobro de cliente entra a la cuenta (abono) y un pago a proveedor sale
 * (cargo). Antes sólo se comparaba el importe absoluto, así que un cargo podía
 * conciliarse como cobro. El trigger de base de datos es la última defensa.
 */
async function assertSentidoCorrecto(movId: string, tipo: "cxc" | "cxp") {
  const { data: mov } = await supabase
    .from("bbva_movimientos")
    .select("cargo, abono")
    .eq("id", movId)
    .maybeSingle();
  if (!mov) return;
  const fila = (Array.isArray(mov) ? mov[0] : mov) as { cargo?: number | null; abono?: number | null } | undefined;
  if (!fila) return;
  const cargo = Number(fila.cargo ?? 0);
  const abono = Number(fila.abono ?? 0);
  if (tipo === "cxc" && (abono <= 0 || cargo !== 0)) {
    throw new MovimientoVinculoError(
      "LC_MOVIMIENTO_SENTIDO_COBRO",
      "Un cobro de cliente sólo se concilia con un depósito (abono) en la cuenta: este movimiento es un cargo (salida de dinero).",
    );
  }
  if (tipo === "cxp" && (cargo <= 0 || abono !== 0)) {
    throw new MovimientoVinculoError(
      "LC_MOVIMIENTO_SENTIDO_PAGO",
      "Un pago a proveedor sólo se concilia con un retiro (cargo) de la cuenta: este movimiento es un abono (entrada de dinero).",
    );
  }
}

export async function conciliarConPago(
  movId: string,
  tipo: "cxc" | "cxp",
  pagoId: string,
  userId: string | null,
) {
  // N15 (Ola 4): guard 409 previo — un pago sólo puede conciliarse con UN
  // movimiento vivo. El índice único parcial uq_bbva_movimientos_pago_* sigue
  // siendo la última línea de defensa ante una carrera de dos usuarios (su
  // 23505 ya se traduce en mapConciliacionError).
  const columnaPago = tipo === "cxc" ? "pago_factura_id" : "pago_proveedor_id";
  const { data: enUso } = await supabase
    .from("bbva_movimientos")
    .select("id")
    .eq(columnaPago, pagoId)
    .neq("id", movId)
    .is("deleted_at", null)
    .limit(1);
  if (enUso?.some((m) => m.id !== movId)) {
    throw new MovimientoVinculoError(
      "LC_MOVIMIENTO_YA_VINCULADO",
      "Este pago ya fue conciliado con otro movimiento bancario. Desconcilia ese movimiento antes de reasignar el pago.",
    );
  }
  await assertSentidoCorrecto(movId, tipo);
  await assertMontosCuadran(movId, tipo, pagoId);

  const patch = tipo === "cxc"
    ? { pago_factura_id: pagoId, pago_proveedor_id: null }
    : { pago_proveedor_id: pagoId, pago_factura_id: null };
  // H5 (Ola 4): bloqueo optimista — sólo se concilia un movimiento que siga
  // pendiente. Si otro usuario lo concilió o lo ignoró mientras el modal estaba
  // abierto, no se pisa su decisión: se avisa y se pide recargar.
  const { data: filas, error } = await supabase
    .from("bbva_movimientos")
    .update({
      ...patch,
      estado_conciliacion: "Conciliado",
      conciliado_por: userId,
      conciliado_at: new Date().toISOString(),
    })
    .eq("id", movId)
    .eq("estado_conciliacion", "Pendiente")
    .is("deleted_at", null)
    .select("id");
  if (!error && filas !== null && filas.length === 0) {
    throw conflictoConcurrenciaError();
  }
  if (error) {
    reportCaughtError(error, {
      feature: "tesoreria",
      op: "conciliacion.failed",
      tipo,
    }, { pgCode: error.code ?? "unknown", movId, pagoId });
    mapConciliacionError(error);
  }
  await bitacoraConciliarMovimiento(movId, tipo, pagoId);
}


