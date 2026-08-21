import { describe, it, expect } from "vitest";
import {
  buildLeadsCsv,
  buildOportunidadesCsv,
  sufijoFechaArchivo,
} from "../crmCsvExport";

type LeadLike = Parameters<typeof buildLeadsCsv>[0][number];
type OpLike = Parameters<typeof buildOportunidadesCsv>[0][number];

const lead = {
  empresa: "Acme SA",
  contacto: "Ana",
  email: "ana@acme.mx",
  telefono: "5555555555",
  ciudad: "CDMX",
  pais: "México",
  fuente: "Web",
  estado: "Nuevo",
  score: 80,
  vendedor_email: "v@lc.mx",
  created_at: "2026-08-21T00:00:00Z",
} as unknown as LeadLike;

const op = {
  nombre: "Importación FCL",
  cliente_nombre: "Acme SA",
  monto_estimado: 1500,
  moneda: "USD",
  probabilidad: 60,
  vendedor_email: "v@lc.mx",
  fecha_cierre_estimada: "2026-09-01",
  created_at: "2026-08-21T00:00:00Z",
} as unknown as OpLike;

describe("crmCsvExport", () => {
  it("serializa leads con encabezados en español y fecha es-MX", () => {
    const csv = buildLeadsCsv([lead]);
    const [header, fila] = csv.split("\n");
    expect(header).toContain("Empresa");
    expect(header).toContain("Vendedor");
    expect(fila).toContain("Acme SA");
    expect(fila).toContain("21/8/2026");
  });

  it("serializa oportunidades con monto y moneda", () => {
    const csv = buildOportunidadesCsv([op]);
    expect(csv).toContain("Monto estimado");
    expect(csv).toContain("1500");
    expect(csv).toContain("USD");
  });

  it("deja campos nulos como cadena vacía sin romper el CSV", () => {
    const csv = buildLeadsCsv([
      { ...lead, contacto: null, created_at: null } as unknown as LeadLike,
    ]);
    expect(csv.split("\n")).toHaveLength(2);
  });

  it("genera sufijo de archivo con la fecha ISO del día", () => {
    expect(sufijoFechaArchivo(new Date("2026-08-21T10:00:00Z"))).toBe("2026-08-21");
  });
});
