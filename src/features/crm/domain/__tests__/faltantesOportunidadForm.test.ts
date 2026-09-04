/**
 * Hallazgo CRM 1280x720: "Crear oportunidad" quedaba habilitado sin origen ni
 * Nombre. `faltantesOportunidadForm` es la fuente única del candado del botón
 * y del aviso accesible; cubre los dos orígenes (prospecto y cliente).
 */
import { describe, it, expect } from "vitest";
import { faltantesOportunidadForm } from "@/features/crm/domain/oportunidadFormPayload";
import { EMPTY_OPORTUNIDAD } from "@/features/crm/domain/oportunidadFormState";
import type { OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";

const base = (patch: Partial<OportunidadFormState>): OportunidadFormState => ({
  ...EMPTY_OPORTUNIDAD,
  etapa_id: "e-ab",
  ...patch,
});

describe("faltantesOportunidadForm", () => {
  it("origen prospecto: exige prospecto y nombre", () => {
    expect(faltantesOportunidadForm(base({ origen_tipo: "prospecto" }))).toEqual([
      "prospecto de origen",
      "nombre de la oportunidad",
    ]);
  });

  it("origen cliente: exige cliente y nombre", () => {
    expect(faltantesOportunidadForm(base({ origen_tipo: "cliente" }))).toEqual([
      "cliente de origen",
      "nombre de la oportunidad",
    ]);
  });

  it("prospecto completo no reporta faltantes", () => {
    expect(
      faltantesOportunidadForm(
        base({ origen_tipo: "prospecto", lead_id: "l-1", nombre: "Oportunidad Acme" }),
      ),
    ).toEqual([]);
  });

  it("cliente completo no reporta faltantes", () => {
    expect(
      faltantesOportunidadForm(
        base({ origen_tipo: "cliente", cliente_id: "c-1", nombre: "Oportunidad Acme" }),
      ),
    ).toEqual([]);
  });

  it("sin etapa abierta lo reporta como faltante", () => {
    expect(
      faltantesOportunidadForm(
        base({ origen_tipo: "cliente", cliente_id: "c-1", nombre: "X", etapa_id: "" }),
      ),
    ).toContain("etapa abierta del pipeline");
  });
});
