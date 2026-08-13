import { describe, it, expect } from "vitest";
import {
  calcularExpedienteDesde,
  estadoVigencia,
  formatTamano,
  slugArchivo,
  ultimoPorTipo,
  validarVigencia,
  type DocumentoExpediente,
} from "../expediente";

const HOY = "2026-08-13";

function doc(over: Partial<DocumentoExpediente>): DocumentoExpediente {
  return {
    id: over.id ?? "1",
    tipo: over.tipo ?? "Contrato",
    nombre: over.nombre ?? "archivo.pdf",
    archivo: over.archivo ?? "clientes/1/archivo.pdf",
    mime_type: null,
    tamano_bytes: over.tamano_bytes ?? null,
    fecha_documento: over.fecha_documento ?? null,
    fecha_vencimiento: over.fecha_vencimiento ?? null,
    notas: null,
    created_at: over.created_at ?? "2026-01-01T00:00:00Z",
  };
}

describe("expediente — vigencia", () => {
  it("clasifica sin vigencia, vigente, por vencer y vencido", () => {
    expect(estadoVigencia(null, HOY)).toBe("Sin vigencia");
    expect(estadoVigencia("2027-01-01", HOY)).toBe("Vigente");
    expect(estadoVigencia("2026-08-20", HOY)).toBe("Por vencer");
    expect(estadoVigencia("2026-08-01", HOY)).toBe("Vencido");
  });

  it("exige vencimiento sólo en los tipos que caducan", () => {
    expect(validarVigencia("Opinión de cumplimiento", null, null, ["Opinión de cumplimiento"], HOY))
      .toContain("obligatoria");
    expect(validarVigencia("Contrato", null, null, ["Opinión de cumplimiento"], HOY)).toBeNull();
  });

  it("rechaza vigencias vencidas, invertidas o absurdas", () => {
    const tipos = ["Opinión de cumplimiento"];
    expect(validarVigencia("Contrato", null, "2026-01-01", tipos, HOY)).toContain("venció");
    expect(validarVigencia("Contrato", "2026-12-01", "2026-10-01", tipos, HOY))
      .toContain("anterior a la fecha del documento");
    expect(validarVigencia("Contrato", null, "2050-01-01", tipos, HOY)).toContain("10 años");
    expect(validarVigencia("Contrato", "2026-08-13", "2027-08-13", tipos, HOY)).toBeNull();
  });
});

describe("expediente — resumen", () => {
  it("cuenta cubiertos, vencidos y completitud", () => {
    const docs = [
      doc({ id: "a", tipo: "Contrato", fecha_vencimiento: "2027-01-01" }),
      doc({ id: "b", tipo: "Opinión de cumplimiento", fecha_vencimiento: "2026-01-01" }),
    ];
    const r = calcularExpedienteDesde(docs, ["Contrato", "Opinión de cumplimiento", "Otro"], HOY);
    expect(r.requeridos).toBe(3);
    expect(r.cubiertos).toBe(1);
    expect(r.vencidos).toBe(1);
    expect(r.completitud).toBe(33);
  });

  it("toma el documento más reciente de cada tipo", () => {
    const docs = [
      doc({ id: "viejo", fecha_documento: "2025-01-01" }),
      doc({ id: "nuevo", fecha_documento: "2026-06-01" }),
    ];
    expect(ultimoPorTipo(docs, "Contrato")?.id).toBe("nuevo");
    expect(ultimoPorTipo(docs, "Acta constitutiva")).toBeNull();
  });
});

describe("expediente — utilidades", () => {
  it("formatea tamaños legibles", () => {
    expect(formatTamano(null)).toBe("—");
    expect(formatTamano(500)).toBe("500 B");
    expect(formatTamano(2048)).toBe("2 KB");
    expect(formatTamano(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("limpia el nombre del archivo para storage", () => {
    expect(slugArchivo("Opinión del SAT (agosto).pdf")).toBe("Opinion-del-SAT-agosto-.pdf");
  });
});
