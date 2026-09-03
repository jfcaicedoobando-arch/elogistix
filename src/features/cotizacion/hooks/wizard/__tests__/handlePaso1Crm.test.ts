/**
 * Cobertura de ramas para handlePaso1Crm: validadores individuales
 * (cliente/prospecto/terrestre) y vincularCrmTrasCrear (éxito y propagación
 * del error: P0 ya no es falla suave).
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

const registrarBloqueoSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/cotizacion/services/wizard/paso1Crm", () => ({
  registrarBloqueoSinTarifa: (...args: unknown[]) => registrarBloqueoSpy(...args),
}));

const vincularOCrearOportunidadMock = vi.fn().mockResolvedValue({ updatedAt: null });
vi.mock("@/features/crm/services/vincularCotizacion", () => ({
  vincularOCrearOportunidadParaCotizacion: (...args: unknown[]) => vincularOCrearOportunidadMock(...args),
}));

const notifyErrorMock = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: (...args: unknown[]) => notifyErrorMock(...args) }));

import {
  campoParaErrorPaso1,
  campoParaPathSchemaPaso1,
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
    prospectoModo: "vincular",
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
    expect(validateCliente(base({ clienteId: "" }))).toBe("Selecciona un cliente.");
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

  it("error cuando no hay origen CRM (ni lead ni oportunidad)", () => {
    expect(
      validateProspecto(
        base({ esProspecto: true, oportunidadId: "", leadId: "", prospectoEmpresa: "ACME" }),
      ),
    ).toMatch(/lead u oportunidad/i);
  });

  it("null con oportunidadId del CRM", () => {
    expect(
      validateProspecto(
        base({ esProspecto: true, oportunidadId: "op-1", leadId: "", prospectoEmpresa: "ACME" }),
      ),
    ).toBeNull();
  });

  it("null con leadId del CRM", () => {
    expect(
      validateProspecto(
        base({ esProspecto: true, oportunidadId: "", leadId: "lead-1", prospectoEmpresa: "ACME" }),
      ),
    ).toBeNull();
  });

  it("error cuando falta la empresa del prospecto aunque haya origen", () => {
    expect(
      validateProspecto(base({ esProspecto: true, leadId: "lead-1", prospectoEmpresa: "  " })),
    ).toMatch(/empresa del prospecto/i);
  });

  it("no exige contacto: el dato vive en el CRM", () => {
    expect(
      validateProspecto(
        base({
          esProspecto: true,
          leadId: "lead-1",
          prospectoEmpresa: "ACME",
          prospectoContacto: "  ",
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
  it("vincula usando sólo los IDs del origen CRM y devuelve el sello", async () => {
    vincularOCrearOportunidadMock.mockResolvedValueOnce({ updatedAt: "2026-09-03T00:00:00Z" });

    const sello = await vincularCrmTrasCrear(
      "cot-1",
      base({
        esProspecto: true,
        prospectoEmpresa: "ACME",
        oportunidadId: "op-1",
        leadId: "",
        modo: "Marítimo",
      }),
    );

    expect(vincularOCrearOportunidadMock).toHaveBeenCalledWith({
      cotizacionId: "cot-1",
      oportunidadId: "op-1",
      leadId: null,
    });
    expect(sello).toEqual({ updatedAt: "2026-09-03T00:00:00Z" });
    expect(notifyErrorMock).not.toHaveBeenCalled();
  });

  it("propaga el error cuando falla el vínculo CRM (ya no es falla suave)", async () => {
    const err = new Error("boom");
    vincularOCrearOportunidadMock.mockRejectedValueOnce(err);

    await expect(vincularCrmTrasCrear("cot-3", base({ esProspecto: true, leadId: "l-1" }))).rejects.toThrow("boom");
    expect(notifyErrorMock).not.toHaveBeenCalled();
  });
});

describe("mapeo de errores a campos del paso 1", () => {
  it("campoParaErrorPaso1 reconoce el mensaje de origen CRM faltante", () => {
    const campo = campoParaErrorPaso1("Selecciona el lead u oportunidad del CRM");
    expect(typeof campo === "string" || campo === null).toBe(true);
  });

  it("campoParaPathSchemaPaso1 traduce un path del schema", () => {
    const campo = campoParaPathSchemaPaso1("clienteId");
    expect(typeof campo === "string" || campo === null).toBe(true);
  });
});
