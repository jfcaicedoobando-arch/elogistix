import vectors from "../../../tests/contracts/money.json" with { type: "json" };
import { roundMoney, saldoMonetario } from "./money.ts";

Deno.test("money contract matches frontend and Postgres numeric reference vectors", () => {
  for (const { input, rounded } of vectors) {
    if (roundMoney(input) !== rounded) throw new Error(`roundMoney(${input}) != ${rounded}`);
    if (saldoMonetario(input, []) !== rounded) throw new Error(`saldoMonetario(${input}) != ${rounded}`);
  }
  if (saldoMonetario(10.075, [1.005, -1.005]) !== 10.08) throw new Error("cancellation drift");
});
Deno.test("fiscal balance rejects non-finite amounts", () => {
  for (const input of [NaN, Infinity, -Infinity]) {
    let rejected = false;
    try { saldoMonetario(100, [input]); } catch { rejected = true; }
    if (!rejected) throw new Error("Invalid amount accepted");
  }
});
