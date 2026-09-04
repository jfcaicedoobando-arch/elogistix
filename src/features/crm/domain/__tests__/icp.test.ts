import { describe, it, expect } from "vitest";
import {
  toLeadIcpForm,
  toLeadIcpPatch,
  isLeadIcpDirty,
  completitudIcp,
  EMPTY_LEAD_ICP_FORM,
} from "@/features/crm/domain/leads/icp";

describe("perfil ICP del lead", () => {
  it("normaliza nulls a cadena vacía", () => {
    const form = toLeadIcpForm({ sector: null, mercancia: "Autopartes", anios_establecida: 8 });
    expect(form.sector).toBe("");
    expect(form.mercancia).toBe("Autopartes");
    expect(form.anios_establecida).toBe("8");
    expect(form.estatus_icp).toBe("Sin calificar");
  });

  it("convierte el formulario a patch con nulls y años numéricos", () => {
    const patch = toLeadIcpPatch({ ...EMPTY_LEAD_ICP_FORM, sector: " Agro ", anios_establecida: "12" });
    expect(patch.sector).toBe("Agro");
    expect(patch.anios_establecida).toBe(12);
    expect(patch.mercancia).toBeNull();
  });

  it("deja años en null cuando viene vacío", () => {
    expect(toLeadIcpPatch(EMPTY_LEAD_ICP_FORM).anios_establecida).toBeNull();
  });

  it("detecta cambios respecto a la fila persistida", () => {
    const row = { sector: "Agro" };
    expect(isLeadIcpDirty(row, toLeadIcpForm(row))).toBe(false);
    expect(isLeadIcpDirty(row, { ...toLeadIcpForm(row), rutas: "SHA→MZO" })).toBe(true);
  });

  it("calcula completitud sobre los campos mínimos", () => {
    expect(completitudIcp(null)).toBe(0);
    expect(
      completitudIcp({
        sector: "Agro",
        mercancia: "Granos",
        rutas: "SHA→MZO",
        volumen: "3x40HC",
        frecuencia: "Mensual",
        dolor_explicito: "Demoras",
        proveedor_actual: "Otro forwarder",
      }),
    ).toBe(1);
    expect(completitudIcp({ sector: "Agro", mercancia: "Granos", rutas: "SHA→MZO" })).toBeCloseTo(3 / 7);

  });
});
