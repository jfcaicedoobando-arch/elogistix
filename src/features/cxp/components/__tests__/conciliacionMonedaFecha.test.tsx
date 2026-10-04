import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { render, screen } from "@testing-library/react";
import { ConciliacionIncidencias } from "../ConciliacionTesoreriaSection.incidencias";
import { mapReporteConciliacion } from "@/features/cxp/services/conciliacionTesoreria";
import { bitacoraExportACsv, filasBitacoraExport, ENCABEZADOS_BITACORA_EXPORT } from "@/features/cxp/services/bitacoraTesoreriaExport";

vi.mock("@/features/cxp/hooks/useRegenerarMovimientoPago", () => ({ useRegenerarMovimientoPago: () => ({ mutate: vi.fn(), isPending: false }) }));

describe("AUD39/42: conciliación conserva fecha civil y moneda bancaria", () => {
  it("presenta el 3 de octubre sin hora y compara USD con USD", () => {
    const reporte = mapReporteConciliacion({ incidencias: [{ pago_id: "usd", tipo: "descuadre", fecha_pago: "2026-10-03", monto: 1, moneda: "USD", monto_esperado_mxn: 20, cargo_mxn: 18, moneda_cuenta: "USD", monto_esperado_cuenta: 1, cargo_cuenta: 0.9 }] });
    render(<ConciliacionIncidencias monedaFactura="USD" incidencias={reporte.incidencias} />);
    expect(screen.getByText("03/10/2026")).toBeInTheDocument();
    expect(screen.queryByText(/18:00|02\/10/)).not.toBeInTheDocument();
    const banco = screen.getByText(/Banco/);
    expect(banco).toHaveTextContent(/USD/);
    expect(banco).not.toHaveTextContent(/MXN|20/);
    expect(banco).toHaveTextContent(/0\.90/);
  });

  it("explica falta de conversión sin fabricar esperado cero", () => {
    const reporte = mapReporteConciliacion({ incidencias: [{ pago_id: "sin-tc", tipo: "descuadre", monto_esperado_cuenta: null, motivo: "Falta tipo de cambio compatible." }] });
    expect(reporte.incidencias[0].montoEsperadoCuenta).toBeNull();
    render(<ConciliacionIncidencias monedaFactura="MXN" incidencias={reporte.incidencias} />);
    expect(screen.getByText("Falta tipo de cambio compatible.")).toBeInTheDocument();
    expect(screen.queryByText(/Banco/)).not.toBeInTheDocument();
  });

  it("exporta el equivalente MXN como tal, sin reinterpretar la bitácora histórica", () => {
    const filas = filasBitacoraExport([{ accion: "pagar", created_at: "2026-10-03T12:00:00Z", usuario_email: "fixture@example.invalid", detalles: { monto: 1, moneda: "USD", cargo_mxn: 20 } }], { monedaFactura: "USD", nombreCuenta: new Map() });
    expect(ENCABEZADOS_BITACORA_EXPORT).toContain("Equivalente MXN");
    expect(bitacoraExportACsv(filas)).toContain("Equivalente MXN");
    expect(bitacoraExportACsv(filas)).not.toContain("Cargo MXN");
    expect(filas[0].monto).toContain("USD");
    expect(filas[0].cargoMxn).toContain("20.00");
  });
});
