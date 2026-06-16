/**
 * Tests para `exportOrg` — paginación de 1000, manifest determinista,
 * orquestación completa con `toCSV` + `downloadZip` mockeados.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => fromMock(...a) },
}));

const toCsvSpy = vi.fn((rows: unknown[]) => `CSV(${rows.length})`);
const downloadZipSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/io", () => ({
  toCSV: (rows: unknown[]) => toCsvSpy(rows),
  downloadZip: (...a: unknown[]) => downloadZipSpy(...a),
}));

import {
  EXPORT_TABLES,
  buildExportManifest,
  fetchOrganizationExport,
  exportOrganizationZip,
} from "@/features/admin/services/exportOrg";

const okPage = (rows: unknown[]) => ({ data: rows, error: null });

const buildQuery = (pages: unknown[][]) => {
  let call = 0;
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    range: vi.fn().mockImplementation(() => Promise.resolve(okPage(pages[call++] ?? []))),
  };
  return q;
};

beforeEach(() => {
  fromMock.mockReset();
  toCsvSpy.mockClear();
  downloadZipSpy.mockClear();
});

describe("buildExportManifest", () => {
  it("incluye id, nombre, tablas y formato; es JSON válido indentado", () => {
    const json = buildExportManifest("org-1", "Acme");
    expect(json).toMatch(/\n  /); // indent 2 spaces
    const parsed = JSON.parse(json);
    expect(parsed.organization_id).toBe("org-1");
    expect(parsed.organization_nombre).toBe("Acme");
    expect(parsed.tables).toEqual([...EXPORT_TABLES]);
    expect(parsed.format).toContain("CSV");
    expect(typeof parsed.generated_at).toBe("string");
  });
});

describe("fetchOrganizationExport", () => {
  it("pagina hasta agotar resultados y reporta progreso", async () => {
    // Primera tabla: 2 páginas (1000 + 5); el resto: 1 página vacía.
    fromMock.mockImplementation((table: string) => {
      if (table === EXPORT_TABLES[0]) {
        return buildQuery([new Array(1000).fill({ id: 1 }), new Array(5).fill({ id: 2 })]);
      }
      return buildQuery([[]]);
    });
    const progress = vi.fn();
    const res = await fetchOrganizationExport("org-1", progress);
    expect(res).toHaveLength(EXPORT_TABLES.length);
    expect(res[0].rows).toHaveLength(1005);
    // Recibimos al menos un evento por tabla.
    expect(progress).toHaveBeenCalled();
    expect(progress.mock.calls.some(([p]) => p.current === EXPORT_TABLES[0])).toBe(true);
  });

  it("propaga errores con prefijo de tabla", async () => {
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
    }));
    await expect(fetchOrganizationExport("org-1")).rejects.toThrow(/clientes: boom/);
  });
});

describe("exportOrganizationZip", () => {
  it("genera un archivo CSV por tabla + manifest y dispara downloadZip", async () => {
    fromMock.mockImplementation(() => buildQuery([[]]));
    await exportOrganizationZip("org-1", "Acme México");
    expect(downloadZipSpy).toHaveBeenCalledTimes(1);
    const [folder, files, zipName] = downloadZipSpy.mock.calls[0];
    expect(folder).toBe("export-Acme_M_xico");
    // CSV por tabla + manifest.json.
    expect(Object.keys(files as Record<string, string>)).toHaveLength(EXPORT_TABLES.length + 1);
    expect((files as Record<string, string>)["manifest.json"]).toContain("Acme");
    expect(zipName).toMatch(/^libre-carga-export-Acme_M_xico-\d{4}-\d{2}-\d{2}\.zip$/);
  });
});
