import { describe, it, expect } from "vitest";
import { computeRankingMeta } from "../rankingLabels";
import type { TopTarifaRow } from "@/features/costeo/types";

/** Builder mínimo: rellena solo lo que consume `computeRankingMeta`. */
const row = (over: Partial<TopTarifaRow>): TopTarifaRow =>
  ({
    id: "t1",
    organization_id: "org",
    agente_id: "a", agente_nombre: "Agente",
    naviera_id: "n", naviera_nombre: "Naviera",
    ruta_id: "r", puerto_origen_id: "po", puerto_destino_id: "pd",
    puerto_origen_nombre: "Shanghái", puerto_destino_nombre: "Manzanillo",
    tipo_contenedor_id: "tc", tipo_contenedor_nombre: "40HC",
    moneda: "USD",
    flete_base: 0, recargos_total: 0,
    total_comparable: 0,
    dias_credito: 0,
    dias_libres_demoras: 0,
    transit_time_dias: null,
    vigente_desde: "2026-01-01",
    vigente_hasta: "2099-01-01",
    estado: "vigente",
    naviera_condicion_id: null,
    naviera_tiene_carta_garantia: false,
    naviera_carta_garantia_vigente_hasta: null,
    naviera_carta_garantia_activa: false,
    naviera_dias_libres_default: null,
    naviera_demora_dia_6: null,
    dias_libres_almacenaje_lcl: null,
    frecuencia_resuelta: null,
    naviera_frecuencia: null,
    tarifa_frecuencia_override: null,
    ...over,
  });

describe("costeo/utils/rankingLabels.computeRankingMeta", () => {
  it("retorna [] cuando no hay filas", () => {
    expect(computeRankingMeta([])).toEqual([]);
  });

  it("marca al primero como ganador y delta 0", () => {
    const rows = [
      row({ id: "1", total_comparable: 1000 }),
      row({ id: "2", total_comparable: 1200 }),
      row({ id: "3", total_comparable: 1500 }),
    ];
    const meta = computeRankingMeta(rows);
    expect(meta[0].esGanador).toBe(true);
    expect(meta[0].deltaTotalVsGanador).toBe(0);
    expect(meta[1].esGanador).toBe(false);
    expect(meta[1].deltaTotalVsGanador).toBe(200);
    expect(meta[2].deltaTotalVsGanador).toBe(500);
  });

  it("'Mejor precio' va al de menor total, no necesariamente al ganador", () => {
    // Ordenar por otro criterio: el "ganador" (índice 0) no es el más barato.
    const rows = [
      row({ id: "1", total_comparable: 1500 }), // ganador por otra razón
      row({ id: "2", total_comparable: 1000 }), // el más barato
    ];
    const meta = computeRankingMeta(rows);
    expect(meta[0].etiquetasMejorEn).not.toContain("Mejor precio");
    expect(meta[1].etiquetasMejorEn).toContain("Mejor precio");
  });

  it("'Más crédito' y 'Más días libres' solo se asignan si el máximo es > 0", () => {
    const rows = [
      row({ id: "1", total_comparable: 100, dias_credito: 0, dias_libres_demoras: 0 }),
      row({ id: "2", total_comparable: 200, dias_credito: 0, dias_libres_demoras: 0 }),
    ];
    const meta = computeRankingMeta(rows);
    for (const m of meta) {
      expect(m.etiquetasMejorEn).not.toContain("Más crédito");
      expect(m.etiquetasMejorEn).not.toContain("Más días libres");
    }
  });

  it("asigna 'Más crédito' y 'Más días libres' al máximo cuando > 0", () => {
    const rows = [
      row({ id: "1", total_comparable: 100, dias_credito: 15, dias_libres_demoras: 7 }),
      row({ id: "2", total_comparable: 200, dias_credito: 30, dias_libres_demoras: 14 }),
    ];
    const meta = computeRankingMeta(rows);
    expect(meta[1].etiquetasMejorEn).toContain("Más crédito");
    expect(meta[1].etiquetasMejorEn).toContain("Más días libres");
    expect(meta[0].etiquetasMejorEn).not.toContain("Más crédito");
  });

  it("'Tránsito más corto' ignora filas con transit_time null", () => {
    const rows = [
      row({ id: "1", total_comparable: 100, transit_time_dias: null }),
      row({ id: "2", total_comparable: 200, transit_time_dias: 25 }),
      row({ id: "3", total_comparable: 300, transit_time_dias: 30 }),
    ];
    const meta = computeRankingMeta(rows);
    expect(meta[1].etiquetasMejorEn).toContain("Tránsito más corto");
    expect(meta[0].etiquetasMejorEn).not.toContain("Tránsito más corto");
  });

  it("'vencePronto' es true cuando vigente_hasta cae dentro de 7 días", () => {
    const ms = 86_400_000;
    const enCincoDias = new Date(Date.now() + 5 * ms).toISOString().split("T")[0];
    const enTreintaDias = new Date(Date.now() + 30 * ms).toISOString().split("T")[0];
    const ayer = new Date(Date.now() - ms).toISOString().split("T")[0];

    const rows = [
      row({ id: "1", total_comparable: 100, vigente_hasta: enCincoDias }),
      row({ id: "2", total_comparable: 200, vigente_hasta: enTreintaDias }),
      row({ id: "3", total_comparable: 300, vigente_hasta: ayer }),
    ];
    const meta = computeRankingMeta(rows);
    expect(meta[0].vencePronto).toBe(true);
    expect(meta[1].vencePronto).toBe(false);
    expect(meta[2].vencePronto).toBe(false); // ya vencida (días negativos)
  });
});
