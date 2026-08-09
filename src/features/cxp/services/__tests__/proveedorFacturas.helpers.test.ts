/**
 * Tests de lógica pura para helpers de CxP.
 * Cubre: diasVencido (signo correcto vs hoy), clasificar (orden de
 * precedencia Pagada/Sin saldo/Vencida/Por vencer/Vigente), mapJoinedRow
 * (suma de pagos vivos, NC sólo Aplicadas, saldo nunca negativo, no
 * mostrar días vencidos cuando ya está pagada) y filtros cliente.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  diasVencido,
  clasificar,
  mapJoinedRow,
  aplicarFiltrosCliente,
  type Joined,
} from "../proveedorFacturas.helpers";
import type { FacturaCxP } from "../proveedorFacturas";

const HOY = new Date("2026-06-26T12:00:00Z");

// v13.137.25: `beforeAll`/`afterAll` no funciona aquí porque el `afterEach`
// global de setup.ts hace `vi.useRealTimers()` entre tests. Tras el primer
// `it`, todos los `diasVencido(...)` calculaban contra la fecha real del
// runner. Movemos a beforeEach/afterEach para re-instalar HOY antes de cada
// caso.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HOY);
});
afterEach(() => vi.useRealTimers());

const baseJoined = (over: Partial<Joined> = {}): Joined => ({
  id: "f1",
  proveedor_id: "p1",
  proveedor_nombre: "ACME",
  embarque_id: null,
  folio_proveedor: "A-1",
  folio_interno: "FP-000001",
  fecha_emision: "2026-06-01",
  fecha_vencimiento: "2026-06-20",
  moneda: "MXN",
  subtotal: 100,
  iva: 16,
  ieps: 0,
  retenciones: 0,
  total: 116,
  estado: "Pendiente" as Joined["estado"],
  tipo_cambio_usd: 17,
  rfc_proveedor: "ACM010101AAA",
  uuid_fiscal: null,
  dias_credito: 30,
  notas: "",
  estado_aprobacion: "aprobada",
  motivo_rechazo: null,
  categoria_presupuesto_id: "",
  archivo_xml_url: null,
  archivo_pdf_url: null,
  uuid_verificado: false,
  uuid_verificado_fecha: null,
  uuid_estatus_sat: null,
 fecha_programada_pago: null,
 fecha_cancelacion: null,
 motivo_cancelacion: null,
 cancelada_por: null,
  pagos_proveedor: null,
  proveedor_notas_credito: null,
  proveedores: { origen_proveedor: "Nacional" },
  embarques: null,
  presupuesto_categorias: null,
  ...over,
});

describe("diasVencido", () => {
  it("devuelve 0 cuando fecha_vencimiento es null", () => {
    expect(diasVencido(null)).toBe(0);
  });
  it("positivo cuando ya pasó (2026-06-20 vs hoy 2026-06-26)", () => {
    expect(diasVencido("2026-06-20")).toBe(6);
  });
  it("diasVencido: negativo cuando aún no vence", () => {
    expect(diasVencido("2026-07-01")).toBe(-5);
  });
});

describe("clasificar", () => {
  // Firma: clasificar(saldo, pagado, dias, estado, aprobacion)
  it("estado Cancelada gana sobre todo", () => {
    expect(clasificar(500, 0, 10, "Cancelada" as never, "aprobada")).toBe("Cancelada");
  });
  it("aprobacion rechazada gana sobre saldo/vencimiento", () => {
    expect(clasificar(500, 0, 10, "Vigente" as never, "rechazada")).toBe("Rechazada");
  });
  it("estado Borrador antes de aprobación pendiente", () => {
    expect(clasificar(100, 0, 0, "Borrador" as never, "pendiente")).toBe("Borrador");
  });
  it("aprobación pendiente ⇒ Por aprobar aunque haya saldo vencido", () => {
    expect(clasificar(100, 0, 10, "Vigente" as never, "pendiente")).toBe("Por aprobar");
  });
  it("estado Pagada ⇒ Pagada", () => {
    expect(clasificar(500, 500, 10, "Pagada" as never, "aprobada")).toBe("Pagada");
  });
  it("saldo ≤ 0.01 ⇒ Pagada", () => {
    expect(clasificar(0.005, 100, 0, "Vigente" as never, "aprobada")).toBe("Pagada");
  });
  it("días > 0 con saldo ⇒ Vencida", () => {
    expect(clasificar(100, 0, 1, "Vigente" as never, "aprobada")).toBe("Vencida");
  });
  it("días entre -5 y 0 ⇒ Por vencer (ventana 5 días)", () => {
    expect(clasificar(100, 0, -5, "Vigente" as never, "aprobada")).toBe("Por vencer");
    expect(clasificar(100, 0, 0, "Vigente" as never, "aprobada")).toBe("Por vencer");
  });
  it("pagos parciales sin vencimiento inminente ⇒ Parcial", () => {
    expect(clasificar(50, 50, -30, "Vigente" as never, "aprobada")).toBe("Parcial");
  });
  it("sin pagos y sin vencimiento cercano ⇒ Vigente", () => {
    expect(clasificar(100, 0, -30, "Vigente" as never, "aprobada")).toBe("Vigente");
  });
});

describe("mapJoinedRow", () => {
  it("suma pagos vivos e ignora pagos eliminados", () => {
    const row = baseJoined({
      pagos_proveedor: [
        { monto: 50, monto_en_moneda_factura: null, deleted_at: null },
        { monto: 999, monto_en_moneda_factura: null, deleted_at: "2026-06-10" }, // ignorado
      ],
    });
    const out = mapJoinedRow(row);
    expect(out.pagado).toBe(50);
    expect(out.saldo).toBe(66); // 116 - 50
  });

  it("sólo cuenta notas de crédito Aplicadas y no eliminadas", () => {
    const row = baseJoined({
      proveedor_notas_credito: [
        { monto: 10, estado: "Aplicada", deleted_at: null },
        { monto: 5, estado: "Cancelada", deleted_at: null },
        { monto: 7, estado: "Aplicada", deleted_at: "2026-01-01" },
      ],
    });
    const out = mapJoinedRow(row);
    expect(out.notas_credito).toBe(10);
    expect(out.saldo).toBe(106);
  });

  it("saldo nunca es negativo aunque pagos+NC excedan total", () => {
    const row = baseJoined({
      total: 100,
      pagos_proveedor: [{ monto: 200, monto_en_moneda_factura: null, deleted_at: null }],
    });
    const out = mapJoinedRow(row);
    expect(out.saldo).toBe(0);
  });

  it("no muestra días vencidos cuando la factura está saldada", () => {
    const row = baseJoined({
      fecha_vencimiento: "2026-01-01",
      total: 100,
      pagos_proveedor: [{ monto: 100, monto_en_moneda_factura: null, deleted_at: null }],
    });
    const out = mapJoinedRow(row);
    expect(out.dias_vencido).toBe(0);
    expect(out.estatus).toBe("Pagada");
  });

  it("propaga origen del proveedor y categoría", () => {
    const row = baseJoined({
      proveedores: { origen_proveedor: "Extranjero" },
      presupuesto_categorias: { nombre: "Logística" },
    });
    const out = mapJoinedRow(row);
    expect(out.proveedor_origen).toBe("Extranjero");
    expect(out.categoria_nombre).toBe("Logística");
  });
});

describe("aplicarFiltrosCliente", () => {
  const f = (over: Partial<FacturaCxP>): FacturaCxP => ({
    ...({} as FacturaCxP),
    ...over,
  });
  const rows: FacturaCxP[] = [
    f({ id: "1", estatus: "Vencida", proveedor_origen: "Nacional", estado_aprobacion: "aprobada" }),
    f({ id: "2", estatus: "Vigente", proveedor_origen: "Extranjero", estado_aprobacion: "pendiente" }),
    f({ id: "3", estatus: "Vencida", proveedor_origen: "Extranjero", estado_aprobacion: "aprobada" }),
  ];

  it("filtro 'todos' no filtra", () => {
    expect(aplicarFiltrosCliente(rows, { estatus: "todos" }).length).toBe(3);
  });
  it("filtra por estatus", () => {
    const r = aplicarFiltrosCliente(rows, { estatus: "Vencida" });
    expect(r.map((x) => x.id)).toEqual(["1", "3"]);
  });
  it("combina estatus + origen + aprobación", () => {
    const r = aplicarFiltrosCliente(rows, {
      estatus: "Vencida",
      origen: "Extranjero",
      aprobacion: "aprobada",
    });
    expect(r.map((x) => x.id)).toEqual(["3"]);
  });
});
