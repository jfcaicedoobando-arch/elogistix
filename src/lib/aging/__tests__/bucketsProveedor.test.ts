/**
 * Paso 6 de la auditoría — catálogo único de cubetas de antigüedad.
 *
 * Antes existían dos catálogos (clientes y proveedores) con los mismos rangos
 * declarados por separado: si dirección cambiaba el criterio, un reporte quedaba
 * con los rangos viejos. Estos tests congelan que sólo haya una fuente.
 */
import { describe, it, expect } from "vitest";
import fg from "fast-glob";
import { readFileSync } from "node:fs";
import {
  CUBETAS_AGING,
  CUBETAS_WIRE_PROVEEDOR,
  CUBETA_WIRE_PROVEEDOR,
  WIRE_A_CUBETA_PROVEEDOR,
  CUBETA_WIRE_LABELS_PROVEEDOR,
  CUBETA_LABELS_LARGAS,
  bucketDeDias,
} from "../buckets";

describe("cubetas de antigüedad · catálogo único", () => {
  it("las claves de la RPC de proveedores van 1:1 y en el mismo orden que las canónicas", () => {
    expect(CUBETAS_WIRE_PROVEEDOR.length).toBe(CUBETAS_AGING.length);
    expect(CUBETAS_AGING.map((c) => CUBETA_WIRE_PROVEEDOR[c])).toEqual([...CUBETAS_WIRE_PROVEEDOR]);
  });

  it("el mapa inverso reconstruye la cubeta canónica", () => {
    for (const c of CUBETAS_AGING) {
      expect(WIRE_A_CUBETA_PROVEEDOR[CUBETA_WIRE_PROVEEDOR[c]]).toBe(c);
    }
  });

  it("las etiquetas de proveedores se derivan de las canónicas (no se redactan aparte)", () => {
    for (const c of CUBETAS_AGING) {
      expect(CUBETA_WIRE_LABELS_PROVEEDOR[CUBETA_WIRE_PROVEEDOR[c]]).toBe(CUBETA_LABELS_LARGAS[c]);
    }
  });

  it("los rangos siguen siendo 0 / 1-30 / 31-60 / 61-90 / +90", () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91].map(bucketDeDias)).toEqual([
      "vigente",
      "d_1_30",
      "d_1_30",
      "d_31_60",
      "d_31_60",
      "d_61_90",
      "d_61_90",
      "mas_90",
    ]);
  });

  it("ningún otro módulo redeclara la lista de cubetas", () => {
    const ofensores = fg
      .sync(["src/**/*.{ts,tsx}"], {
        ignore: ["src/lib/aging/**", "src/**/__tests__/**", "src/**/*.test.{ts,tsx}"],
      })
      .filter((f) => {
        // Sólo se prohíbe volver a *listar* las cubetas (las claves sueltas
        // como `d_31_60` son legítimas al leer una fila de la RPC).
        const src = readFileSync(f, "utf8");
        return /"31-60"\s*,\s*"61-90"/.test(src) || /"d_31_60"\s*,\s*"d_61_90"/.test(src);
      });
    expect(ofensores).toEqual([]);
  });
});
