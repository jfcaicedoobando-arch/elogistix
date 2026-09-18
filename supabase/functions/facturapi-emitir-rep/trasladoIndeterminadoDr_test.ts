/**
 * P1-IVA — El REP no infiere tasas: un renglón sin tratamiento registrado (o con
 * una tasa que contradice su tratamiento) devuelve "indeterminado" y el
 * encabezado sólo sirve de respaldo cuando el cociente cae exacto en el catálogo.
 */
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { resolverTrasladoDr, trasladoDesdeEncabezado } from "./trasladoDr.ts";

Deno.test("un renglón sin tipo_iva ya no cae al 16%", () => {
  assertEquals(resolverTrasladoDr([{ tasa_iva_aplicada: 0.16 }]), "indeterminado");
  assertEquals(resolverTrasladoDr([{ tipo_iva: null, tasa_iva_aplicada: null }]), "indeterminado");
  assertEquals(resolverTrasladoDr([{ tipo_iva: "gravado_11", tasa_iva_aplicada: 0.11 }]), "indeterminado");
});

Deno.test("tipo y tasa contradictorios son indeterminados", () => {
  assertEquals(
    resolverTrasladoDr([{ tipo_iva: "gravado_16", tasa_iva_aplicada: 0.08 }]),
    "indeterminado",
  );
  assertEquals(
    resolverTrasladoDr([{ tipo_iva: "tasa_0", tasa_iva_aplicada: 0.16 }]),
    "indeterminado",
  );
});

Deno.test("tratamientos válidos siguen resolviendo su tasa canónica", () => {
  assertEquals(resolverTrasladoDr([{ tipo_iva: "gravado_16" }]), { tasa: 0.16, factor: "Tasa" });
  assertEquals(resolverTrasladoDr([{ tipo_iva: "gravado_8", tasa_iva_aplicada: 0.08 }]), {
    tasa: 0.08,
    factor: "Tasa",
  });
  assertEquals(resolverTrasladoDr([{ tipo_iva: "tasa_0", tasa_iva_aplicada: 0 }]), {
    tasa: 0,
    factor: "Tasa",
  });
  assertEquals(resolverTrasladoDr([{ tipo_iva: "exento" }]), { tasa: 0, factor: "Exento" });
});

Deno.test("el respaldo por encabezado sólo acepta tasas exactas del catálogo", () => {
  assertEquals(trasladoDesdeEncabezado(1000, 160), { tasa: 0.16, factor: "Tasa" });
  assertEquals(trasladoDesdeEncabezado(1000, 80), { tasa: 0.08, factor: "Tasa" });
  assertEquals(trasladoDesdeEncabezado(1000, 120), null); // promedio: no se ancla
  assertEquals(trasladoDesdeEncabezado(1000, 0), null); // exento vs tasa 0: indistinguible
  assertEquals(trasladoDesdeEncabezado(0, 0), null);
});
