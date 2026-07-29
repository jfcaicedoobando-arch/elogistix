/**
 * H8 (FIX-F964) — el auditor debe bloquear backfills que usan funciones con
 * guard multi-tenant (devuelven 0 sin `auth.uid()` y corrompen datos).
 */
import { describe, it, expect } from "vitest";
import { scanBackfillTenantGuard } from "../../../scripts/lib/audit-sql-signatures";

describe("H8 · backfills con guard multi-tenant", () => {
  it("detecta saldo_factura dentro de un DO con UPDATE", () => {
    const sql = `
      DO $backfill$
      BEGIN
        UPDATE facturas SET estado = 'Pagada'
        WHERE public.saldo_factura(id) <= 0.01;
      END;
      $backfill$;
    `;
    const v = scanBackfillTenantGuard("mig.sql", sql);
    expect(v).toHaveLength(1);
    expect(v[0].check).toBe("H8");
    expect(v[0].detail).toContain("saldo_factura");
  });

  it("no marca un DO sin escrituras", () => {
    const sql = `
      DO $chk$
      BEGIN
        RAISE NOTICE '%', public.saldo_factura(gen_random_uuid());
      END;
      $chk$;
    `;
    expect(scanBackfillTenantGuard("mig.sql", sql)).toHaveLength(0);
  });

  it("no marca un backfill con aritmética directa", () => {
    const sql = `
      DO $fix$
      BEGIN
        UPDATE facturas f SET estado = 'Emitida'
        WHERE f.total - COALESCE((SELECT SUM(p.monto_aplicado_factura)
          FROM pagos_factura p WHERE p.factura_id = f.id), 0) > 0.01;
      END;
      $fix$;
    `;
    expect(scanBackfillTenantGuard("mig.sql", sql)).toHaveLength(0);
  });
});
