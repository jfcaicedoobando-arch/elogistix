import type { ResumenCuenta } from "@/features/tesoreria/domain";
import { fetchFuentesDashboardEjecutivo } from "../agregador";
import { buildFinancialAnalysis } from "../financialAnalysis";
import { construirSnapshotEjecutivo } from "../snapshot";

export type SnapshotFixtureParams = Parameters<typeof fetchFuentesDashboardEjecutivo>[0]
  & Pick<Parameters<typeof construirSnapshotEjecutivo>[0], "cobranza" | "cxp">;

export async function probarSnapshotEjecutivo(params: SnapshotFixtureParams, bank: Promise<ResumenCuenta[]>) {
  const [fuentes, cuentas] = await Promise.all([fetchFuentesDashboardEjecutivo(params), bank]);
  return construirSnapshotEjecutivo({
    fuentes, cuentas, cobranza: params.cobranza, cxp: params.cxp, liquidaciones: [],
    financialAnalysis: buildFinancialAnalysis({
      organizationId: params.organizationId, selectedMonth: params.periodo, currentBalanceReference: "2026-10-13",
      currencyRows: [...params.cobranza, ...params.cxp, ...cuentas],
    }),
    generadoEn: "2026-10-13T18:00:00Z",
  });
}
