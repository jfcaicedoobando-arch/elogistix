/**
 * Campos derivados y validación al aplicar una tarifa al formulario.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));
vi.mock("@/lib/supabase/cast", () => ({ toDbJson: <T,>(x: T) => x }));

import { aplicarTarifaAlForm } from "@/features/cotizacion/hooks/wizard/aplicarTarifaAlForm";
import type { TopTarifaRow } from "@/features/costeo/types";

const row = {
  id: "tar-1",
  tipo_contenedor_id: "tc-40hc",
  tipo_contenedor_nombre: "40HC",
  naviera_nombre: "MSC",
  flete_base: 1000,
  transit_time_dias: 30,
  dias_libres_demoras: 7,
  naviera_carta_garantia_activa: true,
} as unknown as TopTarifaRow;

describe("aplicarTarifaAlForm", () => {
  it("setea tarifaId + transit time + cartaGarantia y dispara trigger", () => {
    const setValue = vi.fn();
    const trigger = vi.fn().mockResolvedValue(true);
    aplicarTarifaAlForm(setValue as never, trigger as never, row);

    const opts = { shouldValidate: true, shouldDirty: true };
    expect(setValue).toHaveBeenCalledWith("tarifaId", "tar-1", opts);
    expect(setValue).toHaveBeenCalledWith("tarifaOverride", {}, opts);
    expect(setValue).toHaveBeenCalledWith("tiempoTransitoDias", 30, opts);
    expect(setValue).toHaveBeenCalledWith("diasLibresDestino", 7, opts);
    expect(setValue).toHaveBeenCalledWith("cartaGarantia", true, opts);
    expect(setValue).toHaveBeenCalledWith("tipoContenedor", "tc-40hc", opts);
    expect(trigger).toHaveBeenCalledWith([
      "tiempoTransitoDias",
      "diasLibresDestino",
      "cartaGarantia",
      "tipoContenedor",
      "frecuencia",
      "diasAlmacenaje",
      "validezPropuesta",
      "rutaTexto",
      "monedaTarifa",
    ]);
  });

  it("recorta validezPropuesta cuando excede vigente_hasta de la tarifa", () => {
    const setValue = vi.fn();
    const trigger = vi.fn().mockResolvedValue(true);
    const rowConVigencia = { ...row, vigente_hasta: "2026-12-31" } as TopTarifaRow;
    const validezActual = new Date(2027, 5, 15); // junio 2027 > vigente_hasta
    aplicarTarifaAlForm(setValue as never, trigger as never, rowConVigencia, validezActual);
    const calls = setValue.mock.calls.filter((c) => c[0] === "validezPropuesta");
    expect(calls).toHaveLength(1);
    expect((calls[0][1] as Date).getFullYear()).toBe(2026);
    expect((calls[0][1] as Date).getMonth()).toBe(11);
    expect((calls[0][1] as Date).getDate()).toBe(31);
  });

  it("no toca validezPropuesta si es anterior a vigente_hasta", () => {
    const setValue = vi.fn();
    const trigger = vi.fn().mockResolvedValue(true);
    const rowConVigencia = { ...row, vigente_hasta: "2026-12-31" } as TopTarifaRow;
    const validezActual = new Date(2026, 5, 15);
    aplicarTarifaAlForm(setValue as never, trigger as never, rowConVigencia, validezActual);
    expect(setValue.mock.calls.find((c) => c[0] === "validezPropuesta")).toBeUndefined();
  });
});
