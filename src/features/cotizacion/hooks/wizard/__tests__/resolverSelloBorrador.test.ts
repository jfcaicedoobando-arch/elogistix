import { describe, it, expect, vi } from "vitest";
import {
  resolverSelloBorrador,
  SELLO_BLOQUEADO,
} from "../resolverSelloBorrador";

describe("resolverSelloBorrador", () => {
  it("adopta el sello canónico cuando coincide con el del borrador", async () => {
    const fetchSello = vi.fn(async () => "2026-09-03T10:00:00Z");
    const r = await resolverSelloBorrador({
      cotizacionId: "cot-1",
      selloDraft: "2026-09-03T10:00:00Z",
      fetchSello,
    });
    expect(r).toEqual({ sello: "2026-09-03T10:00:00Z", conflicto: false });
    expect(fetchSello).toHaveBeenCalledWith("cot-1");
  });

  it("draft legacy sin sello: consulta el canónico y NO falla abierto", async () => {
    const fetchSello = vi.fn(async () => "2026-09-03T11:00:00Z");
    const r = await resolverSelloBorrador({
      cotizacionId: "cot-1",
      selloDraft: undefined,
      fetchSello,
    });
    expect(fetchSello).toHaveBeenCalled();
    expect(r.sello).toBe("2026-09-03T11:00:00Z");
    expect(r.conflicto).toBe(false);
  });

  it("marca conflicto y conserva el sello viejo si la cotización ya cambió", async () => {
    const r = await resolverSelloBorrador({
      cotizacionId: "cot-1",
      selloDraft: "2026-09-03T10:00:00Z",
      fetchSello: async () => "2026-09-03T12:34:00Z",
    });
    expect(r).toEqual({ sello: "2026-09-03T10:00:00Z", conflicto: true });
  });

  it("si no se puede leer el sello canónico, bloquea (falla cerrado)", async () => {
    const r = await resolverSelloBorrador({
      cotizacionId: "cot-1",
      selloDraft: null,
      fetchSello: async () => {
        throw new Error("red");
      },
    });
    expect(r).toEqual({ sello: SELLO_BLOQUEADO, conflicto: true });
  });

  it("cotización inexistente/eliminada: conflicto", async () => {
    const r = await resolverSelloBorrador({
      cotizacionId: "cot-1",
      selloDraft: null,
      fetchSello: async () => null,
    });
    expect(r.conflicto).toBe(true);
    expect(r.sello).toBe(SELLO_BLOQUEADO);
  });
});
