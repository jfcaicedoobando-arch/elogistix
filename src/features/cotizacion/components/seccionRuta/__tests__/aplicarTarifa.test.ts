/**
 * v13.36.0 — Test integración del helper `aplicarTarifaAlForm`.
 * Verifica el flujo end-to-end de elegir una sugerencia:
 *  - setea tarifaId + campos derivados en el form,
 *  - dispara trigger() de validación,
 *  - llama onAutocargaCostos con filas construidas desde los recargos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));
vi.mock("@/lib/supabase/cast", () => ({ toDbJson: <T,>(x: T) => x }));

const fetchRecargosDeTarifa = vi.fn();
vi.mock("@/features/costeo/services/topTarifas", () => ({
  fetchRecargosDeTarifa: (...a: unknown[]) => fetchRecargosDeTarifa(...a),
}));

import { aplicarTarifaAlForm } from "../aplicarTarifa";
import type { TopTarifaRow, CosteoTarifaRecargo } from "@/features/costeo/types";

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

const recargos: CosteoTarifaRecargo[] = [
  { id: "r1", tarifa_id: "tar-1", concepto: "BAF", lado: "origen", monto: 100, moneda: "USD", incluido_en_total: true },
];

beforeEach(() => { vi.clearAllMocks(); });

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
    ]);
  });

  it("auto-carga costos con markup aplicado al elegir una sugerencia", async () => {
    fetchRecargosDeTarifa.mockResolvedValue(recargos);
    const setValue = vi.fn();
    const trigger = vi.fn().mockResolvedValue(true);
    const onAutocargaCostos = vi.fn();

    aplicarTarifaAlForm(setValue as never, trigger as never, row, {
      onAutocargaCostos,
      markup: 0.2,
      cantidad: 2,
    });

    // Esperar al .then del fetchRecargos
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchRecargosDeTarifa).toHaveBeenCalledWith("tar-1");
    expect(onAutocargaCostos).toHaveBeenCalledTimes(1);
    const filas = onAutocargaCostos.mock.calls[0][0];
    expect(filas).toHaveLength(2);
    expect(filas[0].costo_unitario).toBe(1000);
    expect(filas[0].precio_venta).toBe(1200); // 1000 * 1.2
    expect(filas[0].cantidad).toBe(2);
    expect(filas[1].concepto).toBe("BAF (origen)");
    expect(filas[1].precio_venta).toBe(120); // 100 * 1.2
  });

  it("no llama onAutocargaCostos si fetchRecargos falla (best-effort)", async () => {
    fetchRecargosDeTarifa.mockRejectedValue(new Error("network"));
    const setValue = vi.fn();
    const trigger = vi.fn().mockResolvedValue(true);
    const onAutocargaCostos = vi.fn();
    aplicarTarifaAlForm(setValue as never, trigger as never, row, { onAutocargaCostos });
    await new Promise((r) => setTimeout(r, 0));
    expect(onAutocargaCostos).not.toHaveBeenCalled();
  });

  it("sin onAutocargaCostos, no consulta recargos", () => {
    aplicarTarifaAlForm(vi.fn() as never, vi.fn() as never, row);
    expect(fetchRecargosDeTarifa).not.toHaveBeenCalled();
  });
});
