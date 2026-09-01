/**
 * Bloqueador de publicación: `fetchFacturasCxP` leía un solo `.range()` de 200
 * filas y luego filtraba estatus/origen en memoria. Las facturas posteriores a
 * la 200 nunca aparecían, un filtro cuya única coincidencia estaba después
 * decía "sin resultados" y los KPIs salían incompletos.
 *
 * Estas pruebas fijan el contrato: se leen lotes consecutivos hasta uno
 * incompleto, con orden determinista (fecha_vencimiento + id) y filtros
 * derivados aplicados sobre el conjunto completo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Fila {
  id: string;
  estado: string;
  estado_aprobacion: string;
  fecha_vencimiento: string | null;
  origen: "Nacional" | "Extranjero";
  total: number;
}

const estado = {
  filas: [] as Fila[],
  rangos: [] as Array<[number, number]>,
  ordenes: [] as string[],
  eqs: [] as Array<[string, string]>,
  errorEnLote: null as number | null,
};

function toJoined(f: Fila) {
  return {
    id: f.id,
    proveedor_id: "p1",
    proveedor_nombre: "Proveedor 1",
    embarque_id: null,
    folio_proveedor: `FP-${f.id}`,
    folio_interno: `FI-${f.id}`,
    fecha_emision: "2026-01-01",
    fecha_vencimiento: f.fecha_vencimiento,
    moneda: "MXN",
    subtotal: f.total,
    iva: 0,
    ieps: 0,
    retenciones: 0,
    total: f.total,
    estado: f.estado,
    tipo_cambio_usd: 1,
    rfc_proveedor: null,
    uuid_fiscal: null,
    dias_credito: 30,
    notas: null,
    estado_aprobacion: f.estado_aprobacion,
    motivo_rechazo: null,
    categoria_presupuesto_id: null,
    archivo_xml_url: null,
    archivo_pdf_url: null,
    uuid_verificado: false,
    uuid_verificado_fecha: null,
    uuid_estatus_sat: null,
    fecha_programada_pago: null,
    fecha_cancelacion: null,
    motivo_cancelacion: null,
    cancelada_por: null,
    created_by: null,
    pagos_proveedor: [],
    proveedor_notas_credito: [],
    proveedores: { origen_proveedor: f.origen },
    embarques: null,
    presupuesto_categorias: null,
  };
}

/** Mock que simula el servidor: ordena y corta por rango como Postgres. */
function builder(): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  let rango: [number, number] = [0, 999];
  let excluyeCanceladas = false;
  const chain = (nombre: string) => (...args: unknown[]) => {
    if (nombre === "range") {
      rango = [args[0] as number, args[1] as number];
      estado.rangos.push(rango);
    }
    if (nombre === "order") estado.ordenes.push(String(args[0]));
    if (nombre === "neq" && args[0] === "estado") excluyeCanceladas = true;
    if (nombre === "eq") estado.eqs.push([String(args[0]), String(args[1])]);
    return b;
  };
  for (const m of ["select", "is", "neq", "eq", "or", "gte", "lte", "order", "range", "in"]) {
    b[m] = chain(m);
  }
  b.then = (resolve: (v: unknown) => unknown) => {
    const loteIdx = estado.rangos.length - 1;
    if (estado.errorEnLote === loteIdx) {
      return resolve({ data: null, error: { message: "lote roto" } });
    }
    let filas = estado.filas;
    if (excluyeCanceladas) filas = filas.filter((f) => f.estado !== "Cancelada");
    for (const [col, val] of estado.eqs) {
      if (col === "estado_aprobacion") filas = filas.filter((f) => f.estado_aprobacion === val);
    }
    // Orden determinista con desempate por id, igual que el servicio pide.
    const ordenadas = [...filas].sort((a, z) =>
      (a.fecha_vencimiento ?? "9999").localeCompare(z.fecha_vencimiento ?? "9999") ||
      a.id.localeCompare(z.id),
    );
    const page = ordenadas.slice(rango[0], rango[1] + 1).map(toJoined);
    return resolve({ data: page, error: null });
  };
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => builder() } }));

const { fetchFacturasCxP, calcularKPIsCxP } = await import("../proveedorFacturas");

function generar(n: number, over: (i: number) => Partial<Fila> = () => ({})): Fila[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `f${String(i).padStart(4, "0")}`,
    estado: "Vigente",
    estado_aprobacion: "aprobada",
    fecha_vencimiento: `2026-${String((i % 12) + 1).padStart(2, "0")}-15`,
    origen: "Nacional" as const,
    total: 100,
    ...over(i),
  }));
}

beforeEach(() => {
  estado.filas = [];
  estado.rangos = [];
  estado.ordenes = [];
  estado.eqs = [];
  estado.errorEnLote = null;
});

describe("fetchFacturasCxP — lectura completa por lotes", () => {
  it("con 250 facturas devuelve las 250 (antes se cortaba en 200)", async () => {
    estado.filas = generar(250);
    const rows = await fetchFacturasCxP({});
    expect(rows).toHaveLength(250);
    // La factura #201 en adelante sí llega y la página 3 (100/pág) la muestra.
    expect(rows.slice(200)).toHaveLength(50);
  });

  it("ordena con desempate por id: sin duplicados ni omisiones entre lotes", async () => {
    // 2100 filas con la MISMA fecha de vencimiento fuerzan 3 lotes de 1000.
    estado.filas = generar(2100, () => ({ fecha_vencimiento: "2026-05-15" }));
    const rows = await fetchFacturasCxP({});
    const ids = rows.map((r) => r.id);
    expect(ids).toHaveLength(2100);
    expect(new Set(ids).size).toBe(2100);
    expect(estado.ordenes).toContain("id");
    expect(estado.rangos.length).toBeGreaterThanOrEqual(3);
  });

  it("filtro de estatus cuya única coincidencia está después de la 200", async () => {
    estado.filas = generar(300, (i) => (i === 250 ? { estado: "Borrador" } : {}));
    const rows = await fetchFacturasCxP({ estatus: "Borrador" });
    expect(rows).toHaveLength(1);
    expect(rows[0].estatus).toBe("Borrador");
  });

  it("filtro de origen cuya única coincidencia está después de la 200", async () => {
    estado.filas = generar(300, (i) => (i === 275 ? { origen: "Extranjero" } : {}));
    const rows = await fetchFacturasCxP({ origen: "Extranjero" });
    expect(rows).toHaveLength(1);
    expect(rows[0].proveedor_origen).toBe("Extranjero");
  });

  it("filtro de aprobación cuya única coincidencia está después de la 200", async () => {
    estado.filas = generar(300, (i) => (i === 260 ? { estado_aprobacion: "rechazada" } : {}));
    const rows = await fetchFacturasCxP({ aprobacion: "rechazada" });
    expect(rows).toHaveLength(1);
    expect(rows[0].estado_aprobacion).toBe("rechazada");
    expect(estado.eqs).toContainEqual(["estado_aprobacion", "rechazada"]);
  });

  it("los KPIs incluyen los saldos posteriores a la fila 200", async () => {
    estado.filas = generar(250);
    const rows = await fetchFacturasCxP({});
    const kpis = calcularKPIsCxP(rows);
    // 250 × 100 MXN, no 200 × 100.
    expect(kpis.porPagarMxn).toBeCloseTo(25_000, 2);
  });

  it("sigue excluyendo canceladas por defecto e incluyéndolas al buscar", async () => {
    estado.filas = generar(210, (i) => (i === 205 ? { estado: "Cancelada" } : {}));
    expect(await fetchFacturasCxP({})).toHaveLength(209);
    const conBusqueda = await fetchFacturasCxP({ search: "FP-" });
    expect(conBusqueda).toHaveLength(210);
  });

  it("un error en un lote posterior se propaga (nada parcial como completo)", async () => {
    estado.filas = generar(1500);
    estado.errorEnLote = 1; // el segundo lote falla
    await expect(fetchFacturasCxP({})).rejects.toMatchObject({ message: "lote roto" });
  });
});
