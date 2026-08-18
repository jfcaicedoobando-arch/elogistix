import { describe, it, expect } from "vitest";
import { readAppVersion } from "../../../scripts/lib/readAppVersion";
import { APP_VERSION } from "@/constants/appVersion";

describe("readAppVersion", () => {
  it("devuelve la versión vigente sin importar el módulo", () => {
    expect(readAppVersion(process.cwd())).toBe(APP_VERSION);
  });

  it("devuelve 'unknown' si el archivo no existe", () => {
    expect(readAppVersion("/tmp/no-existe-este-directorio-lc")).toBe("unknown");
  });
});
