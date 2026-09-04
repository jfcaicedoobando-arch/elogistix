/**
 * Regresión de navegación: el estado de /crm/oportunidades (búsqueda, filtros,
 * vista guardada y pestaña) debe viajar en la URL para sobrevivir al "Volver"
 * desde el detalle, sin romper enlaces antiguos sin parámetros.
 */
import { describe, it, expect } from "vitest";
import {
  parseOportunidadesUrl,
  serializeOportunidadesUrl,
  URL_STATE_DEFAULT,
} from "../oportunidadesUrlState";
import { FILTROS_DEFAULT } from "@/features/crm/domain/oportunidades/filtros";

describe("oportunidadesUrlState", () => {
  it("un enlace antiguo sin parámetros cae en los valores por omisión", () => {
    expect(parseOportunidadesUrl(new URLSearchParams(""))).toEqual(URL_STATE_DEFAULT);
  });

  it("restaura búsqueda, filtros y pestaña desde la URL", () => {
    const params = new URLSearchParams(
      "q=acme&etapa=e1&vendedor=u1&desde=2026-09-01&hasta=2026-09-30&montoMin=1000&vista=tabla",
    );
    expect(parseOportunidadesUrl(params)).toEqual({
      search: "acme",
      filtros: {
        etapaId: "e1",
        vendedorId: "u1",
        cierreDesde: "2026-09-01",
        cierreHasta: "2026-09-30",
        montoMin: "1000",
      },
      vista: "tabla",
    });
  });

  it("una vista desconocida cae en Kanban", () => {
    expect(parseOportunidadesUrl(new URLSearchParams("vista=grafica")).vista).toBe("kanban");
  });

  it("serializa ida y vuelta sin perder información", () => {
    const state = {
      search: "cliente sur",
      filtros: { etapaId: "e2", vendedorId: "u9", cierreDesde: "", cierreHasta: "", montoMin: "50000" },
      vista: "tabla" as const,
    };
    expect(parseOportunidadesUrl(serializeOportunidadesUrl(state))).toEqual(state);
  });

  it("omite los valores por omisión y conserva parámetros ajenos", () => {
    const base = new URLSearchParams("clienteId=c1&q=viejo&vista=tabla");
    const next = serializeOportunidadesUrl(
      { search: "  ", filtros: FILTROS_DEFAULT, vista: "kanban" },
      base,
    );
    expect(next.get("clienteId")).toBe("c1");
    expect(next.has("q")).toBe(false);
    expect(next.has("vista")).toBe(false);
    expect(next.has("etapa")).toBe(false);
  });
});
