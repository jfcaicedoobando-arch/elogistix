/**
 * R170-09: "Timbrar factura" debe depender del permiso específico
 * EMITIR_FACTURA_CLIENTE (`puedeEmitir`), no del `canEdit` genérico —
 * un coordinador logístico tiene `canEdit` (operaciones) pero no debe
 * poder timbrar.
 */
import { describe, it, expect, vi } from "vitest";
import { buildPrimary } from "../FacturaDetalleActionsBar";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";
import type { deriveFacturaFlags } from "@/features/facturacion/domain/facturaFlags";

type Flags = ReturnType<typeof deriveFacturaFlags>;

const flagsBase: Flags = {
  sinTimbrar: true,
  esBorrador: true,
  puedeEditarBorrador: true,
  puedeEliminarBorrador: true,
  puedeTimbrarDesdeSistema: true,
  puedeRegistrarPago: false,
  repPendiente: false,
  estaCancelada: false,
  puedeSustituirCfdi: false,
  puedeCancelarCfdi: false,
  puedeRefacturarReceptor: false,
} as Flags;

function buildProps(overrides: { canEdit: boolean; puedeEmitir: boolean }) {
  return {
    factura: {} as FacturaDetalle,
    canEdit: overrides.canEdit,
    puedeEmitir: overrides.puedeEmitir,
    flags: flagsBase,
    acuse: {} as ReturnType<typeof vi.fn> as never,
    eliminando: false,
    puedeEliminarBorrador: true,
    onTimbrar: vi.fn(),
    onEnviarEmail: vi.fn(),
    onRegistrarPago: vi.fn(),
    onTimbrarRep: vi.fn(),
    onSustituir: vi.fn(),
    onRefacturar: vi.fn(),
    onCancelar: vi.fn(),
    onEliminar: vi.fn(),
    onConsultar: vi.fn(),
    onDownload: vi.fn(),
  };
}

describe("FacturaDetalleActionsBar — buildPrimary", () => {
  it("contador/admin (puedeEmitir=true) ven 'Timbrar factura'", () => {
    const primary = buildPrimary(buildProps({ canEdit: true, puedeEmitir: true }));
    expect(primary?.id).toBe("timbrar");
  });

  it("coordinador logístico (canEdit=true, puedeEmitir=false) NO ve 'Timbrar factura'", () => {
    const primary = buildPrimary(buildProps({ canEdit: true, puedeEmitir: false }));
    expect(primary?.id).not.toBe("timbrar");
  });
});
