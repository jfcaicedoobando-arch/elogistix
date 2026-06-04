/**
 * Tests del hash determinista usado para identificar hallazgos a través de
 * recargas (debe coincidir con el cómputo del backend).
 */
import { describe, it, expect } from "vitest";
import {
  hallazgoHash,
  revisionKey,
} from "@/hooks/auditoria/useAuditoriaRevisiones";

describe("hallazgoHash", () => {
  it("es determinista para los mismos inputs", () => {
    const a = hallazgoHash({ embarque_id: "e1", regla: "fechas", detalle: "ETA pasada" });
    const b = hallazgoHash({ embarque_id: "e1", regla: "fechas", detalle: "ETA pasada" });
    expect(a).toBe(b);
  });

  it("cambia cuando cambia detalle, regla o embarque", () => {
    const base = hallazgoHash({ embarque_id: "e1", regla: "fechas", detalle: "x" });
    expect(hallazgoHash({ embarque_id: "e1", regla: "fechas", detalle: "y" })).not.toBe(base);
    expect(hallazgoHash({ embarque_id: "e1", regla: "docs_faltantes", detalle: "x" })).not.toBe(base);
    expect(hallazgoHash({ embarque_id: "e2", regla: "fechas", detalle: "x" })).not.toBe(base);
  });

  it("retorna string base36 no vacío", () => {
    const h = hallazgoHash({ embarque_id: "e", regla: "fechas", detalle: "d" });
    expect(h).toMatch(/^[0-9a-z]+$/);
  });
});

describe("revisionKey", () => {
  it("compone embarque|regla|hash en ese orden", () => {
    const k = revisionKey({ embarque_id: "e1", regla: "fechas", detalle: "d" });
    expect(k.startsWith("e1|fechas|")).toBe(true);
    const partes = k.split("|");
    expect(partes).toHaveLength(3);
  });
});
