// @vitest-environment node
import { expect, it } from "vitest";
import { requiredFlowFailures } from "../../scripts/e2e/requiredFlows";
const spec = (file: string, status: string) => ({ file, tests: [{ results: [{ status }] }] });
it("no confunde otros tests ejecutados con la sustitución requerida omitida", () => {
  const report = { suites: [{ specs: [spec("09-cierre.spec.ts", "passed"), spec("25-sustituir-cfdi.spec.ts", "skipped")] }] };
  expect(requiredFlowFailures(report, ["25"])).toEqual(["25"]);
});
it("falla si un flujo no está en el reporte o tiene un paso fallido", () => {
  const report = { suites: [{ file: "12-cxp.spec.ts", suites: [{ specs: [spec("", "passed"), spec("", "failed")] }] }] };
  expect(requiredFlowFailures(report, ["08", "12"])).toEqual(["08", "12"]);
});
it("acepta sólo resultados finales pasados del flujo completo", () => {
  expect(requiredFlowFailures({ suites: [{ specs: [spec("e2e/specs/25-sustituir.spec.ts", "passed")] }] }, ["25"])).toEqual([]);
  expect(() => requiredFlowFailures({}, ["99"])).toThrow("inválido");
});
