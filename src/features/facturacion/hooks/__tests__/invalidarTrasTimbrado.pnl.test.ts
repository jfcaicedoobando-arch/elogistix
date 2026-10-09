import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { invalidarTrasTimbrado } from "../invalidarTrasTimbrado";

describe("audit132 invalidación de P&L por CFDI/NC", () => {
  it("alcanza todos los embarques de una factura sin invalidar otras lecturas singulares", async () => {
    const qc = new QueryClient();
    const relacionados = [queryKeys.embarques.pnlFinanciero("e1"), queryKeys.embarques.pnlFinanciero("e2")];
    const ajenos = [queryKeys.embarques.seguros("e1"), queryKeys.embarques.tcContexto("e2"),
      [...queryKeys.embarques.pnlFinanciero("e1"), "unrelated-extension"],
      ["otro-modulo", "e1", "pnl-financiero"]];
    for (const key of [...relacionados, ...ajenos]) qc.setQueryData(key, { utilidad_mxn: 100 });
    await invalidarTrasTimbrado(qc, "factura-multi");
    for (const key of relacionados) expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of ajenos) expect(qc.getQueryState(key)?.isInvalidated).toBe(false);
    qc.clear();
  });
});
