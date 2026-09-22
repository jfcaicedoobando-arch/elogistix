/**
 * Etapa 4 · el payload de crear/editar oportunidad persiste los IDs de puerto
 * sólo en Marítimo y los limpia en cualquier otro modo.
 */
import { describe, expect, it } from "vitest";
import { buildOportunidadFormPayload } from "@/features/crm/domain/oportunidadFormPayload";
import { EMPTY_OPORTUNIDAD } from "@/features/crm/domain/oportunidadFormState";

const base = {
  ...EMPTY_OPORTUNIDAD,
  nombre: "Oportunidad ACME",
  etapa_id: "etapa-1",
  origen_tipo: "cliente" as const,
  cliente_id: "cliente-1",
  origen: "Shanghai, China (CNSHA)",
  destino: "Manzanillo, México (MXZLO)",
  puerto_origen_id: "p-sha",
  puerto_destino_id: "p-zlo",
};

describe("buildOportunidadFormPayload · puertos", () => {
  it("Marítimo persiste texto + IDs", () => {
    const p = buildOportunidadFormPayload({ ...base, modo: "Marítimo" }, false);
    expect(p.origen).toBe("Shanghai, China (CNSHA)");
    expect(p.puerto_origen_id).toBe("p-sha");
    expect(p.puerto_destino_id).toBe("p-zlo");
  });

  it.each(["Aéreo", "Terrestre", "Multimodal", ""])(
    "modo %s limpia los IDs y conserva el texto",
    (modo) => {
      const p = buildOportunidadFormPayload({ ...base, modo }, false);
      expect(p.puerto_origen_id).toBeNull();
      expect(p.puerto_destino_id).toBeNull();
      expect(p.destino).toBe("Manzanillo, México (MXZLO)");
    },
  );

  it("nunca persiste dos IDs iguales", () => {
    const p = buildOportunidadFormPayload(
      { ...base, modo: "Marítimo", puerto_destino_id: "p-sha" },
      false,
    );
    expect(p.puerto_origen_id).toBe("p-sha");
    expect(p.puerto_destino_id).toBeNull();
  });
});
