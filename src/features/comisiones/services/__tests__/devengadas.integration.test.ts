/**
 * B.3.4 — Integración Comisión Devengada → Liquidación (capa pura).
 *
 * Ejercita la composición real `calcularKPIsComisiones` sobre el ciclo
 * de vida completo de una comisión: Devengada → Liquidada → Cancelada,
 * mezclando meses, estados y casos límite. Sin Supabase.
 *
 * Refleja el flujo real:
 *   - "Devengada" suma a `pendiente_liquidar_mxn` (sin importar el mes).
 *   - El total del mes actual (devengado mensual) excluye "Cancelada".
 *   - "Liquidada" sólo cuenta como liquidado_mes si está en el mes actual.
 */
import { describe, expect, it } from "vitest";
import {
  calcularKPIsComisiones,
  type ComisionDevengada,
} from "@/features/comisiones/services/devengadas";
import { ymMx } from "@/lib/date/mx";

// El KPI usa el mes en zona América/Ciudad_de_México, no UTC: usamos el mismo
// helper para que la prueba no falle en las horas en que UTC y MX difieren de mes.
const MES_ACTUAL = ymMx();
const fechaEnMes = (yyyymm: string, dia = 15) => `${yyyymm}-${String(dia).padStart(2, "0")}T12:00:00Z`;

function comision(over: Partial<ComisionDevengada>): ComisionDevengada {
  return {
    id: "c",
    organization_id: "o",
    pago_factura_id: "p",
    embarque_id: null,
    factura_id: "f",
    vendedora_id: "v",
    vendedora_nombre: null,
    factura_numero: null,
    cliente_nombre: null,
    expediente: null,
    monto_cobrado_mxn: 0,
    utilidad_prorrateada_mxn: 0,
    porcentaje_aplicado: 0,
    comision_mxn: 0,
    estado: "Devengada",
    liquidacion_id: null,
    nota: null,
    created_at: fechaEnMes(MES_ACTUAL),
    ...over,
  };
}

describe("B.3.4 flujo Comisión devengada → Liquidación (KPIs)", () => {
  it("ciclo de vida completo entre meses", () => {
    // Buscamos el mes anterior al actual respetando la lógica YYYY-MM.
    const [y, m] = MES_ACTUAL.split("-").map(Number);
    const prevDate = new Date(Date.UTC(y, m - 2, 15));
    const MES_ANTERIOR = prevDate.toISOString().slice(0, 7);

    const items: ComisionDevengada[] = [
      // Devengadas del mes actual → suman a devengado_mes y pendiente.
      comision({ id: "a", comision_mxn: 500, estado: "Devengada" }),
      comision({ id: "b", comision_mxn: 300, estado: "Devengada" }),
      // Liquidada del mes actual → suma a devengado_mes y a liquidado_mes; NO a pendiente.
      comision({ id: "c", comision_mxn: 1000, estado: "Liquidada" }),
      // Liquidada del mes anterior → no suma a liquidado_mes ni a devengado_mes,
      // y como no está "Devengada" tampoco va a pendiente.
      comision({ id: "d", comision_mxn: 999, estado: "Liquidada", created_at: fechaEnMes(MES_ANTERIOR) }),
      // Devengada del mes anterior → pendiente sí, devengado_mes no.
      comision({ id: "e", comision_mxn: 200, estado: "Devengada", created_at: fechaEnMes(MES_ANTERIOR) }),
      // Cancelada del mes actual → no suma a ningún KPI.
      comision({ id: "f", comision_mxn: 9999, estado: "Cancelada" }),
    ];

    const k = calcularKPIsComisiones(items);
    expect(k.devengado_mes_mxn).toBe(1800); // 500 + 300 + 1000 (cancelada excluida)
    expect(k.pendiente_liquidar_mxn).toBe(1000); // 500 + 300 + 200
    expect(k.liquidado_mes_mxn).toBe(1000); // sólo "c"
  });

  it("lista vacía → KPIs en cero", () => {
    expect(calcularKPIsComisiones([])).toEqual({
      devengado_mes_mxn: 0,
      pendiente_liquidar_mxn: 0,
      liquidado_mes_mxn: 0,
      por_recuperar_mxn: 0,
    });
  });

  it("100% canceladas no contaminan ningún KPI", () => {
    const items = [
      comision({ id: "x", comision_mxn: 5000, estado: "Cancelada" }),
      comision({ id: "y", comision_mxn: 7000, estado: "Cancelada" }),
    ];
    expect(calcularKPIsComisiones(items)).toEqual({
      devengado_mes_mxn: 0,
      pendiente_liquidar_mxn: 0,
      liquidado_mes_mxn: 0,
      por_recuperar_mxn: 0,
    });
  });

  it("transición Devengada → Liquidada: pendiente baja al liquidar", () => {
    const antes = calcularKPIsComisiones([comision({ id: "t", comision_mxn: 800, estado: "Devengada" })]);
    expect(antes.pendiente_liquidar_mxn).toBe(800);
    expect(antes.liquidado_mes_mxn).toBe(0);

    const despues = calcularKPIsComisiones([comision({ id: "t", comision_mxn: 800, estado: "Liquidada" })]);
    expect(despues.pendiente_liquidar_mxn).toBe(0);
    expect(despues.liquidado_mes_mxn).toBe(800);
    // Devengado del mes incluye ambos estados (no canceladas).
    expect(despues.devengado_mes_mxn).toBe(800);
  });
});
