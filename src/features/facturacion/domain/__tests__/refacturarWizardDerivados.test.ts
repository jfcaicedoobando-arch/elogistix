import { describe, it, expect } from "vitest";
import {
  mapearPagos,
  nombreClienteDestino,
  receptorDesdeClientes,
} from "../refacturarWizardDerivados";

const clientes = [
  {
    id: "c-1",
    nombre: "Comercial del Norte SA de CV",
    rfc: "CNO900101AAA",
    regimen_fiscal: "601",
    codigo_postal: "64000",
  },
];

describe("mapearPagos", () => {
  it("normaliza montos de texto a número y rellena campos de REP", () => {
    const [pago] = mapearPagos([
      {
        id: "p-1",
        fecha_pago: "2026-08-01",
        monto: "1234.50",
        moneda: "MXN",
        monto_aplicado_factura: "1000",
      },
    ]);
    expect(pago.monto).toBe(1234.5);
    expect(pago.monto_aplicado_factura).toBe(1000);
    expect(pago.uuid_rep).toBeNull();
    expect(pago.estado_rep).toBeNull();
    expect(pago.rep_cancellation_status).toBeNull();
  });

  it("conserva null en el monto aplicado cuando no hay aplicación", () => {
    const [pago] = mapearPagos([
      {
        id: "p-2",
        fecha_pago: "2026-08-02",
        monto: 500,
        moneda: "USD",
        monto_aplicado_factura: null,
        uuid_rep: "uuid-1",
        estado_rep: "vigente",
        rep_cancellation_status: "verifying",
      },
    ]);
    expect(pago.monto_aplicado_factura).toBeNull();
    expect(pago.uuid_rep).toBe("uuid-1");
    expect(pago.rep_cancellation_status).toBe("verifying");
  });
});

describe("receptorDesdeClientes", () => {
  it("devuelve los datos fiscales del cliente elegido", () => {
    expect(receptorDesdeClientes(clientes, "c-1")).toEqual({
      nombre: "Comercial del Norte SA de CV",
      rfc: "CNO900101AAA",
      regimen_fiscal: "601",
      codigo_postal: "64000",
    });
  });

  it("devuelve null si el cliente no está en la lista", () => {
    expect(receptorDesdeClientes(clientes, "c-9")).toBeNull();
    expect(receptorDesdeClientes(undefined, "c-1")).toBeNull();
  });
});

describe("nombreClienteDestino", () => {
  it("usa un texto genérico cuando aún no hay selección", () => {
    expect(nombreClienteDestino(clientes, null)).toBe("el cliente destino");
    expect(nombreClienteDestino(clientes, "c-1")).toBe("Comercial del Norte SA de CV");
  });
});
