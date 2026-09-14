/**
 * N2 (v13.823.386) — `public.proveedor_estado_cuenta` ignoraba por completo las
 * notas de crédito de proveedor aplicadas: una NC viva no reducía lo pagado ni
 * el saldo del concepto de costo, y una NC en otra moneda ni siquiera podía
 * compararse contra la factura.
 *
 * Este guardrail blinda que la migración vigente y el espejo canónico:
 *   1. incluyan las NC vivas en estado 'Aplicada';
 *   2. las conviertan con el MISMO canon que los pagos
 *      (`public.monto_pago_en_moneda_factura`);
 *   3. las sumen a lo pagado ANTES de prorratear hacia conceptos.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIG_DIR = path.resolve(__dirname, "../../../supabase/migrations");
const ESPEJO = path.resolve(
  __dirname,
  "../../../supabase/schema/proveedores/proveedor_estado_cuenta.sql",
);

function readLatestContaining(marker: string): string {
  const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(MIG_DIR, f), "utf8");
    if (body.includes(marker)) return body;
  }
  throw new Error(`No se encontró migración con marker: ${marker}`);
}

const MARCA = "CREATE OR REPLACE FUNCTION public.proveedor_estado_cuenta";

describe("N2 — proveedor_estado_cuenta resta notas de crédito", () => {
  const sql = readLatestContaining(MARCA);
  const espejo = fs.readFileSync(ESPEJO, "utf8");

  for (const [nombre, cuerpo] of [["migración vigente", sql], ["espejo canónico", espejo]] as const) {
    it(`${nombre}: incluye las notas de crédito 'Aplicada' vivas`, () => {
      expect(cuerpo).toContain("nc_por_factura");
      expect(cuerpo).toContain("public.proveedor_notas_credito");
      expect(cuerpo).toContain("nc.estado = 'Aplicada'");
      expect(cuerpo).toContain("nc.deleted_at IS NULL");
    });

    it(`${nombre}: convierte la NC con el canon monto_pago_en_moneda_factura`, () => {
      expect(cuerpo).toContain("public.monto_pago_en_moneda_factura(nc.monto");
      expect(cuerpo).toContain("nc.tipo_cambio");
    });

    it(`${nombre}: suma la NC a lo pagado antes de prorratear al concepto`, () => {
      expect(cuerpo).toContain("COALESCE(ncf.nc_aplicada, 0)");
      expect(cuerpo).toContain("LEFT JOIN nc_por_factura ncf");
    });
  }
});
