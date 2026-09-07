/**
 * R170-01 (remate) · El resumen de resultados y el subtítulo del listado de
 * proformas no pueden usar la clave interna `facturada` ni invitar a "marcar
 * como facturadas": el grupo incluye proformas cuya factura sigue en Borrador.
 * Claves internas y lógica de filtrado no cambian; sólo la presentación.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const leer = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

describe("R170-01 · copy de estado en proformas", () => {
  it("el resumen usa la etiqueta visible del grupo, no la clave interna", () => {
    const src = leer("src/features/facturacion/components/TabProformas.tsx");
    expect(src).toContain("LABEL_ESTADO_UNIFICADO[c.filtroEstado]");
    expect(src).not.toContain("con estado {c.filtroEstado}");
  });

  it("el subtítulo del listado no invita a marcar como facturadas", () => {
    const src = leer("src/features/proformas/routes/ProformasListado.tsx");
    expect(src).not.toMatch(/marca como facturadas/);
    expect(src).toMatch(/convierte a factura/);
  });
});
