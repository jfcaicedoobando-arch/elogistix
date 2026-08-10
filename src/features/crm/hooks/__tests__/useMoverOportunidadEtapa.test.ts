import { describe, it, expect } from "vitest";
import { resolverLimpiezaCierre } from "../useMoverOportunidadEtapa";
import type { CrmEtapaRow } from "@/features/crm/hooks";

type Etapa = CrmEtapaRow & { tipo?: string };

function etapa(tipo?: string): Etapa {
  return { id: `e-${tipo ?? "sin-tipo"}`, tipo } as Etapa;
}

// Ola 4 · N49: resolverLimpiezaCierre limpia fecha_cierre_real/valor_real al
// salir de "ganada" y motivo_perdida_id al salir de "perdida" — tanto en el
// movimiento normal como en el Undo (origen/destino invertidos).
describe("resolverLimpiezaCierre (Ola 4 · N49)", () => {
  it("ganada -> abierta limpia fecha_cierre_real y valor_real", () => {
    const patch = resolverLimpiezaCierre(etapa("abierta"), etapa("ganada"));
    expect(patch).toEqual({ fecha_cierre_real: null, valor_real: null });
  });

  it("perdida -> abierta limpia motivo_perdida_id", () => {
    const patch = resolverLimpiezaCierre(etapa("abierta"), etapa("perdida"));
    expect(patch).toEqual({ motivo_perdida_id: null });
  });

  it("abierta -> abierta no limpia nada", () => {
    const patch = resolverLimpiezaCierre(etapa("abierta"), etapa("abierta"));
    expect(patch).toEqual({});
  });

  it("ganada -> ganada no limpia (misma etapa, sin cambio real)", () => {
    const patch = resolverLimpiezaCierre(etapa("ganada"), etapa("ganada"));
    expect(patch).toEqual({});
  });

  it("perdida -> perdida no limpia el motivo", () => {
    const patch = resolverLimpiezaCierre(etapa("perdida"), etapa("perdida"));
    expect(patch).toEqual({});
  });

  it("Undo de abierta->ganada: invertir origen/destino limpia el cierre recién escrito", () => {
    // El movimiento original fue abierta -> ganada (resolverCierreGanada
    // escribió fecha/valor). El Undo llama con (etapaOrigen, etapaDestino)
    // invertidos: destino=abierta, origen=ganada.
    const patchUndo = resolverLimpiezaCierre(etapa("abierta"), etapa("ganada"));
    expect(patchUndo).toEqual({ fecha_cierre_real: null, valor_real: null });
  });

  it("etapas undefined no truena y no limpia nada", () => {
    expect(resolverLimpiezaCierre(undefined, undefined)).toEqual({});
  });
});
