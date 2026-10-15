import { describe, expect, it } from "vitest";
import { getErrorMessage, translateLcCode } from "@/lib/errors";

const cases = [
  ["LC_CARGOS_IVA_SCHEMA_DRIFT", "No se pudo actualizar la configuración de IVA de los cargos porque la base de datos no coincide con la versión esperada. Solicita una revisión técnica antes de continuar."],
  ["LC_CRM_EMPRESA_ES_CLIENTE", "Esta empresa ya es cliente y no se puede eliminar. Conserva su registro y sus vínculos."],
  ["LC_SEED_DEMO_APROBADOR_REQUERIDO", "No se puede preparar la demostración sin una sesión que identifique al aprobador. Solicita una revisión técnica antes de continuar."],
  ["LC_SEED_DEMO_CRM_IDENTIDAD_INSEGURA", "No se pueden preparar los datos de demostración porque un vínculo entre empresa CRM y cliente no es válido. Solicita una revisión técnica antes de continuar."],
  ["LC_SEED_DEMO_IDENTIDAD_AMBIGUA", "Hay registros de clientes o contactos duplicados o eliminados en los datos de demostración. Solicita una revisión técnica antes de continuar."],
] as const;

describe("mensajes de los bloqueos de cargos, CRM y demostración", () => {
  it.each(cases)("explica %s sin reproducir identificadores o detalles internos", (code, message) => {
    const raw = `${code}: public.tabla_interna RFC-PRIVADO uuid-interno`;
    expect(translateLcCode(raw)).toBe(message);
    expect(getErrorMessage(new Error(raw))).toBe(message);
    expect(getErrorMessage({ code: "P0001", message: raw })).toBe(message);
    expect(message).not.toContain(code);
    expect(message).not.toMatch(/tabla_interna|RFC-PRIVADO|uuid-interno/);
  });

  it("conserva la prioridad de permisos e integridad de los errores PostgREST", () => {
    const approval = getErrorMessage({ code: "42501", message: "LC_SEED_DEMO_APROBADOR_REQUERIDO: uuid-interno" });
    expect(approval).toMatch(/No tienes permisos/);
    const identity = getErrorMessage({ code: "23514", message: "LC_SEED_DEMO_CRM_IDENTIDAD_INSEGURA: RFC-PRIVADO" });
    expect(identity).toMatch(/regla de validación/);
    expect(approval + identity).not.toMatch(/uuid-interno|RFC-PRIVADO/);
  });

  it("mantiene visible el fallback de códigos desconocidos", () => {
    expect(translateLcCode("LC_AUDIT_UNKNOWN_SENTINEL: error visible")).toBeNull();
    expect(getErrorMessage(new Error("LC_AUDIT_UNKNOWN_SENTINEL: error visible"))).toBe("error visible");
  });
});
