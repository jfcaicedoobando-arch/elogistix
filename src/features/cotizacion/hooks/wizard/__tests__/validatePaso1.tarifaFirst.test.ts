/**
 * v13.36.0 — Tests de política tarifa-first.
 * Verifican que en modo Marítimo el wizard NO permita continuar sin `tarifaId`
 * y registre el bloqueo en bitácora (best-effort).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertSpy = vi.fn().mockResolvedValue({ error: null });
const fromSpy = vi.fn((_table: string) => ({ insert: insertSpy }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1", email: "t@t.mx" } } }) },
    from: (table: string) => fromSpy(table),
  },
}));
vi.mock("@/lib/supabase/cast", () => ({ toDbJson: <T,>(x: T) => x }));
const registrarBloqueoSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/cotizacion/services/wizard/paso1Crm", () => ({
  obtenerUsuarioActual: vi.fn(),
  fetchCotizacionFolio: vi.fn(),
  registrarBloqueoSinTarifa: (...args: unknown[]) => registrarBloqueoSpy(...args),
}));
vi.mock("@/features/crm/services/vincularCotizacion", () => ({
  vincularOCrearOportunidadParaCotizacion: vi.fn(),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));

import { validatePaso1 } from "../handlePaso1Crm";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";

const base = (over: Partial<CotizacionFormValues> = {}): CotizacionFormValues => ({
  esProspecto: false,
  clienteId: "cli-1",
  prospectoModo: "nuevo",
  prospectoEmpresa: "",
  prospectoContacto: "",
  prospectoEmail: "",
  prospectoTelefono: "",
  oportunidadId: "",
  leadId: "",
  modo: "Marítimo",
  origen: "MXVER",
  destino: "CNSHA",
  tipoContenedor: "tc-1",
  tarifaId: "",
  ...over,
} as unknown as CotizacionFormValues);

beforeEach(() => { vi.clearAllMocks(); });

describe("validatePaso1 — política tarifa-first (Marítimo)", () => {
  it("BLOQUEA cuando modo=Marítimo y tarifaId está vacío", () => {
    const err = validatePaso1(base({ tarifaId: "" }));
    expect(err).toMatch(/tarifa marítima/i);
  });

  it("registra el bloqueo en bitácora (best-effort)", async () => {
    validatePaso1(base({ tarifaId: "" }));
    // registrarBloqueoSinTarifa se dispara con `void`; esperamos al microtask.
    await new Promise((r) => setTimeout(r, 0));
    expect(registrarBloqueoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ origen: "MXVER", destino: "CNSHA" }),
    );
  });

  it("PERMITE avanzar cuando hay tarifaId vinculado", () => {
    const err = validatePaso1(base({ tarifaId: "tar-123" }));
    expect(err).toBeNull();
  });

  it("NO aplica el bloqueo en modo Aéreo ni Terrestre", () => {
    expect(validatePaso1(base({ modo: "Aéreo", tarifaId: "" }) as never)).toBeNull();
    // Terrestre requiere modalidadEquipo; lo aportamos para aislar el bloqueo marítimo.
    expect(
      validatePaso1(
        base({ modo: "Terrestre", tarifaId: "", modalidadEquipo: "Caja Seca" } as never),
      ),
    ).toBeNull();
  });

  it("PERMITE avanzar en Marítimo sin tarifa cuando el incoterm transfiere el flete al shipper (CIF/CFR/CIP/CPT/DAP/DDP/DAT)", () => {
    for (const inco of ["CIF", "CFR", "CIP", "CPT", "DAP", "DDP", "DAT"]) {
      expect(
        validatePaso1(base({ tarifaId: "", incoterm: inco } as never)),
      ).toBeNull();
    }
  });

  it("SIGUE bloqueando en Marítimo + FOB/EXW/FCA sin tarifa", () => {
    for (const inco of ["FOB", "EXW", "FCA"]) {
      expect(
        validatePaso1(base({ tarifaId: "", incoterm: inco } as never)),
      ).toMatch(/tarifa marítima/i);
    }
  });
});
