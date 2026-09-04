import { describe, it, expect } from "vitest";
import { resincronizarSelloConflicto, SELLO_BLOQUEADO } from "../resolverSelloBorrador";

describe("resincronizarSelloConflicto", () => {
  it("sello canónico se puede leer ⇒ desbloquea y lo adopta", async () => {
    const r = await resincronizarSelloConflicto({
      cotizacionId: "cot-1",
      fetchSello: async () => "2026-09-03T10:00:00Z",
    });
    expect(r).toEqual({ sello: "2026-09-03T10:00:00Z", conflicto: false });
  });

  it("cotización inexistente/eliminada (sello canónico null) ⇒ sigue en conflicto", async () => {
    const r = await resincronizarSelloConflicto({
      cotizacionId: "cot-1",
      fetchSello: async () => null,
    });
    expect(r).toEqual({ sello: SELLO_BLOQUEADO, conflicto: true });
  });

  it("lectura fallida (excepción) ⇒ sigue en conflicto, falla cerrado", async () => {
    const r = await resincronizarSelloConflicto({
      cotizacionId: "cot-1",
      fetchSello: async () => {
        throw new Error("red");
      },
    });
    expect(r).toEqual({ sello: SELLO_BLOQUEADO, conflicto: true });
  });
});
