import { describe, expect, it } from "vitest";
import { filtroDeTarifaAgente } from "../agenteTarifasFiltros";
import type { TarifaVigenciaLike } from "@/features/costeo";

const hoy = "2026-09-30";
const aprobada: TarifaVigenciaLike = {
  estado_aprobacion: "vigente", estado: "vigente",
  vigente_desde: "2026-09-01", vigente_hasta: "2026-10-31",
};

describe("filtros de tarifas del agente", () => {
  it.each([
    [aprobada, "vigente"],
    [{ ...aprobada, vigente_desde: "2026-10-01" }, "programada"],
    [{ ...aprobada, vigente_hasta: "2026-09-29" }, "vencida"],
    [{ ...aprobada, estado: "reemplazada" }, "reemplazada"],
    [{ ...aprobada, estado_aprobacion: "borrador", vigente_hasta: "2026-09-01" }, "borrador"],
    [{ ...aprobada, estado_aprobacion: "rechazada", vigente_desde: "2026-10-01" }, "rechazada"],
  ])("clasifica %j como %s sin duplicarla entre filtros", (tarifa, esperado) => {
    expect(filtroDeTarifaAgente(tarifa, hoy)).toBe(esperado);
  });

  it("mantiene utilizable la tarifa el último día de vigencia", () => {
    expect(filtroDeTarifaAgente({ ...aprobada, vigente_hasta: hoy }, hoy)).toBe("vigente");
  });
});
