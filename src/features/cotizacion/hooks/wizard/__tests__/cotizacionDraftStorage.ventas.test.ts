import { beforeEach, expect, it } from "vitest";
import { draftKey, loadDraft } from "../cotizacionDraftStorage";
const key = draftKey("user", "org");
const venta = { descripcion: "Manual", unidad_medida: "Servicio", cantidad: 1, precio_unitario: 10200, total: 10200, moneda: "MXN", aplica_iva: false, tasa_iva_aplicada: 0, tipo_iva: "no_objeto", clave_sat: "78101800", notas: "Conservar" };
const draft = () => ({ version: 4, userId: "user", organizationId: "org", savedAt: Date.now(), cotizacionId: "quote", updatedAt: "stamp", currentStep: 3, costosInternos: [], costosSincronizados: [], values: { clienteId: "client" }, conceptosUSD: [], conceptosMXN: [venta], tipoCambioUsd: 20.4 });
beforeEach(() => window.localStorage.clear());
it("v4 conserva moneda, precisión, manual sin origen y tratamiento explícito", () => {
  window.localStorage.setItem(key, JSON.stringify(draft()));
  expect(loadDraft("user", "org")).toMatchObject({ version: 4, conceptosUSD: [], conceptosMXN: [venta], tipoCambioUsd: 20.4 });
  expect(loadDraft("user", "org")?.conceptosMXN?.[0]).not.toHaveProperty("origen_costo_id");
});
it.each([
  { userId: "other" }, { organizationId: "other" }, { conceptosUSD: [venta] },
  { conceptosUSD: undefined }, { conceptosMXN: null }, { tipoCambioUsd: "20.4" },
  { tipoCambioUsd: -1 }, { conceptosMXN: [{ ...venta, precio_unitario: "10200" }] },
  { conceptosMXN: [{ ...venta, moneda: "EUR" }] }, { values: null },
])("rechaza snapshot incompleto, malformado o cruzado: %j", patch => {
  window.localStorage.setItem(key, JSON.stringify({ ...draft(), ...patch }));
  expect(loadDraft("user", "org")).toBeNull();
});
it("copiar una clave a otro usuario/tenant no autoriza restaurarla", () => {
  window.localStorage.setItem(draftKey("other", "org"), JSON.stringify(draft()));
  window.localStorage.setItem(draftKey("user", "other"), JSON.stringify(draft()));
  expect(loadDraft("other", "org")).toBeNull();
  expect(loadDraft("user", "other")).toBeNull();
});
it.each([1, 2, 3])("legacy v%s no afirma recuperar ventas e impuestos ausentes", version => {
  window.localStorage.setItem(key, JSON.stringify({ version, savedAt: Date.now(), values: { clienteId: "client" } }));
  expect(loadDraft("user", "org")?.conceptosUSD).toBeUndefined();
  expect(loadDraft("user", "org")?.noRestaurado.join(" ")).toMatch(/ventas e impuestos/);
});
