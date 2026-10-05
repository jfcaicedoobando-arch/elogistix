import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchEstadoCuentaBancario } from "../estadoCuenta";
import { resumenEstadoCuenta } from "../estadoCuentaExport";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const base = {
  cuenta_id: "cuenta", alias: "Operativa", banco: "Banco", moneda: "MXN",
  desde: "2026-10-03", fecha_saldo_inicial: "2026-10-03",
  saldo_inicial: 1000, total_entradas: 50, total_salidas: 20, saldo_final: 1030,
  movimientos_previos_corte: 1,
  movimientos: [{ id: "entrada", fecha: "2026-10-03", abono: 50, cargo: 0, saldo_corrido: 1050 }],
};

describe("Estado de cuenta: cobertura histórica (86)", () => {
  beforeEach(() => rpc.mockReset());

  it.each([
    { ...base, cobertura_historica: "sin_cobertura", saldo_inicial: null, total_entradas: null, total_salidas: null, saldo_final: null },
    { ...base, saldo_inicial: 1000, total_entradas: 0, total_salidas: 0, saldo_final: 1000 },
  ])("no representa apertura futura ni cero cuando todo el periodo es anterior al arranque", async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    const result = await fetchEstadoCuentaBancario("cuenta", "2026-10-01", "2026-10-02");
    expect(rpc).toHaveBeenCalledWith("estado_cuenta_bancario", {
      p_cuenta_bancaria_id: "cuenta", p_desde: "2026-10-01", p_hasta: "2026-10-02",
    });
    expect(result).toMatchObject({
      cobertura_historica: "sin_cobertura", desde: "2026-10-01", desde_solicitado: "2026-10-01", hasta: "2026-10-02",
      saldo_inicial: null, total_entradas: null, total_salidas: null, saldo_final: null, movimientos: [],
    });
    expect(resumenEstadoCuenta(result)).toMatchObject({
      saldoInicial: "No disponible", saldoFinal: "No disponible", entradas: "No disponible", salidas: "No disponible",
      cobertura: expect.stringContaining("No hay cobertura histórica"),
    });
  });

  it("explica el periodo efectivo al cruzar el arranque y conserva los importes cubiertos", async () => {
    rpc.mockResolvedValue({ data: base, error: null });
    const result = await fetchEstadoCuentaBancario("cuenta", "2026-10-01", "2026-10-05");
    expect(result).toMatchObject({ cobertura_historica: "parcial", desde: "2026-10-03", desde_solicitado: "2026-10-01", saldo_inicial: 1000, total_entradas: 50, total_salidas: 20, saldo_final: 1030 });
    const resumen = resumenEstadoCuenta(result);
    expect(resumen.periodo).toBe("03/10/2026 – 05/10/2026");
    expect(resumen.cobertura).toContain("solicitado comienza el 01/10/2026");
    expect(resumen.cobertura).toContain("únicamente del 03/10/2026 al 05/10/2026");
    expect(resumen.saldoFinal).toBe("MXN 1,030.00");
  });

  it.each(["2026-10-03", "2026-10-04"])("el inicio %s tiene cobertura completa y conserva los ceros conocidos", async (desde) => {
    rpc.mockResolvedValue({ data: { ...base, desde, saldo_inicial: 0, saldo_final: 0, total_entradas: 0, total_salidas: 0, movimientos: [] }, error: null });
    const result = await fetchEstadoCuentaBancario("cuenta", desde, "2026-10-05");
    expect(result).toMatchObject({ cobertura_historica: "completa", desde, saldo_inicial: 0, saldo_final: 0 });
    expect(resumenEstadoCuenta(result)).toMatchObject({ saldoInicial: "MXN 0.00", saldoFinal: "MXN 0.00", cobertura: null });
  });

  it("preserva importes desconocidos aun en una respuesta cubierta", async () => {
    rpc.mockResolvedValue({ data: { ...base, saldo_inicial: null, saldo_final: null }, error: null });
    const result = await fetchEstadoCuentaBancario("cuenta", "2026-10-03", "2026-10-05");
    expect(result.saldo_inicial).toBeNull();
    expect(result.saldo_final).toBeNull();
  });

  it("propaga errores de autorización y validación de la RPC", async () => {
    const error = new Error("LC_ESTADO_CUENTA_SIN_ACCESO");
    rpc.mockResolvedValue({ data: null, error });
    await expect(fetchEstadoCuentaBancario("otra", "2026-10-01", "2026-10-02")).rejects.toBe(error);
  });
});
