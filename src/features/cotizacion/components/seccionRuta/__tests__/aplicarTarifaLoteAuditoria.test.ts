/**
 * P1-1 / P2-6 — puertos coherentes y limpieza de heredados al cambiar de puerto.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: vi.fn() }, from: vi.fn() } }));
import { aplicarTarifaAlForm } from "@/features/cotizacion/hooks/wizard/aplicarTarifaAlForm";
import { aplicarSeleccionPuerto } from "../rutaPuertoHandlers";
import type { TopTarifaRow } from "@/features/costeo/types";

const tarifa = (id: string, o: Partial<TopTarifaRow> = {}) => ({
  id, flete_base: 3200, naviera_nombre: "Maersk", tipo_contenedor_nombre: "40HC",
  puerto_origen_id: "p-ngb", puerto_origen_nombre: "Ningbo", puerto_origen_country: "China", puerto_origen_code: "CNNGB",
  puerto_destino_id: "p-zlo", puerto_destino_nombre: "Manzanillo", puerto_destino_country: "México", puerto_destino_code: "MXZLO",
  ...o,
}) as unknown as TopTarifaRow;

function formFake(inicial: Record<string, unknown> = {}) {
  const valores: Record<string, unknown> = { ...inicial };
  const setValue = vi.fn((k: string, v: unknown) => { valores[k] = v; });
  return { valores, setValue, trigger: vi.fn().mockResolvedValue(true), getValues: (k: string) => valores[k] };
}

describe("P1-1 · texto de puertos sale de la misma tarifa", () => {
  it("ruta previa diferente (Shanghai) queda en Ningbo con su ID", () => {
    const f = formFake({ origen: "Shanghai, China (CNSHA)", puertoOrigenId: "p-sha" });
    aplicarTarifaAlForm(f.setValue as never, f.trigger as never, tarifa("t1"));
    expect(f.valores.origen).toBe("Ningbo, China (CNNGB)");
    expect(f.valores.puertoOrigenId).toBe("p-ngb");
    expect(f.valores.destino).toBe("Manzanillo, México (MXZLO)");
  });

  it("ruta vacía se llena desde la tarifa", () => {
    const f = formFake({ origen: "", destino: "" });
    aplicarTarifaAlForm(f.setValue as never, f.trigger as never, tarifa("t1"));
    expect(f.valores.origen).toBe("Ningbo, China (CNNGB)");
    expect(f.valores.puertoDestinoId).toBe("p-zlo");
  });

  it("puerto homónimo: el texto lleva el UN/LOCODE del ID de la tarifa", () => {
    const f = formFake({ destino: "Manzanillo, México (MXZLO)", puertoDestinoId: "p-zlo" });
    aplicarTarifaAlForm(f.setValue as never, f.trigger as never, tarifa("t2", {
      puerto_destino_id: "p-pam", puerto_destino_country: "Panamá", puerto_destino_code: "PAMIT",
    }));
    expect(f.valores.destino).toBe("Manzanillo, Panamá (PAMIT)");
    expect(f.valores.puertoDestinoId).toBe("p-pam");
  });
});

describe("P2-6 · cambiar de puerto limpia sólo lo heredado", () => {
  it("borra rutaTexto y heredados sin override; conserva overrides manuales", () => {
    const f = formFake({
      tarifaId: "A", puertoOrigenId: "p-ngb", rutaTexto: "Ningbo → Manzanillo",
      tiempoTransitoDias: 30, frecuencia: "Semanal", tarifaOverride: { tiempoTransitoDias: true },
    });
    const r = aplicarSeleccionPuerto(f as never, "origen", "Shanghai, China (CNSHA)", "p-sha");
    expect(r.tarifaDesvinculada).toBe(true);
    expect(f.valores.rutaTexto).toBe("");
    expect(f.valores.frecuencia).toBe("");
    expect(f.valores.tiempoTransitoDias).toBe(30);
    expect(f.valores.tarifaId).toBeNull();
  });
});
