/**
 * P1-1 / P1-2 / P1-3 / P2-6 — aplicar tarifa: puertos coherentes, carreras,
 * fallo de recargos y limpieza de heredados al cambiar de puerto.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: vi.fn() }, from: vi.fn() } }));
const fetchRecargosDeTarifa = vi.fn();
vi.mock("@/features/costeo/services/topTarifas", () => ({
  fetchRecargosDeTarifa: (...a: unknown[]) => fetchRecargosDeTarifa(...a),
}));
const notifyError = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: (...a: unknown[]) => notifyError(...a) }));

import { aplicarTarifaAlForm, cancelarAutocargaTarifa } from "../aplicarTarifa";
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

function diferido<T>() {
  let resolve!: (v: T) => void; let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const recargo = (tarifaId: string) => [{ id: `r-${tarifaId}`, tarifa_id: tarifaId, concepto: "BAF", lado: "origen", monto: 100, moneda: "USD", incluido_en_total: true }];

beforeEach(() => vi.clearAllMocks());

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

describe("P1-2 · carrera al cambiar tarifa", () => {
  it("A tardía no pisa los costos de B", async () => {
    const f = formFake();
    const a = diferido<unknown>(); const b = diferido<unknown>();
    fetchRecargosDeTarifa.mockImplementation((id: string) => (id === "A" ? a.promise : b.promise));
    const cb = vi.fn();
    aplicarTarifaAlForm(f.setValue as never, f.trigger as never, tarifa("A"), { onAutocargaCostos: cb });
    aplicarTarifaAlForm(f.setValue as never, f.trigger as never, tarifa("B"), { onAutocargaCostos: cb });
    b.resolve(recargo("B")); await b.promise;
    a.resolve(recargo("A")); await a.promise; await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].every((x: { costeo_tarifa_id: string }) => x.costeo_tarifa_id === "B")).toBe(true);
  });

  it("quitar la tarifa descarta la respuesta en vuelo", async () => {
    const f = formFake();
    const a = diferido<unknown>();
    fetchRecargosDeTarifa.mockReturnValue(a.promise);
    const cb = vi.fn();
    aplicarTarifaAlForm(f.setValue as never, f.trigger as never, tarifa("A"), { onAutocargaCostos: cb });
    cancelarAutocargaTarifa(f.setValue);
    a.resolve(recargo("A")); await a.promise; await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("P1-3 · fallo de recargos", () => {
  it("avisa con error accionable y no llama a la autocarga", async () => {
    const f = formFake();
    fetchRecargosDeTarifa.mockRejectedValue(new Error("red"));
    const cb = vi.fn();
    aplicarTarifaAlForm(f.setValue as never, f.trigger as never, tarifa("A"), { onAutocargaCostos: cb });
    await vi.waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1));
    expect(cb).not.toHaveBeenCalled();
    expect(notifyError.mock.calls[0][1].title).toMatch(/No se pudieron cargar los costos/);
  });

  it("el fallo de una tarifa ya reemplazada no se muestra", async () => {
    const f = formFake();
    const a = diferido<unknown>();
    fetchRecargosDeTarifa.mockImplementation((id: string) => (id === "A" ? a.promise : Promise.resolve(recargo("B"))));
    aplicarTarifaAlForm(f.setValue as never, f.trigger as never, tarifa("A"), { onAutocargaCostos: vi.fn() });
    aplicarTarifaAlForm(f.setValue as never, f.trigger as never, tarifa("B"), { onAutocargaCostos: vi.fn() });
    a.reject(new Error("tarde")); await a.promise.catch(() => undefined); await Promise.resolve();
    expect(notifyError).not.toHaveBeenCalled();
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
