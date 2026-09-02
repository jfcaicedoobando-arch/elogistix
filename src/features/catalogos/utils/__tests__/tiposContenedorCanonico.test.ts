import { describe, it, expect } from "vitest";
import {
  claveCanonicaTipoContenedor,
  dedupeTiposContenedor,
  idsEquivalentesDeTipo,
  resolverIdCanonicoTipo,
} from "../tiposContenedorCanonico";
import type { TipoContenedor } from "@/features/catalogos/services/catalogosTypes";

function tipo(over: Partial<TipoContenedor>): TipoContenedor {
  return {
    id: "a",
    code: "20DV",
    name: "20' Dry",
    activo: true,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("tiposContenedorCanonico", () => {
  it("agrupa variantes del mismo tipo bajo una clave semántica", () => {
    expect(claveCanonicaTipoContenedor({ code: "20DV", name: "20' Dry (Standard)" })).toBe(
      claveCanonicaTipoContenedor({ code: "20ST", name: "20 Estándar" }),
    );
    expect(claveCanonicaTipoContenedor({ code: "40HC", name: "40' High Cube" })).toBe("40|hc");
  });

  it("colapsa duplicados eligiendo el más antiguo y conserva los IDs equivalentes", () => {
    const rows = [
      tipo({ id: "id-nuevo", created_at: "2026-05-01T00:00:00Z", name: "20' Dry (Standard)" }),
      tipo({ id: "id-viejo", created_at: "2026-01-01T00:00:00Z", name: "20 Estándar", code: "20ST" }),
      tipo({ id: "id-hc", name: "40' High Cube", code: "40HC" }),
    ];
    const out = dedupeTiposContenedor(rows);
    expect(out).toHaveLength(2);
    const dry = out.find((t) => t.idsEquivalentes.includes("id-nuevo"))!;
    expect(dry.id).toBe("id-viejo");
    expect(dry.idsEquivalentes).toEqual(["id-nuevo", "id-viejo"]);
  });

  it("resuelve equivalentes y canónico desde cualquier ID del grupo", () => {
    const catalogo = dedupeTiposContenedor([
      tipo({ id: "id-nuevo", created_at: "2026-05-01T00:00:00Z" }),
      tipo({ id: "id-viejo", created_at: "2026-01-01T00:00:00Z", code: "20ST", name: "20 Estándar" }),
    ]);
    expect(idsEquivalentesDeTipo(catalogo, "id-nuevo")).toEqual(["id-nuevo", "id-viejo"]);
    expect(resolverIdCanonicoTipo(catalogo, "id-nuevo")).toBe("id-viejo");
    expect(resolverIdCanonicoTipo(catalogo, "desconocido")).toBe("desconocido");
    expect(idsEquivalentesDeTipo(catalogo, null)).toEqual([]);
  });
});
