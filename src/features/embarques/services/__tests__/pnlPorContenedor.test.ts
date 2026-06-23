import { describe, it, expect } from "vitest";
import { calcularPnlPorContenedor } from "../pnlPorContenedor";
import type { EmbarqueContenedor } from "@/features/embarques/types/contenedor";
import type {
  ConceptoVentaRow,
  ConceptoCostoRow,
} from "@/features/embarques/types/embarque";

const mkCont = (id: string, orden: number, num = `CONT${orden}`): EmbarqueContenedor =>
  ({
    id,
    embarque_id: "emb-1",
    organization_id: "org",
    numero_contenedor: num,
    tipo_contenedor: "40HC",
    bl_house: "",
    peso_kg: 0,
    volumen_m3: 0,
    piezas: 0,
    orden,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    deleted_by: null,
    fecha_descarga: null,
    fecha_devolucion: null,
    dias_libres_override: null,
  }) as EmbarqueContenedor;

const mkVenta = (
  total: number,
  moneda: "USD" | "MXN" = "USD",
  contenedor_id: string | null = null,
): ConceptoVentaRow =>
  ({
    id: `v-${Math.random()}`,
    embarque_id: "emb-1",
    organization_id: "org",
    descripcion: "x",
    cantidad: 1,
    precio_unitario: total,
    moneda,
    total,
    created_at: "",
    estado_facturacion: "pendiente",
    proforma_id: null,
    aplica_iva: false,
    deleted_at: null,
    deleted_by: null,
    contenedor_id,
    tasa_iva_aplicada: 0.16,
    origen: "manual",
  }) as ConceptoVentaRow;

const mkCosto = (
  monto: number,
  moneda: "USD" | "MXN" = "USD",
  contenedor_id: string | null = null,
): ConceptoCostoRow =>
  ({
    id: `c-${Math.random()}`,
    embarque_id: "emb-1",
    organization_id: "org",
    proveedor_id: null,
    proveedor_nombre: "",
    concepto: "x",
    monto,
    moneda,
    estado_liquidacion: "Pendiente",
    fecha_pago: null,
    referencia_pago: null,
    fecha_vencimiento: null,
    created_at: "",
    deleted_at: null,
    deleted_by: null,
    contenedor_id,
    tasa_iva_aplicada: 0.16,
    origen: "manual",
  }) as ConceptoCostoRow;

describe("calcularPnlPorContenedor (v13.66.14)", () => {
  it("1 contenedor sin generales: directo = total", () => {
    const c = mkCont("c1", 1);
    const r = calcularPnlPorContenedor({
      expediente: "ELIMP00100",
      contenedores: [c],
      conceptosVenta: [mkVenta(1000, "USD", "c1")],
      conceptosCosto: [mkCosto(600, "USD", "c1")],
    });
    expect(r.USD).toHaveLength(2); // contenedor + total
    expect(r.USD[0].subexpediente).toBe("ELIMP00100-01");
    expect(r.USD[0].ventaTotal).toBe(1000);
    expect(r.USD[0].costoTotal).toBe(600);
    expect(r.USD[0].utilidad).toBe(400);
    expect(r.USD[1].esTotal).toBe(true);
    expect(r.USD[1].ventaTotal).toBe(1000);
  });

  it("3 contenedores + costo general 100 USD: prorrateo flat con residuo al último", () => {
    const conts = [mkCont("a", 1), mkCont("b", 2), mkCont("c", 3)];
    const r = calcularPnlPorContenedor({
      expediente: "ELIMP00200",
      contenedores: conts,
      conceptosVenta: [],
      conceptosCosto: [mkCosto(100, "USD", null)],
    });
    const filasCont = r.USD.filter((f) => !f.esTotal && !f.esGenerales);
    expect(filasCont.map((f) => f.costoProrrateado)).toEqual([33.33, 33.33, 33.34]);
    const total = r.USD.find((f) => f.esTotal)!;
    expect(total.costoTotal).toBe(100);
  });

  it("no mezcla monedas: regresa una sub-tabla por moneda", () => {
    const conts = [mkCont("a", 1), mkCont("b", 2)];
    const r = calcularPnlPorContenedor({
      expediente: "EXP",
      contenedores: conts,
      conceptosVenta: [mkVenta(500, "USD", "a"), mkVenta(2000, "MXN", "b")],
      conceptosCosto: [mkCosto(300, "USD", null)],
    });
    expect(Object.keys(r).sort()).toEqual(["MXN", "USD"]);
    expect(r.USD.find((f) => f.esTotal)!.ventaTotal).toBe(500);
    expect(r.MXN.find((f) => f.esTotal)!.ventaTotal).toBe(2000);
    // MXN no tiene costo general USD
    expect(r.MXN.find((f) => f.esTotal)!.costoTotal).toBe(0);
  });

  it("concepto con contenedor_id inexistente cae a Generales", () => {
    const conts = [mkCont("a", 1)];
    const r = calcularPnlPorContenedor({
      expediente: "EXP",
      contenedores: conts,
      conceptosVenta: [],
      conceptosCosto: [mkCosto(50, "USD", "borrado-xxx")],
    });
    const a = r.USD.find((f) => f.contenedorId === "a")!;
    expect(a.costoProrrateado).toBe(50);
    const generales = r.USD.find((f) => f.esGenerales);
    expect(generales?.costoTotal).toBe(50);
  });

  it("embarque sin contenedores: sólo fila Generales + Total", () => {
    const r = calcularPnlPorContenedor({
      expediente: "EXP",
      contenedores: [],
      conceptosVenta: [mkVenta(500, "USD", null)],
      conceptosCosto: [mkCosto(200, "USD", null)],
    });
    expect(r.USD.filter((f) => f.esGenerales)).toHaveLength(1);
    const total = r.USD.find((f) => f.esTotal)!;
    expect(total.ventaTotal).toBe(500);
    expect(total.costoTotal).toBe(200);
    expect(total.utilidad).toBe(300);
  });

  it("ignora conceptos soft-deleted", () => {
    const c = mkCont("a", 1);
    const eliminado = { ...mkVenta(999, "USD", "a"), deleted_at: "2026-01-01" } as ConceptoVentaRow;
    const r = calcularPnlPorContenedor({
      expediente: "EXP",
      contenedores: [c],
      conceptosVenta: [mkVenta(100, "USD", "a"), eliminado],
      conceptosCosto: [],
    });
    expect(r.USD[0].ventaTotal).toBe(100);
  });

  // Sprint 2.2 (13.115.0): edge cases — sin estos tests, un cambio que
  // introduzca división por cero o NaN pasaría desapercibido.
  describe("edge cases — robustez numérica", () => {
    it("0 contenedores activos: no produce NaN ni Infinity", () => {
      const r = calcularPnlPorContenedor({
        expediente: "EXP",
        contenedores: [],
        conceptosVenta: [mkVenta(100, "USD")],
        conceptosCosto: [mkCosto(50, "USD")],
      });
      const filas = r.USD ?? [];
      for (const f of filas) {
        expect(Number.isFinite(f.ventaTotal)).toBe(true);
        expect(Number.isFinite(f.costoTotal)).toBe(true);
        expect(Number.isFinite(f.utilidad)).toBe(true);
        expect(Number.isFinite(f.margenPct)).toBe(true);
        expect(Number.isNaN(f.margenPct)).toBe(false);
      }
    });

    it("venta = 0: margen es 0 (no NaN por división)", () => {
      const c = mkCont("a", 1);
      const r = calcularPnlPorContenedor({
        expediente: "EXP",
        contenedores: [c],
        conceptosVenta: [],
        conceptosCosto: [mkCosto(100, "USD", "a")],
      });
      expect(r.USD[0].ventaTotal).toBe(0);
      expect(r.USD[0].margenPct).toBe(0);
      expect(Number.isNaN(r.USD[0].margenPct)).toBe(false);
    });

    it("todos los montos en 0: filas existen y son ceros limpios", () => {
      const c = mkCont("a", 1);
      const r = calcularPnlPorContenedor({
        expediente: "EXP",
        contenedores: [c],
        conceptosVenta: [mkVenta(0, "USD", "a")],
        conceptosCosto: [mkCosto(0, "USD", "a")],
      });
      const fila = r.USD[0];
      expect(fila.ventaTotal).toBe(0);
      expect(fila.costoTotal).toBe(0);
      expect(fila.utilidad).toBe(0);
      expect(fila.margenPct).toBe(0);
    });

    it("contenedor con id duplicado en concepto: no genera división rara", () => {
      const c = mkCont("a", 1);
      const r = calcularPnlPorContenedor({
        expediente: "EXP",
        contenedores: [c],
        conceptosVenta: [mkVenta(33.33, "USD", "a"), mkVenta(33.33, "USD", "a"), mkVenta(33.34, "USD", "a")],
        conceptosCosto: [],
      });
      // 33.33 + 33.33 + 33.34 = 100, no debe haber drift de redondeo > 0.01
      expect(Math.abs(r.USD[0].ventaTotal - 100)).toBeLessThanOrEqual(0.01);
    });
  });
});
