/** Quitar vínculo / cambio de puerto: limpia heredados, respeta ediciones manuales y costos. */
import { describe, it, expect } from "vitest";
import { aplicarSeleccionPuerto, desvincularTarifa } from "../rutaPuertoHandlers";
import { marcarOverride, type Ctx } from "../overrideHelpers";

function fakeCtx(init: Record<string, unknown>): { ctx: Ctx; s: Record<string, unknown> } {
  const s: Record<string, unknown> = { ...init };
  const ctx = {
    getValues: (k: string) => s[k],
    setValue: (k: string, v: unknown) => { s[k] = v; },
  } as unknown as Ctx;
  return { ctx, s };
}

const costos = [{ concepto: "Maniobras", costo_unitario: 500 }];
const conTarifa = () => fakeCtx({
  tarifaId: "t1", tarifaOverride: {}, rutaTexto: "Ningbo → Manzanillo", tiempoTransitoDias: 28,
  frecuencia: "Semanal", diasLibresDestino: 14, diasAlmacenaje: 5, cartaGarantia: true,
  agenteId: "a1", agenteNombre: "Agente", navieraId: "n1", navieraNombre: "Maersk",
  origen: "Ningbo", puertoOrigenId: "p1", costosLocales: costos,
});

describe("desvincularTarifa", () => {
  it("Quitar limpia heredados y derivados, conserva costos", () => {
    const { ctx, s } = conTarifa();
    desvincularTarifa(ctx);
    expect(s).toMatchObject({ tarifaId: null, tarifaOverride: {}, rutaTexto: "", tiempoTransitoDias: undefined,
      frecuencia: "", diasLibresDestino: 0, diasAlmacenaje: 0, cartaGarantia: false,
      agenteId: null, navieraId: null, navieraNombre: "" });
    expect(s.costosLocales).toBe(costos);
  });
  it("rutaTexto editada a mano sobrevive a Quitar", () => {
    const { ctx, s } = conTarifa();
    s.rutaTexto = "Ningbo → Busan → Manzanillo";
    marcarOverride(ctx, "rutaTexto");
    desvincularTarifa(ctx);
    expect(s.rutaTexto).toBe("Ningbo → Busan → Manzanillo");
    expect(s.frecuencia).toBe("");
  });
  it("rutaTexto editada a mano sobrevive a cambio de puerto", () => {
    const { ctx, s } = conTarifa();
    s.rutaTexto = "Manual";
    marcarOverride(ctx, "rutaTexto");
    expect(aplicarSeleccionPuerto(ctx, "origen", "Shanghai", "p2").tarifaDesvinculada).toBe(true);
    expect(s.rutaTexto).toBe("Manual");
  });
  it("sin edición, cambio de puerto limpia la ruta y deja costos", () => {
    const { ctx, s } = conTarifa();
    aplicarSeleccionPuerto(ctx, "origen", "Shanghai", "p2");
    expect(s.rutaTexto).toBe("");
    expect(s.tarifaId).toBeNull();
    expect(s.costosLocales).toBe(costos);
  });
});
