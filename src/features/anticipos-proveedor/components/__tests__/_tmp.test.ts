import { describe, it } from "vitest";
import { buildSchema } from "@/features/anticipos-proveedor/components/AplicarAnticipoDialog";
describe("x", () => { it("y", () => {
  const r = buildSchema(1000, "EUR").safeParse({ facturaId: "11111111-1111-1111-1111-111111111111", saldoFactura: 5000, monedaFactura: "EUR", monto: 900, fechaAplicacion: "2026-06-10" });
  console.log(JSON.stringify(r, null, 1));
  const r2 = buildSchema(1000, "USD").safeParse({ facturaId: "11111111-1111-1111-1111-111111111111", saldoFactura: 5000, monedaFactura: "USD", monto: 1500, fechaAplicacion: "2026-06-10" });
  console.log(JSON.stringify(r2.error?.issues));
}); });
