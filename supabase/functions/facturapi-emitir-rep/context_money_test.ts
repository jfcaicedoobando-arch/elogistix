import { calcularParcialidad } from "./context.ts";

Deno.test("REP balance rounds signed ties and decimal cancellation canonically", () => {
  const negative = calcularParcialidad(null, "current", -1.005, 0);
  if (negative.saldoAnt !== -1.01 || negative.saldoInsoluto !== -1.01) throw new Error("negative half mismatch");
  const result = calcularParcialidad([
    { id: "previous", monto_aplicado_factura: 1.005 },
    { id: "current", monto_aplicado_factura: 1 },
  ], "current", 10.075, 1, -1.005);
  if (result.numParcialidad !== 2 || result.saldoAnt !== 10.08 || result.saldoInsoluto !== 9.08) {
    throw new Error(`decimal cancellation mismatch: ${JSON.stringify(result)}`);
  }
});
Deno.test("REP balance rejects an invalid amount before fiscal emission", () => {
  let rejected = false;
  try { calcularParcialidad(null, "current", 10, Infinity); } catch { rejected = true; }
  if (!rejected) throw new Error("Infinite payment accepted");
});
