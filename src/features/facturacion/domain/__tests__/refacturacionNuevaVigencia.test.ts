import { estadoFacturaNueva } from "../refacturacionNuevaVigencia";
import { describe, expect, it } from "vitest";
import { bloqueoPaso, facturaNuevaLista, originalFueraDeCirculacion, type ContextoPasos } from "../refacturacionPasos";
const nueva = { id: "nueva", numero: "F2", estado: "Emitida", uuid_fiscal: "uuid", deleted_at: null };
const ctx: ContextoPasos = { casoAbierto: true, clienteDestinoId: "c", motivo: "m", pagos: [], facturaNueva: nueva, original: { ...nueva, estado: "Cancelada", deleted_at: "2026-01-01" }, pagoSeleccionadoId: "p", pagoYaReasignado: false };
describe("refacturación: vigencia de la nueva no borra la evidencia fiscal", () => {
  it("acepta únicamente vigencia explícita", () => {
    expect(facturaNuevaLista(nueva)).toBe(true);
    expect(facturaNuevaLista({ ...nueva, deleted_at: "2026-01-01" })).toBe(false);
    expect(facturaNuevaLista({ ...nueva, deleted_at: undefined })).toBe(false);
  });
  it.each(["Cancelada", "Sustituida"])("conserva original %s incluso de baja", (estado) => {
    expect(originalFueraDeCirculacion({ ...nueva, estado, deleted_at: "2026-01-01" })).toBe(true);
    expect(bloqueoPaso(4, { ...ctx, original: { ...nueva, estado, deleted_at: "2026-01-01" } })).toBeNull();
  });
  it.each([3, 4, 5])("bloquea paso %i con nueva eliminada aun si el pago ya fue reasignado", (paso) => {
    expect(bloqueoPaso(paso, { ...ctx, facturaNueva: { ...nueva, deleted_at: "2026-01-01" }, pagoYaReasignado: true })).not.toBeNull();
  });
  it.each([3, 4, 5])("bloquea paso %i con caché viva y error de consulta", (paso) => {
    expect(bloqueoPaso(paso, { ...ctx, bloqueoFacturaNueva: "No se pudo verificar la nueva factura." })).toContain("verificar");
  });
});


describe("revocación observada durante lecturas superpuestas", () => {
  it.each([
    ["baja", { ...nueva, deleted_at: "2026-10-13" }, false, "eliminada"],
    ["error", nueva, true, "error"],
    ["ausencia", null, false, "ausente"],
    ["vigencia desconocida", { ...nueva, deleted_at: undefined }, false, "desconocida"],
  ] as const)("%s prevalece sobre refetch de caso y nueva", (_label, factura, error, expected) => {
    expect(estadoFacturaNueva({ casoDisponible: true, casoCargando: true, casoError: false,
      facturaNuevaId: "nueva", factura, error, cargando: true })).toBe(expected);
  });
  it("distingue carga inicial de ausencia confirmada sin ofrecer creación", () => {
    expect(estadoFacturaNueva({ casoDisponible: true, casoCargando: false, casoError: false,
      facturaNuevaId: "nueva", factura: undefined, error: false, cargando: true })).toBe("verificando");
  });
});
