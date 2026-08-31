import { describe, it, expect } from "vitest";
import {
  usdFormatter,
  buildInitialForm,
  calcularTotal,
  esFormValido,
  computeValido,
  getTituloModal,
  calcularErrores,
  camposFaltantes,
  computeGuardarLabel,
} from "../TarifaForm.helpers";
import type { TarifaInput } from "@/features/costeo/services/tarifas";

const baseForm: TarifaInput = {
  agente_id: "a", naviera_id: "n", ruta_id: "r", tipo_contenedor_id: "t",
  flete_base: 1000, dias_libres_demoras: 7,
  vigente_desde: "2026-07-01", vigente_hasta: "2026-08-01",
  transit_time_dias: null, notas: "", recargos: [],
};

describe("usdFormatter", () => {
  it("formatea número como USD", () => {
    expect(usdFormatter(1000)).toContain("1,000");
  });
});

describe("buildInitialForm", () => {
  it("usa defaults con vigencia hoy/+30", () => {
    const f = buildInitialForm();
    expect(f.agente_id).toBe("");
    expect(f.vigente_desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(f.vigente_hasta).getTime()).toBeGreaterThan(new Date(f.vigente_desde).getTime());
  });

  it("mezcla overrides sobre defaults", () => {
    const f = buildInitialForm({ agente_id: "x", flete_base: 500 });
    expect(f.agente_id).toBe("x");
    expect(f.flete_base).toBe(500);
  });
});

describe("calcularTotal (TarifaForm)", () => {
  it("suma flete + recargos incluidos", () => {
    const total = calcularTotal({
      ...baseForm,
      recargos: [
        { concepto: "BAF", monto: 100, moneda: "USD", incluido_en_total: true },
        { concepto: "CAF", monto: 50, moneda: "USD", incluido_en_total: false },
      ] as TarifaInput["recargos"],
    });
    expect(total).toBe(1100);
  });

  it("ignora recargos NaN", () => {
    const total = calcularTotal({
      ...baseForm,
      recargos: [{ concepto: "X", monto: "abc" as unknown as number, moneda: "USD", incluido_en_total: true }] as TarifaInput["recargos"],
    });
    expect(total).toBe(1000);
  });
});

describe("esFormValido", () => {
  it("valida form completo", () => {
    expect(esFormValido(baseForm)).toBe(true);
  });
  it("falla sin agente", () => {
    expect(esFormValido({ ...baseForm, agente_id: "" })).toBe(false);
  });
  it("falla con flete <= 0", () => {
    expect(esFormValido({ ...baseForm, flete_base: 0 })).toBe(false);
  });
  it("skipRutaId omite validación de ruta", () => {
    expect(esFormValido({ ...baseForm, ruta_id: "" }, { skipRutaId: true })).toBe(true);
  });
  it("falla si vigente_desde > vigente_hasta", () => {
    expect(esFormValido({ ...baseForm, vigente_desde: "2026-09-01" })).toBe(false);
  });
});

describe("computeValido", () => {
  it("respeta baseValido en modo simple", () => {
    expect(computeValido(true, false, 0)).toBe(true);
    expect(computeValido(false, false, 5)).toBe(false);
  });
  it("requiere rutas > 0 en modo múltiple", () => {
    expect(computeValido(true, true, 0)).toBe(false);
    expect(computeValido(true, true, 2)).toBe(true);
  });
});

describe("getTituloModal", () => {
  it("usa override si viene definido", () => {
    expect(getTituloModal("X", true)).toBe("X");
  });
  it("cambia según edición", () => {
    expect(getTituloModal(undefined, true)).toContain("Editar");
    expect(getTituloModal(undefined, false)).toContain("Nueva");
  });
});

describe("calcularErrores", () => {
  it("marca errores en campos vacíos", () => {
    const errs = calcularErrores({ ...baseForm, agente_id: "" }, 0, false);
    expect(errs.agente_id).toBe(true);
    expect(errs.naviera_id).toBe(false);
  });
  it("modo múltiple valida rutaIdsCount", () => {
    const errs = calcularErrores(baseForm, 0, true);
    expect(errs.ruta_id).toBe(true);
  });
});

describe("camposFaltantes", () => {
  it("mapea keys a etiquetas legibles", () => {
    const errs = calcularErrores({ ...baseForm, agente_id: "", flete_base: 0 }, 1, false);
    const faltantes = camposFaltantes(errs);
    expect(faltantes).toContain("Agente");
    expect(faltantes).toContain("Flete base");
  });
});

describe("computeGuardarLabel", () => {
  it('devuelve "Guardando…" cuando pendiente', () => {
    expect(computeGuardarLabel({ pendiente: true, esEdicion: false, rutasCount: 1 })).toBe("Guardando…");
  });
  it("etiqueta de edición", () => {
    expect(computeGuardarLabel({ pendiente: false, esEdicion: true, rutasCount: 5 })).toBe("Guardar cambios");
  });
  it("pluraliza cuando rutasCount > 1", () => {
    expect(computeGuardarLabel({ pendiente: false, esEdicion: false, rutasCount: 3 })).toBe("Guardar 3 tarifas");
  });
  it("singular en creación simple", () => {
    expect(computeGuardarLabel({ pendiente: false, esEdicion: false, rutasCount: 1 })).toBe("Guardar tarifa");
  });
});

describe("esTarifaSucia", () => {
  const base = buildInitialForm();

  it("sin captura no está sucia", () => {
    expect(esTarifaSucia({ ...base }, base, [], [])).toBe(false);
  });

  it("capturar Notas la marca sucia", () => {
    expect(esTarifaSucia({ ...base, notas: "Sin trasbordo" }, base, [], [])).toBe(true);
  });

  it("elegir rutas la marca sucia", () => {
    expect(esTarifaSucia({ ...base }, base, ["r1"], [])).toBe(true);
  });

  it("mismas rutas en otro orden no ensucian", () => {
    expect(esTarifaSucia({ ...base }, base, ["r2", "r1"], ["r1", "r2"])).toBe(false);
  });
});
