import { describe, it, expect } from "vitest";
import { avisoFechaEmisionDesfasada } from "@/features/facturacion/utils/avisoFechaTimbrado";
import { buildEstadoTimbrado } from "@/features/facturacion/utils/estadoTimbrado";
import { hoyMx } from "@/lib/date/mx";

const BASE = new Date("2026-09-18T19:04:28.071Z");
const HOY = hoyMx(BASE);

describe("avisoFechaEmisionDesfasada", () => {
  it("no avisa cuando la factura ya está fechada hoy", () => {
    expect(avisoFechaEmisionDesfasada(HOY, BASE)).toBeNull();
    expect(avisoFechaEmisionDesfasada(null, BASE)).toBeNull();
  });

  it("avisa que se emitirá con la fecha de hoy y el TC DOF del día", () => {
    const aviso = avisoFechaEmisionDesfasada("2026-09-17", BASE);
    expect(aviso).toMatch(/2026-09-17/);
    expect(aviso).toMatch(/fecha de hoy/i);
    expect(aviso).toMatch(/DOF/);
  });
});

describe("buildEstadoTimbrado con fecha desfasada", () => {
  const cliente = { rfc: "XAXX010101000", codigo_postal: "64000", regimen_fiscal: "601" };
  const seleccion = { usoCfdi: "G03", formaPago: "03", metodoPago: "PUE" };

  it("la fecha desfasada advierte pero NO bloquea el timbrado", () => {
    const listo = buildEstadoTimbrado(
      { rfc_cliente: cliente.rfc, moneda: "MXN", tipo_cambio: 1, fecha_emision: hoyMx() },
      cliente, seleccion,
    );
    const desfasada = buildEstadoTimbrado(
      { rfc_cliente: cliente.rfc, moneda: "MXN", tipo_cambio: 1, fecha_emision: "2020-01-01" },
      cliente, seleccion,
    );
    expect(listo.puedeTimbrar).toBe(desfasada.puedeTimbrar);
    expect(desfasada.advertencias.some((a) => /2020-01-01/.test(a))).toBe(true);
    expect(listo.advertencias).toHaveLength(0);
  });
});
