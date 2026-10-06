import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { lecturasAfectadasPorRep } from "./efectosRep";
import { invalidarTrasRep } from "../hooks/invalidarRep";
import { queryKeys } from "@/lib/query";

describe("REP operation read effects", () => {
  it("covers payment history, document, pending queue and financial read models", () => {
    expect(lecturasAfectadasPorRep("f1")).toEqual([
      queryKeys.facturas.pagos("f1"), queryKeys.facturas.detail("f1"), queryKeys.facturas.all,
      queryKeys.facturacion.repPendientes, queryKeys.bandejas.all,
      queryKeys.dashboardEjecutivo.all, queryKeys.presupuesto.all, queryKeys.profit.all, queryKeys.direccion.all,
    ]);
  });
  it("invalidates once per read key and handles an unknown document", () => {
    const qc = new QueryClient();
    const invalidateQueries = vi.spyOn(qc, "invalidateQueries").mockResolvedValue(undefined);
    invalidarTrasRep(qc);
    expect(invalidateQueries.mock.calls.map(([arg]) => arg?.queryKey)).toEqual(lecturasAfectadasPorRep());
    expect(lecturasAfectadasPorRep()).toContainEqual(queryKeys.facturas.pagosAll);
    qc.clear();
  });
});
