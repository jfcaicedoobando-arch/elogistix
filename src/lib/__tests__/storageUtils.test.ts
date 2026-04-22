import { describe, it, expect } from "vitest";
import {
  sanitizeStorageKey,
  sanitizeFileName,
  buildEmbarqueDocPath,
} from "@/lib/storageUtils";

describe("sanitizeStorageKey", () => {
  it("reemplaza espacios y paréntesis por underscore", () => {
    expect(sanitizeStorageKey("Air Waybill (AWB)")).toBe("Air_Waybill_AWB");
  });

  it("elimina acentos preservando letras base", () => {
    expect(sanitizeStorageKey("Constancia Situación Fiscal")).toBe(
      "Constancia_Situacion_Fiscal",
    );
  });

  it("reemplaza caracteres CJK por underscore", () => {
    expect(sanitizeStorageKey("提单")).toBe("_");
  });

  it("colapsa múltiples espacios y símbolos en un único underscore", () => {
    expect(sanitizeStorageKey("documento  con   espacios")).toBe(
      "documento_con_espacios",
    );
  });

  it("limpia símbolos no permitidos", () => {
    expect(sanitizeStorageKey("archivo!@#$%^&")).toBe("archivo");
  });

  it("preserva guiones, puntos y underscores", () => {
    expect(sanitizeStorageKey("file-name_v1.2")).toBe("file-name_v1.2");
  });

  it("trunca a la longitud máxima", () => {
    const largo = "a".repeat(200);
    expect(sanitizeStorageKey(largo, 50).length).toBe(50);
  });

  it("retorna '_' si el resultado quedaría vacío", () => {
    expect(sanitizeStorageKey("")).toBe("_");
    expect(sanitizeStorageKey("###")).toBe("_");
  });
});

describe("sanitizeFileName", () => {
  it("preserva la extensión sanitizando el nombre base (CJK colapsado)", () => {
    expect(sanitizeFileName("172-04513806_提单.pdf")).toBe("172-04513806.pdf");
  });

  it("respeta extensión en mayúsculas", () => {
    expect(sanitizeFileName("documento  con   espacios.PDF")).toBe(
      "documento_con_espacios.PDF",
    );
  });

  it("limpia base con símbolos preservando ext", () => {
    expect(sanitizeFileName("archivo!@#$%^&.docx")).toBe("archivo.docx");
  });

  it("para nombres sin extensión, sanitiza completo", () => {
    expect(sanitizeFileName("README")).toBe("README");
  });

  it("para nombres que terminan en punto, sanitiza completo", () => {
    expect(sanitizeFileName("archivo.")).toBe("archivo.");
  });

  it("conserva solo la última extensión en .tar.gz", () => {
    // base = "documento.tar", ext = "gz" → "documento.tar.gz"
    expect(sanitizeFileName("documento.tar.gz")).toBe("documento.tar.gz");
  });

  it("trunca el nombre largo conservando la extensión", () => {
    const nombre = "a".repeat(200) + ".pdf";
    const resultado = sanitizeFileName(nombre, 50);
    expect(resultado.endsWith(".pdf")).toBe(true);
    expect(resultado.length).toBeLessThanOrEqual(50);
  });
});

describe("buildEmbarqueDocPath", () => {
  it("construye path con todos los segmentos sanitizados", () => {
    const path = buildEmbarqueDocPath(
      "ELIMP00180",
      "Air Waybill (AWB)",
      "172-04513806_提单.pdf",
    );
    expect(path).toMatch(
      /^embarques\/ELIMP00180\/Air_Waybill_AWB\/\d+_172-04513806\.pdf$/,
    );
  });

  it("no contiene caracteres no-ASCII en el resultado", () => {
    const path = buildEmbarqueDocPath("提单", "中文", "文件.pdf");
    // eslint-disable-next-line no-control-regex
    expect(/[^\x00-\x7F]/.test(path)).toBe(false);
  });
});
