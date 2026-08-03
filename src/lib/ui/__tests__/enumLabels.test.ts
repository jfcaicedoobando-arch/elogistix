/**
 * FIX 6 (P3) — Etiquetas legibles de enums crudos.
 */
import { describe, it, expect } from "vitest";
import { humanizarEnum, pareceEnumCrudo } from "@/lib/ui/enumLabels";

describe("humanizarEnum", () => {
  it("traduce slugs conocidos con acentos", () => {
    expect(humanizarEnum("importacion")).toBe("Importación");
    expect(humanizarEnum("maritimo")).toBe("Marítimo");
    expect(humanizarEnum("en_transito")).toBe("En tránsito");
  });

  it("respeta valores que ya vienen formateados desde la base", () => {
    expect(humanizarEnum("Importación")).toBe("Importación");
    expect(humanizarEnum("Cross Trade")).toBe("Cross Trade");
  });

  it("humaniza slugs desconocidos", () => {
    expect(humanizarEnum("nuevo_estado_raro")).toBe("Nuevo estado raro");
  });

  it("tolera nulos y vacíos", () => {
    expect(humanizarEnum(null)).toBe("");
    expect(humanizarEnum(undefined)).toBe("");
    expect(humanizarEnum("  ")).toBe("");
  });

  it("pareceEnumCrudo distingue slugs de frases", () => {
    expect(pareceEnumCrudo("por_liquidar")).toBe(true);
    expect(pareceEnumCrudo("Por liquidar")).toBe(false);
  });
});
