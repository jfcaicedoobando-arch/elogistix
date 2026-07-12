/**
 * Tests para `exportOrg` — paginación de 1000, manifest determinista,
 * orquestación completa con `toCSV` + `downloadZip` mockeados, y flujo
 * "warning + continuar" ante errores RLS suaves.
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
  EXPORT_GROUPS,
  FORBIDDEN_EXPORT_TABLES,
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

describe("EXPORT_TABLES", () => {
  it("es la concatenación de todos los grupos y no contiene duplicados", () => {
    const flat = Object.values(EXPORT_GROUPS).flat();
    expect(EXPORT_TABLES).toEqual(flat);
    expect(new Set(EXPORT_TABLES).size).toBe(EXPORT_TABLES.length);
  });

  it("no incluye tablas prohibidas (credenciales, control de acceso, logs)", () => {
    for (const forbidden of FORBIDDEN_EXPORT_TABLES) {
      expect(EXPORT_TABLES).not.toContain(forbidden);
    }
  });
});

describe("buildExportManifest", () => {
  it("acepta la firma legacy (id, nombre) y produce JSON válido", () => {
    const json = buildExportManifest("org-1", "Acme");
    expect(json).toMatch(/\n {2}/);
    const parsed = JSON.parse(json);
    expect(parsed.organization_id).toBe("org-1");
    expect(parsed.organization_nombre).toBe("Acme");
    expect(parsed.tables).toEqual([...EXPORT_TABLES]);
    expect(parsed.format).toContain("CSV");
    expect(parsed.app_version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof parsed.generated_at).toBe("string");
  });

  it("incluye rows_by_table y warnings cuando se pasan resultados", () => {
    const json = buildExportManifest({
      organizationId: "o1",
      orgNombre: "N",
      results: [
        { table: "clientes", rows: [{}, {}, {}] },
        { table: "facturas", rows: [], warning: "42501: permission denied" },
      ],
    });
    const parsed = JSON.parse(json);
    expect(parsed.rows_by_table).toEqual({ clientes: 3, facturas: 0 });
    expect(parsed.warnings).toEqual({ facturas: "42501: permission denied" });
  });

  it("omite warnings cuando no hay tablas con error", () => {
    const json = buildExportManifest({
      organizationId: "o",
      orgNombre: "N",
      results: [{ table: "clientes", rows: [] }],
    });
    const parsed = JSON.parse(json);
    expect(parsed.warnings).toBeUndefined();
  });
});

describe("fetchOrganizationExport", () => {
  it("agrega 1 fila por tabla y reporta progreso", async () => {
    fromMock.mockImplementation(() => buildQuery([[{ id: 1 }]]));
    const progress = vi.fn();
    const res = await fetchOrganizationExport("org-1", progress);
    expect(res).toHaveLength(EXPORT_TABLES.length);
    expect(res.every((r) => r.rows.length === 1)).toBe(true);
    expect(progress).toHaveBeenCalled();
    expect(progress.mock.calls.some(([p]) => p.current === EXPORT_TABLES[0])).toBe(true);
  });

  it("propaga errores duros con prefijo de tabla", async () => {
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
    }));
    await expect(fetchOrganizationExport("org-1")).rejects.toThrow(/clientes: boom/);
  });

  it("degrada errores RLS suaves a warning y continúa con el resto de tablas", async () => {
    let firstCall = true;
    fromMock.mockImplementation(() => {
      if (firstCall) {
        firstCall = false;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "42501", message: "permission denied for table x" },
          }),
        };
      }
      return buildQuery([[{ id: 1 }]]);
    });
    const res = await fetchOrganizationExport("org-1");
    expect(res).toHaveLength(EXPORT_TABLES.length);
    expect(res[0].warning).toMatch(/42501/);
    expect(res[0].rows).toEqual([]);
    expect(res[1].warning).toBeUndefined();
    expect(res[1].rows).toHaveLength(1);
  });
});

describe("exportOrganizationZip", () => {
  it("genera un archivo CSV por tabla + manifest y dispara downloadZip", async () => {
    fromMock.mockImplementation(() => buildQuery([[]]));
    await exportOrganizationZip("org-1", "Acme México");
    expect(downloadZipSpy).toHaveBeenCalledTimes(1);
    const [folder, files, zipName] = downloadZipSpy.mock.calls[0];
    expect(folder).toBe("export-Acme_M_xico");
    expect(Object.keys(files as Record<string, string>)).toHaveLength(EXPORT_TABLES.length + 1);
    const manifest = JSON.parse((files as Record<string, string>)["manifest.json"]);
    expect(manifest.organization_nombre).toBe("Acme México");
    expect(manifest.rows_by_table).toBeDefined();
    expect(zipName).toMatch(/^libre-carga-export-Acme_M_xico-\d{4}-\d{2}-\d{2}\.zip$/);
  });
});
