/**
 * P2-IVA (seguimiento) — un concepto al 8% (estímulo de región fronteriza) no
 * se timbra mientras `facturacion.iva_frontera_habilitado` esté apagado o
 * ausente. El dato guardado no se altera: sólo se bloquea la emisión.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cargarContexto } from "./contexto.ts";

type Fila = Record<string, unknown>;

function fakeSupabase(conceptos: Fila[], config: Fila | null) {
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
      if (tabla === "configuracion") return chain({ data: config, error: null });
      return chain({ data: null, error: null });
    },
  } as unknown as Parameters<typeof cargarContexto>[0];
}

const factura = {
  id: "f1", cliente_id: "c1", organization_id: "org-1", subtotal: 1000,
  moneda: "MXN", tipo_cambio: 1, serie: "A", forma_pago: "03",
  metodo_pago: "PUE", uso_cfdi: "G03",
} as unknown as Parameters<typeof cargarContexto>[2];

const conceptoFrontera = {
  descripcion: "Maniobras en Tijuana", cantidad: 1, precio_unitario: 1000,
  clave_sat: "78101800", clave_unidad: "E48",
  tipo_iva: "gravado_8", tasa_iva_aplicada: 0.08,
};

Deno.test("8% con el estímulo ausente: 422 iva_frontera_no_habilitado", async () => {
  const res = await cargarContexto(fakeSupabase([conceptoFrontera], null), "f1", factura, null);
  if (!(res instanceof Response)) throw new Error("Se armó el contexto con IVA 8% sin habilitar el estímulo");
  assertEquals(res.status, 422);
  const body = await res.json();
  assertEquals(body.error, "iva_frontera_no_habilitado");
  assertStringIncludes(body.message, "Maniobras en Tijuana");
  assertStringIncludes(body.message, "Configuración");
});

Deno.test("8% con el estímulo apagado explícitamente: también se bloquea", async () => {
  for (const valor of [false, "false", null]) {
    const res = await cargarContexto(
      fakeSupabase([conceptoFrontera], { valor }), "f1", factura, null,
    );
    if (!(res instanceof Response)) throw new Error(`No bloqueó con valor ${JSON.stringify(valor)}`);
    assertEquals((await res.json()).error, "iva_frontera_no_habilitado");
  }
});

Deno.test("8% con el estímulo habilitado: sí construye el contexto y conserva la tasa", async () => {
  for (const valor of [true, "true"]) {
    const res = await cargarContexto(
      fakeSupabase([conceptoFrontera], { valor }), "f1", factura, null,
    );
    if (res instanceof Response) throw new Error(`Bloqueó con el estímulo habilitado: ${await res.text()}`);
    assertEquals(res.conceptos[0].tipo_iva, "gravado_8");
    assertEquals(res.conceptos[0].tasa_iva, 0.08);
  }
});

Deno.test("una factura sin conceptos al 8% no consulta ni depende del estímulo", async () => {
  const res = await cargarContexto(
    fakeSupabase(
      [{ ...conceptoFrontera, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 }],
      null,
    ),
    "f1", factura, null,
  );
  if (res instanceof Response) throw new Error(`Bloqueó una factura al 16%: ${await res.text()}`);
  assertEquals(res.conceptos[0].tipo_iva, "gravado_16");
});
