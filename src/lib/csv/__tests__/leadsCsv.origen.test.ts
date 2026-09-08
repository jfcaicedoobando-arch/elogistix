/**
 * CRM-CSV-01 — el exportador emite la columna "Origen"; el importador debe
 * reconocerla (y seguir aceptando el encabezado legacy "fuente").
 */
import { describe, it, expect } from "vitest";
import { parseLeadsCsv, mapLeadCsvRows, LEAD_CSV_HEADER_ALIASES } from "@/lib/csv/leadsCsv";
import { buildLeadsCsv } from "@/features/crm/services/crmCsvExport";
import type { CrmLeadRow } from "@/features/crm/domain/leads/constants";

const ORIGENES = ["Prospección", "Finkargo", "Referido"] as const;

function lead(fuente: string): CrmLeadRow {
  // SAFE-CAST: sólo se serializan las columnas que usa `buildLeadsCsv`.
  return {
    empresa: "Importadora Regiomontana",
    contacto: "Ana",
    email: "ana@example.com",
    telefono: "8181818181",
    ciudad: "Monterrey",
    pais: "México",
    fuente,
    estado: "Nuevo",
    score: 3,
    vendedor_email: "v@example.com",
    created_at: "2026-09-01T00:00:00Z",
  } as unknown as CrmLeadRow;
}

describe("leadsCsv · columna Origen", () => {
  it("reconoce 'origen' y conserva los alias legacy", () => {
    expect(LEAD_CSV_HEADER_ALIASES["origen"]).toBe("fuente");
    expect(LEAD_CSV_HEADER_ALIASES["fuente"]).toBe("fuente");
    expect(LEAD_CSV_HEADER_ALIASES["source"]).toBe("fuente");
  });

  it("round-trip exportar → parsear → mapear conserva cada origen", () => {
    for (const origen of ORIGENES) {
      const csv = buildLeadsCsv([lead(origen)]);
      const rows = mapLeadCsvRows(parseLeadsCsv(csv));
      expect(rows).toHaveLength(1);
      expect(rows[0].fuente).toBe(origen);
      expect(rows[0].estado).toBe("Nuevo");
      expect(rows[0].__error).toBeUndefined();
    }
  });

  it("matriz mínima con encabezado Origen no cae en el default", () => {
    const rows = mapLeadCsvRows([
      ["Empresa", "Origen"],
      ["Importadora Regiomontana", "Finkargo"],
    ]);
    expect(rows[0].fuente).toBe("Finkargo");
    const legacy = mapLeadCsvRows([
      ["Empresa", "Fuente"],
      ["Importadora Regiomontana", "Referido"],
    ]);
    expect(legacy[0].fuente).toBe("Referido");
  });
});
