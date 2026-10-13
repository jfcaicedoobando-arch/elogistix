import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHistoricalReadMock } from "@/test/helpers/historicalReadMock";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { invalidarEmisorCache } from "@/features/configuracion/services/emisor";
import { descargarEstadoCuentaPdf, type DatosEstadoCuenta } from "@/features/proveedor/services/estadoCuentaDescargas";
import { EstadoCuentaExportButtons } from "@/features/tesoreria/routes/_sections/EstadoCuentaExportButtons";
import { BitacoraTesoreriaExportButtons } from "@/features/cxp/components/BitacoraTesoreriaExportButtons";
import type { EstadoCuentaBancario, MovimientoEstadoCuenta } from "@/features/tesoreria/domain/estadoCuenta";

const h = vi.hoisted(() => ({
  current: null as ReturnType<typeof createHistoricalReadMock> | null,
  download: vi.fn(async (_document: ReactElement<Record<string, unknown>>, _filename: string) => undefined),
  error: vi.fn(), success: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ get supabase() { return h.current!.supabase; } }));
vi.mock("@/pdf/render/descargarPdf", () => ({ descargarPdf: h.download }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: h.success, notifyError: h.error, notifyWarning: vi.fn() }));
vi.mock("@/pdf/documents/EstadoCuentaProveedorDocument", () => ({ EstadoCuentaProveedorDocument: () => null }));
vi.mock("@/pdf/documents/EstadoCuentaBancarioDocument", () => ({ EstadoCuentaBancarioDocument: () => null }));
vi.mock("@/pdf/documents/BitacoraTesoreriaDocument", () => ({ BitacoraTesoreriaDocument: () => null }));

const proveedor: DatosEstadoCuenta = {
  proveedorId: "entidad-a", proveedorNombre: "Proveedor sintético", desde: "2026-09-01", hasta: "2026-09-30",
  movimientos: [{ fecha: "2026-09-30", tipo: "Factura", ref_id: "f1", folio: "FP-1", referencia: null,
    expediente: "", embarque_id: null, moneda: "MXN", cargo: 3, abono: 0, detalle: null, saldo: 103 }],
  aging: [], saldos: [{ moneda: "MXN", cargos: 106, abonos: 0, saldo: 106 }],
  saldoApertura: [{ moneda: "MXN", saldo: 100 }], hayMas: true, totalMovimientos: 501,
};
const movimiento: MovimientoEstadoCuenta = {
  id: "m1", fecha: "2026-09-30", concepto: "Cobro", referencia: "A1", cargo: 0, abono: 116,
  estado_conciliacion: "Pendiente", saldo_corrido: 1016, pago_factura_id: null, pago_proveedor_id: null,
  anticipo_proveedor_id: null, pago_proveedor_lote_id: null,
};
const banco: EstadoCuentaBancario = {
  cuenta_id: "entidad-a", alias: "Cuenta sintética", banco: "Banco", moneda: "MXN", desde: "2026-09-15",
  desde_solicitado: "2026-09-01", cobertura_historica: "parcial", hasta: "2026-09-30", saldo_inicial: 1000,
  total_entradas: 116, total_salidas: 100, saldo_final: 1016, fecha_saldo_inicial: "2026-09-15",
  movimientos_previos_corte: 1, movimientos: [{ ...movimiento, id: "m0", cargo: 100, abono: 0, saldo_corrido: 900 }, movimiento],
};
const filas = [{ fecha: "30/09/2026", movimiento: "Pago eliminado", monto: "MXN 100.00", cargoMxn: "MXN 100.00",
  cuenta: "Cuenta sintética", estadoMovimiento: "Movimiento dado de baja", usuario: "sintetico@example.test" }];
const consumers = [
  { kind: "proveedor", table: "proveedores", method: "PROVEEDOR_ESTADO_CUENTA_PDF" },
  { kind: "banco", table: "cuentas_bancarias", method: "ESTADO_CUENTA_PDF" },
  { kind: "bitácora", table: "proveedor_facturas", method: "BITACORA_TESORERIA_PDF" },
] as const;
type Consumer = typeof consumers[number]["kind"];

async function start(kind: Consumer) {
  if (kind === "proveedor") return descargarEstadoCuentaPdf(proveedor);
  if (kind === "banco") render(<EstadoCuentaExportButtons estado={banco} movimientos={[movimiento]} filtros={{ texto: "A1", tipo: "entradas" }} />);
  else render(<BitacoraTesoreriaExportButtons facturaId="entidad-a" folio="FP-1" proveedor="Proveedor sintético" filas={filas} filtrosAplicados="Sólo pagos eliminados" />);
  fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
}

beforeEach(() => {
  invalidarEmisorCache();
  h.current = createHistoricalReadMock();
  setAuthSnapshot({ userId: "synthetic-user", email: null, organizationId: null, organizationName: "Perfil ajeno",
    role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "synthetic-user", organizationId: "org-a" });
  h.current.tables.organizations = [{ id: "org-a", nombre: "Comercial A actual" }];
  h.current.tables.configuracion = [];
  for (const { table } of consumers) h.current.tables[table] = [{ id: "entidad-a", organization_id: "org-a", deleted_at: "2026-10-01T00:00:00Z" }];
});

describe("consumidores PDF: DTO disponible y entidad dada de baja", () => {
  it.each(consumers)("$kind conserva datos y límites usando el resolver real", async ({ kind, table }) => {
    await start(kind);
    await waitFor(() => expect(h.download).toHaveBeenCalledOnce());
    const props = h.download.mock.calls[0][0].props;
    expect(props.emisor).toMatchObject({ organizacionNombre: "Comercial A actual", razonSocial: "Empresa", rfc: "" });
    expect(h.current!.calls.map((c) => c.table)).toEqual([table, "configuracion", "organizations"]);
    expect(h.current!.calls[0]).toMatchObject({ columns: "id, organization_id", filters: [
      { method: "eq", column: "id", value: "entidad-a" }, { method: "eq", column: "organization_id", value: "org-a" },
    ] });
    expect(h.current!.supabase.rpc.mock.calls).toEqual([["org_scope"]]);
    if (kind === "proveedor") {
      expect(props).toMatchObject({ desde: "2026-09-01", hasta: "2026-09-30", hayMas: true, totalMovimientos: 501,
        saldoApertura: [{ moneda: "MXN", saldo: "100" }], saldos: [{ saldo: "106.00" }], movimientos: [{ saldo: "103.00" }] });
    } else if (kind === "banco") {
      expect(props).toMatchObject({ filas: [{ referencia: "A1", saldo: "MXN 1,016.00" }],
        resumen: { saldoInicial: "MXN 1,000.00", saldoFinal: "MXN 1,016.00", cobertura: expect.stringContaining("No hay cobertura histórica anterior") },
        alcance: { filtro: "Búsqueda: A1 | Tipo: entradas", movimientosVisibles: 1, movimientosPeriodo: 2, salidas: "MXN 0.00" } });
    } else {
      expect(props.filas).toBe(filas);
      expect(props).toMatchObject({ folio: "FP-1", filtrosAplicados: "Sólo pagos eliminados" });
    }
    expect(h.error).not.toHaveBeenCalled();
  });

  it.each(consumers)("$kind no descarga ni anuncia éxito ante error de identidad", async ({ kind, table, method }) => {
    h.current!.errors.set(`${table}:0`, { code: "42501", message: "identidad inaccesible" });
    await start(kind);
    await waitFor(() => expect(h.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ method })));
    expect(h.download).not.toHaveBeenCalled();
    expect(h.success).not.toHaveBeenCalled();
    expect(h.current!.calls.map((c) => c.table)).toEqual([table]);
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it.each(consumers)("$kind cancela antes de descargar si cambia el ámbito durante Promise.all", async ({ kind, table, method }) => {
    let release!: () => void;
    h.current!.delays.set(table, new Promise<void>((resolve) => { release = resolve; }));
    const pending = start(kind);
    await waitFor(() => expect(h.current!.calls[0]?.table).toBe(table));
    syncActiveOrganizationScope({ userId: "synthetic-user", organizationId: "org-b" });
    release();
    await pending;
    await waitFor(() => expect(h.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ method,
      error: expect.objectContaining({ name: "AuthOperationChangedError" }),
    })));
    expect(h.download).not.toHaveBeenCalled();
    expect(h.success).not.toHaveBeenCalled();
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });
});
