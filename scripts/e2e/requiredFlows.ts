/** El total global puede ser >0 aunque un flujo crítico completo se omita. */
interface Result { status?: string }
interface Test { results?: Result[] }
interface Spec { file?: string; title?: string; tests?: Test[] }
interface Suite { file?: string; specs?: Spec[]; suites?: Suite[] }
export interface E2EReport { suites?: Suite[] }
export function requiredFlowFailures(report: E2EReport, required: string[]): string[] {
  if (required.some(id => !/^(08|09|10|11|12|25|28|30)$/.test(id))) {
    throw new Error("Flujo mutador requerido inválido: " + required.join(","));
  }
  const outcomes = new Map<string, boolean[]>();
  function visit(suite: Suite, parentFile = ""): void {
    const file = suite.file || parentFile;
    for (const spec of suite.specs ?? []) {
      const id = (spec.file || file).replace(/\\/g, "/").split("/").at(-1)?.match(/^(\d{2})-/)?.[1];
      if (!id) continue;
      const passes = (spec.tests ?? []).map(test => test.results?.at(-1)?.status === "passed");
      outcomes.set(id, [...(outcomes.get(id) ?? []), ...passes]);
    }
    for (const child of suite.suites ?? []) visit(child, file);
  }
  for (const suite of report.suites ?? []) visit(suite);
  return [...new Set(required)].filter(id => !outcomes.get(id)?.length || outcomes.get(id)!.some(passed => !passed));
}
