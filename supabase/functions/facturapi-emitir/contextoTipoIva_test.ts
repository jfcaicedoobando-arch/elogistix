/**
 * P1-IVA (ajuste residual) — un `concepto_factura` SIN tratamiento fiscal
 * reconocido nunca llega al payload: `cargarContexto` responde 422
 * `tipo_iva_indeterminado` antes de construir el CFDI.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cargarContexto } from "./contexto.ts";

type Fila = Record<string, unknown>;

/** Cliente mínimo: `clientes` (maybeSingle) y `conceptos_factura` (thenable). */
function fakeSupabase(conceptos: Fila[]) {
  const cliente = {
    id: "c1", nombre: "ACME SA de CV", rfc: "AAA010101AAA",
    codigo_postal: "64000", regimen_fiscal: "601", uso_cfdi_default: "G03",
  };
  const chain = (payload: { data: unknown; error: null }) => {
    const self: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "not", "order", "limit"]) self[m] = () => self;
    self.maybeSingle = () => Promise.resolve(payload);
    self.then = (res: (v: unknown) => unknown) => Promise.resolve(payload).then(res);
    return self;
  };
  return {
    from: (tabla: string) => {
      if (tabla === "clientes") return chain({ data: cliente, error: null });
      if (tabla === "conceptos_factura") return chain({ data: conceptos, error: null });
      return chain({ data: null, error: null });
    },
  } as unknown as Parameters<typeof cargarContexto>[0];
}

const factura = {
  id: "f1", cliente_id: "c1", subtotal: 1000, moneda: "MXN", tipo_cambio: 1,
  serie: "A", forma_pago: "03", metodo_pago: "PUE", uso_cfdi: "G03",
} as unknown as Parameters<typeof cargarContexto>[2];

const conceptoBase = {
  descripcion: "Flete marítimo", cantidad: 1, precio_unitario: 1000,
  clave_sat: "78101800", clave_unidad: "E48",
};

Deno.test("concepto sin tipo_iva: 422 tipo_iva_indeterminado, no llega al payload", async () => {
  const res = await cargarContexto(
    fakeSupabase([{ ...conceptoBase, tipo_iva: null, tasa_iva_aplicada: 0.16 }]),
    "f1", factura, null,
  );
  if (!(res instanceof Response)) throw new Error("Se armó el contexto con un concepto sin tratamiento fiscal");
  assertEquals(res.status, 422);
  const body = await res.json();
  assertEquals(body.error, "tipo_iva_indeterminado");
  assertStringIncludes(body.message, "Flete marítimo");
});

Deno.test("concepto sin tipo_iva y tasa 0: tampoco se resuelve como tasa 0% / exento", async () => {
  for (const fila of [
    { ...conceptoBase, tipo_iva: null, tasa_iva_aplicada: 0 },
    { ...conceptoBase, tipo_iva: "desconocido", tasa_iva_aplicada: 0.16 },
  ]) {
    const res = await cargarContexto(fakeSupabase([fila]), "f1", factura, null);
    if (!(res instanceof Response)) throw new Error("Se armó el contexto con un tratamiento no reconocido");
    assertEquals(res.status, 422);
    assertEquals((await res.json()).error, "tipo_iva_indeterminado");
  }
});

Deno.test("concepto con tratamiento explícito sí construye el contexto", async () => {
  const res = await cargarContexto(
    fakeSupabase([{ ...conceptoBase, tipo_iva: "no_objeto", tasa_iva_aplicada: null }]),
    "f1", factura, null,
  );
  if (res instanceof Response) throw new Error(`Bloqueó un concepto válido: ${await res.text()}`);
  assertEquals(res.conceptos.length, 1);
  assertEquals(res.conceptos[0].tipo_iva, "no_objeto");
  assertEquals(res.conceptos[0].tasa_iva, 0);
});
