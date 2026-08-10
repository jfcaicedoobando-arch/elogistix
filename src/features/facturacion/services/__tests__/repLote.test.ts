import { describe, it, expect, vi, beforeEach } from "vitest";

const emitirRep = vi.fn();
vi.mock("@/features/facturacion/services/repFacturapi", () => ({
  emitirRep: (id: string) => emitirRep(id),
}));

import { timbrarRepsSecuencial, resumenRepLote } from "../repLote";

describe("timbrarRepsSecuencial", () => {
  beforeEach(() => {
    emitirRep.mockReset();
  });

  it("timbra todos los pagos en orden", async () => {
    const vistos: string[] = [];
    emitirRep.mockImplementation((id: string) => {
      vistos.push(id);
      return Promise.resolve({ ok: true });
    });

    const res = await timbrarRepsSecuencial(["p1", "p2", "p3"]);

    expect(vistos).toEqual(["p1", "p2", "p3"]);
    expect(res.ok).toBe(3);
    expect(res.fallos).toEqual([]);
  });

  it("un fallo no detiene al resto y queda reportado", async () => {
    emitirRep.mockImplementation((id: string) =>
      id === "p2" ? Promise.reject(new Error("SAT rechazó")) : Promise.resolve({ ok: true }),
    );

    const res = await timbrarRepsSecuencial(["p1", "p2", "p3"]);

    expect(res.ok).toBe(2);
    expect(res.fallos).toHaveLength(1);
    expect(res.fallos[0].pagoId).toBe("p2");
    expect(res.fallos[0].mensaje).toContain("SAT");
  });

  it("informa progreso por pago", async () => {
    emitirRep.mockResolvedValue({ ok: true });
    const progreso: string[] = [];

    await timbrarRepsSecuencial(["p1", "p2"], (h, t) => progreso.push(`${h}/${t}`));

    expect(progreso).toEqual(["1/2", "2/2"]);
  });

  it("resumenRepLote usa español mexicano con singular/plural", () => {
    expect(resumenRepLote({ ok: 1, fallos: [] })).toBe("1 REP timbrado");
    expect(resumenRepLote({ ok: 3, fallos: [{ pagoId: "x", mensaje: "e" }] })).toBe(
      "3 REP timbrados, 1 con error",
    );
  });
});
