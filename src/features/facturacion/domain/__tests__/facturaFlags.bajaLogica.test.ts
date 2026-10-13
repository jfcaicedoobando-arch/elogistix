import { describe, expect, it } from "vitest";
import { deriveFacturaFlags, type FacturaFlagsInput } from "../facturaFlags";
import { esFacturaVigenteParaOperar } from "../facturaVigencia";

const operaciones = ["puedeEditarBorrador", "puedeEliminarBorrador", "puedeTimbrarDesdeSistema", "puedeCancelarCfdi", "puedeSustituirCfdi", "puedeRefacturarReceptor", "puedeRegistrarPago"] as const;
const factura = (estado: string, deleted_at?: string | null): FacturaFlagsInput => ({
  estado, deleted_at, fecha_emision: "2026-10-03", facturapi_id: null,
  uuid_fiscal: estado === "Borrador" ? null : "uuid-historico",
});

describe("vigencia de factura independiente de permisos y estado fiscal", () => {
  it.each(["Borrador", "Emitida", "Vencida", "Parcialmente pagada", "Pagada"])("%s de baja no permite operaciones aunque tenga permisos, saldo y REP", (estado) => {
    const f = factura(estado, "2026-10-10T10:00:00Z");
    const flags = deriveFacturaFlags(f, true, { saldo: 100, pagosActivos: 1, pagosRepPendientes: 1 }, true);
    for (const accion of operaciones) expect(flags[accion], accion).toBe(false);
    expect(flags.esBorrador).toBe(estado === "Borrador");
    expect(flags.sinTimbrar).toBe(estado === "Borrador");
    expect(flags.repPendiente).toBe(true); // dato histórico, no permiso de timbrado
    expect(f.estado).toBe(estado);
  });
  it.each([undefined, ""])("deleted_at=%s no confirma vigencia", (deleted_at) => {
    for (const estado of ["Borrador", "Emitida"]) {
      const flags = deriveFacturaFlags(factura(estado, deleted_at), true, { saldo: 100 }, true);
      for (const accion of operaciones) expect(flags[accion], accion).toBe(false);
    }
    expect(esFacturaVigenteParaOperar({ deleted_at })).toBe(false);
  });
  it("un DTO que omite el campo también falla cerrado", () => {
    const flags = deriveFacturaFlags({ estado: "Borrador", fecha_emision: "2026-10-03" }, true);
    expect(flags.puedeTimbrarDesdeSistema).toBe(false);
    expect(flags.puedeEditarBorrador).toBe(false);
  });
  it("vigentes conservan acciones anteriores y sus permisos separados", () => {
    const borrador = deriveFacturaFlags(factura("Borrador", null), true);
    expect(borrador.puedeEditarBorrador).toBe(true);
    expect(borrador.puedeEliminarBorrador).toBe(true);
    expect(borrador.puedeTimbrarDesdeSistema).toBe(true);
    const emitida = deriveFacturaFlags(factura("Emitida", null), true, { saldo: 100 });
    expect(emitida.puedeRegistrarPago).toBe(true);
    expect(emitida.puedeCancelarCfdi).toBe(true);
    expect(emitida.puedeSustituirCfdi).toBe(true);
    expect(emitida.puedeRefacturarReceptor).toBe(true);
    const cobroSinEdicion = deriveFacturaFlags(factura("Emitida", null), false, { saldo: 100 }, true);
    expect(cobroSinEdicion.puedeRegistrarPago).toBe(true);
    expect(cobroSinEdicion.puedeSustituirCfdi).toBe(false);
    expect(deriveFacturaFlags(factura("Emitida", null), true, { saldo: 100 }, false).puedeRegistrarPago).toBe(false);
  });
});
