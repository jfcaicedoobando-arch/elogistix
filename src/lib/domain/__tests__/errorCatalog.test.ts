import { describe, it, expect } from "vitest";
import { getMessage, msg, ALL_MESSAGE_KEYS, FIELD_LABELS } from "../errorCatalog";

describe("errorCatalog", () => {
  it("devuelve mensaje formateado para clave estática", () => {
    expect(msg("1.modo.required")).toBe("Modo de transporte: selecciona una opción.");
    expect(msg("2.eta.afterEtd")).toBe("ETA: debe ser igual o posterior al ETD.");
    expect(msg("4.tipoCambioUSD.positive")).toBe("Tipo de cambio USD: debe ser mayor a 0.");
  });

  it("interpola parámetros en mensajes dinámicos", () => {
    expect(getMessage("3.documento.tooLarge", { nombre: "BL Master", sizeMb: "12.4", maxMb: 10 }))
      .toBe("Documento BL Master: excede 10 MB (12.4 MB).");
    expect(getMessage("3.documento.invalidMime", { nombre: "Factura" }))
      .toBe("Documento Factura: formato no permitido. Usa PDF, JPG, PNG, XLSX o DOCX.");
    expect(getMessage("4.conceptoVenta.invalid", { id: 7 }))
      .toBe("Concepto de venta #7: cantidad ≥ 1 y precio ≥ 0.");
    expect(getMessage("4.conceptoCosto.negativeAmount", { id: 3 }))
      .toBe("Concepto de costo #3: monto no puede ser negativo.");
  });

  it("toda clave del catálogo produce un mensaje válido en formato 'Campo: razón.'", () => {
    // Para claves dinámicas pasamos parámetros placeholder
    const dynamicParams: Record<string, Record<string, unknown>> = {
      "3.documento.tooLarge": { nombre: "X", sizeMb: "1", maxMb: 10 },
      "3.documento.invalidMime": { nombre: "X" },
      "4.conceptoVenta.invalid": { id: 1 },
      "4.conceptoCosto.negativeAmount": { id: 1 },
    };

    for (const key of ALL_MESSAGE_KEYS) {
      const out = getMessage(key, dynamicParams[key]);
      expect(out, `Clave ${key} produjo mensaje vacío`).toBeTruthy();
      expect(out, `Clave ${key} no termina con punto: "${out}"`).toMatch(/\.$/);
      expect(out, `Clave ${key} no contiene ":": "${out}"`).toMatch(/.+: .+/);
    }
  });

  it("FIELD_LABELS cubre todos los campos referenciados por el wizard", () => {
    // Spot check de etiquetas obligatorias
    expect(FIELD_LABELS.modo).toBeDefined();
    expect(FIELD_LABELS.etd).toBeDefined();
    expect(FIELD_LABELS.tipoCambioUSD).toBeDefined();
  });

  it("clave desconocida no rompe y devuelve la propia clave", () => {
    // @ts-expect-error — probamos resiliencia ante typos
    expect(getMessage("99.no.existe")).toBe("99.no.existe");
  });
});
