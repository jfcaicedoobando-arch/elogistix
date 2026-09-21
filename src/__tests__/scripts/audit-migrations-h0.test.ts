/**
 * Paso 16 — H0: unicidad de timestamp de migración.
 * Cubre: versiones únicas, duplicado desconocido, pareja legacy exacta y
 * pareja legacy + tercer archivo.
 */
import { describe, it, expect } from "vitest";
import {
  scanVersionesDuplicadas,
  agruparPorVersion,
  COLISION_LEGACY,
} from "../../../scripts/lib/audit-migration-versions";

const LEGACY = COLISION_LEGACY.archivos;

describe("H0 — unicidad de versión de migración", () => {
  it("versiones únicas => limpio", () => {
    const files = ["20260101000000_a.sql", "20260101000001_b.sql", "20260102000000_c.sql"];
    expect(scanVersionesDuplicadas(files)).toEqual([]);
  });

  it("ignora archivos que no son .sql o sin timestamp", () => {
    expect(agruparPorVersion(["README.md", "sin_timestamp.sql"]).size).toBe(0);
  });

  it("duplicado desconocido => H0 con timestamp y archivos", () => {
    const files = ["20260505121212_uno.sql", "20260505121212_dos.sql"];
    const v = scanVersionesDuplicadas(files);
    expect(v).toHaveLength(1);
    expect(v[0].check).toBe("H0");
    expect(v[0].detail).toContain("20260505121212");
    expect(v[0].detail).toContain("20260505121212_uno.sql");
    expect(v[0].detail).toContain("20260505121212_dos.sql");
  });

  it("pareja legacy exacta => permitida", () => {
    expect(scanVersionesDuplicadas([...LEGACY, "20260102000000_c.sql"])).toEqual([]);
  });

  it("pareja legacy + tercer archivo => H0", () => {
    const v = scanVersionesDuplicadas([
      ...LEGACY,
      `${COLISION_LEGACY.version}_tercero.sql`,
    ]);
    expect(v).toHaveLength(1);
    expect(v[0].check).toBe("H0");
    expect(v[0].detail).toContain("3 archivos");
  });

  it("un solo archivo del timestamp legacy no dispara H0", () => {
    expect(scanVersionesDuplicadas([LEGACY[0]])).toEqual([]);
  });
});
