import { describe, it, expect } from "vitest";
import {
  presupuestoDelMes,
  coberturaPonderada,
  contarPorEstado,
  ordenarPorUrgencia,
} from "@/features/crm/domain/higieneMetas";
import type { HigieneOportunidad } from "@/features/crm/services/higiene";

function op(over: Partial<HigieneOportunidad>): HigieneOportunidad {
  return {
    id: "1",
    nombre: "Op",
    cliente_nombre: null,
    etapa_id: "e1",
    etapa_nombre: "Contacto",
    vendedor_email: null,
    monto_estimado: 0,
    moneda: "MXN",
    probabilidad: 10,
    fecha_estimada_cierre: null,
    ultimo_movimiento_at: "2026-08-01T00:00:00Z",
    dias_sin_movimiento: 1,
    sla_dias: 7,
    estado_higiene: "en_tiempo",
    registro_completo: true,
    proxima_actividad_at: null,
    actividad_vencida: false,
    ...over,
  };
}

describe("higiene y cobertura", () => {
  it("lee el presupuesto del mes con su moneda o 0 MXN", () => {
    const filas = [
      { id: "a", anio: 2026, mes: 8, monto: 500000, moneda: "MXN" as const },
      { id: "b", anio: 2026, mes: 9, monto: 30000, moneda: "USD" as const },
    ];
    expect(presupuestoDelMes(filas, 8)).toEqual({ monto: 500000, moneda: "MXN" });
    expect(presupuestoDelMes(filas, 9)).toEqual({ monto: 30000, moneda: "USD" });
    expect(presupuestoDelMes(filas, 10)).toEqual({ monto: 0, moneda: "MXN" });
    expect(presupuestoDelMes(undefined, 8)).toEqual({ monto: 0, moneda: "MXN" });
  });

  it("no divide entre cero al calcular cobertura", () => {
    expect(coberturaPonderada(250000, { monto: 0, moneda: "MXN" })).toBeNull();
    expect(coberturaPonderada(250000, { monto: 500000, moneda: "MXN" })).toBe(0.5);
  });

  it("no calcula cobertura si el presupuesto no es MXN (pipeline viene en MXN)", () => {
    expect(coberturaPonderada(250000, { monto: 30000, moneda: "USD" })).toBeNull();
    expect(coberturaPonderada(250000, { monto: 30000, moneda: "EUR" })).toBeNull();
  });

  it("cuenta por semáforo", () => {
    const filas = [
      op({ id: "1", estado_higiene: "vencida" }),
      op({ id: "2", estado_higiene: "vencida" }),
      op({ id: "3", estado_higiene: "por_vencer" }),
    ];
    expect(contarPorEstado(filas)).toEqual({ en_tiempo: 0, por_vencer: 1, vencida: 2 });
  });

  it("ordena vencidas primero y por mayor retraso", () => {
    const filas = [
      op({ id: "a", estado_higiene: "en_tiempo", dias_sin_movimiento: 2 }),
      op({ id: "b", estado_higiene: "vencida", dias_sin_movimiento: 9 }),
      op({ id: "c", estado_higiene: "vencida", dias_sin_movimiento: 20 }),
    ];
    expect(ordenarPorUrgencia(filas).map((f) => f.id)).toEqual(["c", "b", "a"]);
  });
});
