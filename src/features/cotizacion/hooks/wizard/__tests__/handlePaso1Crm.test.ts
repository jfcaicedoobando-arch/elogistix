/**
 * Cobertura de ramas para handlePaso1Crm: validadores individuales
 * (cliente/prospecto/terrestre) y vincularCrmTrasCrear (éxito y falla suave).
 * La política tarifa-first ya se cubre en validatePaso1.tarifaFirst.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertSpy = vi.fn().mockResolvedValue({ error: null });
const fromSpy = vi.fn((_table: string) => ({ insert: insertSpy }));
const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "u-1", email: "t@t.mx" } } });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
    from: (table: string) => fromSpy(table),
  },
}));
vi.mock("@/lib/supabase/cast", () => ({ toDbJson: <T,>(x: T) => x }));

const obtenerUsuarioActualMock = vi.fn();
const fetchCotizacionFolioMock = vi.fn();
const registrarBloqueoSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/cotizacion/services/wizard/paso1Crm", () => ({
  obtenerUsuarioActual: (...args: unknown[]) => obtenerUsuarioActualMock(...args),
  fetchCotizacionFolio: (...args: unknown[]) => fetchCotizacionFolioMock(...args),
  registrarBloqueoSinTarifa: (...args: unknown[]) => registrarBloqueoSpy(...args),
}));

const vincularOCrearOportunidadMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/crm/services/vincularCotizacion", () => ({
  vincularOCrearOportunidadParaCotizacion: (...args: unknown[]) => vincularOCrearOportunidadMock(...args),
}));

const notifyErrorMock = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: (...args: unknown[]) => notifyErrorMock(...args) }));

import {
  validateCliente,
  validateProspecto,
  validateTerrestre,
  vincularCrmTrasCrear,
} from "../handlePaso1Crm";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";

const base = (over: Partial<CotizacionFormValues> = {}): CotizacionFormValues =>
  ({
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
    ...over,
  } as unknown as CotizacionFormValues);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateCliente", () => {
  it("error cuando no es prospecto y falta clienteId", () => {
    expect(validateCliente(base({ clienteId: "" }))).toBe("Selecciona un cliente");
  });

  it("null cuando no es prospecto y hay clienteId", () => {
    expect(validateCliente(base({ clienteId: "cli-1" }))).toBeNull();
  });

  it("null cuando es prospecto (no aplica esta regla)", () => {
    expect(validateCliente(base({ esProspecto: true, clienteId: "" }))).toBeNull();
  });
});

describe("validateProspecto", () => {
  it("null cuando no es prospecto", () => {
    expect(validateProspecto(base({ esProspecto: false }))).toBeNull();
  });

  it("error al vincular sin oportunidadId ni leadId", () => {
    expect(
      validateProspecto(
        base({ esProspecto: true, prospectoModo: "vincular", oportunidadId: "", leadId: "" }),
      ),
    ).toMatch(/lead u oportunidad/i);
  });

  it("null al vincular con oportunidadId capturado", () => {
    expect(
      validateProspecto(
        base({
          esProspecto: true,
          prospectoModo: "vincular",
          oportunidadId: "op-1",
          leadId: "",
          prospectoEmpresa: "ACME",
        }),
      ),
    ).toBeNull();
  });

  it("null al vincular con leadId capturado", () => {
    expect(
      validateProspecto(
        base({
          esProspecto: true,
          prospectoModo: "vincular",
          oportunidadId: "",
          leadId: "lead-1",
          prospectoEmpresa: "ACME",
        }),
      ),
    ).toBeNull();
  });

  it("error cuando falta la empresa del prospecto", () => {
    expect(
      validateProspecto(
        base({ esProspecto: true, prospectoModo: "nuevo", prospectoEmpresa: "  " }),
      ),
    ).toMatch(/empresa del prospecto/i);
  });

  it("error cuando modo nuevo y falta el contacto", () => {
    expect(
      validateProspecto(
        base({
          esProspecto: true,
          prospectoModo: "nuevo",
          prospectoEmpresa: "ACME",
          prospectoContacto: "  ",
        }),
      ),
    ).toMatch(/contacto del prospecto/i);
  });

  it("null cuando modo nuevo con empresa y contacto capturados", () => {
    expect(
      validateProspecto(
        base({
          esProspecto: true,
          prospectoModo: "nuevo",
          prospectoEmpresa: "ACME",
          prospectoContacto: "Juan",
        }),
      ),
    ).toBeNull();
  });
});

describe("validateTerrestre", () => {
  it("null cuando el modo no es Terrestre", () => {
    expect(validateTerrestre(base({ modo: "Marítimo" }))).toBeNull();
  });

  it("error cuando falta la modalidad de equipo", () => {
    expect(
      validateTerrestre(base({ modo: "Terrestre", modalidadEquipo: "" } as never)),
    ).toMatch(/modalidad de equipo/i);
  });

  it("error cuando modalidad Porta Contenedor sin punto intermedio", () => {
    expect(
      validateTerrestre(
        base({
          modo: "Terrestre",
          modalidadEquipo: "Porta Contenedor",
          puntoIntermedio: "",
        } as never),
      ),
    ).toMatch(/punto de carga\/descarga/i);
  });

  it("null cuando modalidad Porta Contenedor con punto intermedio capturado", () => {
    expect(
      validateTerrestre(
        base({
          modo: "Terrestre",
          modalidadEquipo: "Porta Contenedor",
          puntoIntermedio: "Km 10",
        } as never),
      ),
    ).toBeNull();
  });

  it("null cuando modalidad distinta de Porta Contenedor sin punto intermedio", () => {
    expect(
      validateTerrestre(
        base({ modo: "Terrestre", modalidadEquipo: "Caja Seca", puntoIntermedio: "" } as never),
      ),
    ).toBeNull();
  });
});

describe("vincularCrmTrasCrear", () => {
  it("vincula la oportunidad con el usuario, folio y datos del prospecto", async () => {
    obtenerUsuarioActualMock.mockResolvedValue({ id: "u-1", email: "t@t.mx" });
    fetchCotizacionFolioMock.mockResolvedValue("COT-100");

    await vincularCrmTrasCrear(
      "cot-1",
      base({
        esProspecto: true,
        prospectoEmpresa: "ACME",
        prospectoContacto: "Juan",
        prospectoEmail: "juan@acme.com",
        prospectoTelefono: "555",
        oportunidadId: "op-1",
        leadId: "",
        modo: "Marítimo",
      }),
    );

    expect(vincularOCrearOportunidadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cotizacionId: "cot-1",
        cotizacionFolio: "COT-100",
        modoTransporte: "Marítimo",
        oportunidadId: "op-1",
        leadId: null,
        prospecto: expect.objectContaining({ empresa: "ACME", contacto: "Juan" }),
        user: { id: "u-1", email: "t@t.mx" },
      }),
    );
    expect(notifyErrorMock).not.toHaveBeenCalled();
  });

  it("usa folio undefined cuando fetchCotizacionFolio devuelve null", async () => {
    obtenerUsuarioActualMock.mockResolvedValue(null);
    fetchCotizacionFolioMock.mockResolvedValue(null);

    await vincularCrmTrasCrear("cot-2", base());

    expect(vincularOCrearOportunidadMock).toHaveBeenCalledWith(
      expect.objectContaining({ cotizacionFolio: undefined, oportunidadId: null, leadId: null, user: null }),
    );
  });

  it("notifica el error sin relanzarlo cuando falla la vinculación CRM", async () => {
    obtenerUsuarioActualMock.mockResolvedValue({ id: "u-1", email: undefined });
    fetchCotizacionFolioMock.mockResolvedValue("COT-1");
    const err = new Error("boom");
    vincularOCrearOportunidadMock.mockRejectedValueOnce(err);

    await expect(vincularCrmTrasCrear("cot-3", base())).resolves.toBeUndefined();

    expect(notifyErrorMock).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        title: "Cotización guardada, pero falló el vínculo CRM",
        method: "VINCULAR_OPORTUNIDAD_CRM",
        context: { cotizacionId: "cot-3" },
      }),
    );
  });
});
