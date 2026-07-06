import { describe, it, expect } from "vitest";
import { hallazgoHash, revisionKey, AUDITORIA_REVISIONES_KEY } from "../hash";

describe("hallazgoHash (hash.ts unit)", () => {
  const base = { embarque_id: "e1", regla: "docs_faltantes" as const, detalle: "faltan BL" };


  it("es determinista para el mismo input", () => {
    expect(hallazgoHash(base)).toBe(hallazgoHash({ ...base }));
  });

  it("cambia si cambia embarque_id, regla o detalle", () => {
    const a = hallazgoHash(base);
    expect(hallazgoHash({ ...base, embarque_id: "e2" })).not.toBe(a);
    expect(hallazgoHash({ ...base, regla: "fechas" })).not.toBe(a);
    expect(hallazgoHash({ ...base, detalle: "otra" })).not.toBe(a);
  });

  it("devuelve un string base36 no vacío", () => {
    expect(hallazgoHash(base)).toMatch(/^[0-9a-z]+$/);
  });
});

describe("revisionKey (hash.ts unit)", () => {
  it("concatena embarque_id, regla y hash", () => {
    const h = { embarque_id: "e1", regla: "docs_faltantes" as const, detalle: "x" };
    const key = revisionKey(h);
    expect(key.startsWith("e1|docs_faltantes|")).toBe(true);
    expect(key.split("|")[2]).toBe(hallazgoHash(h));
  });
});

describe("AUDITORIA_REVISIONES_KEY", () => {
  it("está definido", () => {
    expect(AUDITORIA_REVISIONES_KEY).toBeDefined();
  });
});
