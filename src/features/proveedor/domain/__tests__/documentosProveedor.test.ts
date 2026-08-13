import { describe, it, expect } from "vitest";
import {
  estadoVigencia,
  diasParaVencer,
  calcularExpediente,
  ultimoPorTipo,
  formatTamano,
  validarVigenciaDocumento,
  type DocumentoProveedor,
} from "../documentosProveedor";

const HOY = "2026-08-13";

function doc(over: Partial<DocumentoProveedor>): DocumentoProveedor {
  return {
    id: over.id ?? "d1",
    proveedor_id: "p1",
    tipo: over.tipo ?? "Constancia de situación fiscal",
    nombre: over.nombre ?? "csf.pdf",
    archivo: over.archivo ?? "proveedores/p1/csf.pdf",
    mime_type: "application/pdf",
    tamano_bytes: over.tamano_bytes ?? 1024,
    fecha_documento: over.fecha_documento ?? null,
    fecha_vencimiento: over.fecha_vencimiento ?? null,
    notas: null,
    created_at: over.created_at ?? "2026-08-01T10:00:00Z",
  };
}

describe("estadoVigencia", () => {
  it("marca Sin vigencia cuando no hay fecha", () => {
    expect(estadoVigencia(null, HOY)).toBe("Sin vigencia");
  });

  it("marca Vencido un día después del vencimiento", () => {
    expect(estadoVigencia("2026-08-12", HOY)).toBe("Vencido");
  });

  it("el día del vencimiento sigue Por vencer, no Vencido", () => {
    expect(estadoVigencia(HOY, HOY)).toBe("Por vencer");
  });

  it("marca Por vencer dentro de los 30 días y Vigente después", () => {
    expect(estadoVigencia("2026-09-10", HOY)).toBe("Por vencer");
    expect(estadoVigencia("2026-09-30", HOY)).toBe("Vigente");
  });

  it("calcula los días restantes sin desfase de zona horaria", () => {
    expect(diasParaVencer("2026-08-23", HOY)).toBe(10);
    expect(diasParaVencer("2026-08-03", HOY)).toBe(-10);
  });
});

describe("ultimoPorTipo", () => {
  it("devuelve el documento más reciente del tipo pedido", () => {
    const viejo = doc({ id: "a", fecha_documento: "2026-01-01" });
    const nuevo = doc({ id: "b", fecha_documento: "2026-07-01" });
    expect(ultimoPorTipo([viejo, nuevo], "Constancia de situación fiscal")?.id).toBe("b");
  });

  it("devuelve null cuando el tipo no existe", () => {
    expect(ultimoPorTipo([doc({})], "Contrato")).toBeNull();
  });
});

describe("calcularExpediente", () => {
  it("nacional requiere 3 documentos y reporta faltantes", () => {
    const r = calcularExpediente([doc({})], true, HOY);
    expect(r.requeridos).toBe(3);
    expect(r.cubiertos).toBe(1);
    expect(r.completitud).toBe(33);
    expect(r.renglones.filter((x) => x.estado === "Faltante")).toHaveLength(2);
  });

  it("extranjero sólo requiere el comprobante bancario", () => {
    const r = calcularExpediente(
      [doc({ tipo: "Comprobante de datos bancarios" })],
      false,
      HOY,
    );
    expect(r.requeridos).toBe(1);
    expect(r.completitud).toBe(100);
  });

  it("un documento vencido no cuenta como cubierto", () => {
    const r = calcularExpediente(
      [doc({ tipo: "Comprobante de datos bancarios", fecha_vencimiento: "2026-01-01" })],
      false,
      HOY,
    );
    expect(r.cubiertos).toBe(0);
    expect(r.vencidos).toBe(1);
    expect(r.completitud).toBe(0);
  });

  it("cuenta los que están por vencer", () => {
    const r = calcularExpediente(
      [doc({ tipo: "Comprobante de datos bancarios", fecha_vencimiento: "2026-08-20" })],
      false,
      HOY,
    );
    expect(r.porVencer).toBe(1);
    expect(r.cubiertos).toBe(1);
  });
});

describe("formatTamano", () => {
  it("formatea bytes, KB y MB", () => {
    expect(formatTamano(null)).toBe("—");
    expect(formatTamano(512)).toBe("512 B");
    expect(formatTamano(2048)).toBe("2 KB");
    expect(formatTamano(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("validarVigenciaDocumento (R3FE-07)", () => {
  const HOY_V = "2026-08-13";

  it("exige vigencia en los tipos que caducan", () => {
    expect(validarVigenciaDocumento("Opinión de cumplimiento", null, null, HOY_V))
      .toMatch(/obligatoria/);
    expect(validarVigenciaDocumento("Comprobante de datos bancarios", null, null, HOY_V))
      .toMatch(/obligatoria/);
  });

  it("permite otros tipos sin vigencia", () => {
    expect(validarVigenciaDocumento("Constancia de situación fiscal", null, null, HOY_V))
      .toBeNull();
  });

  it("rechaza vigencia vencida, invertida o absurda", () => {
    expect(validarVigenciaDocumento("Contrato", null, "2026-08-12", HOY_V))
      .toMatch(/ya venció/);
    expect(validarVigenciaDocumento("Contrato", "2026-09-01", "2026-08-20", HOY_V))
      .toMatch(/anterior a la fecha del documento/);
    expect(validarVigenciaDocumento("Contrato", null, "2040-01-01", HOY_V))
      .toMatch(/10 años/);
  });

  it("acepta una vigencia válida", () => {
    expect(validarVigenciaDocumento("Opinión de cumplimiento", "2026-08-01", "2026-12-31", HOY_V))
      .toBeNull();
  });
});
