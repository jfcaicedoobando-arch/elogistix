import { readFileSync } from "node:fs";
import { requiredFlowFailures } from "./requiredFlows";
const file = process.argv[2];
if (!file) throw new Error("Indica el reporte JSON de Playwright");
const required = (process.env.E2E_REQUIRED_FLOWS ?? "08,11,12,25").split(",").map(x => x.trim()).filter(Boolean);
if (!required.length) throw new Error("Debe declararse al menos un flujo crítico requerido");
const failures = requiredFlowFailures(JSON.parse(readFileSync(file, "utf8")), required);
if (failures.length) throw new Error("Flujos requeridos ausentes, omitidos o fallidos: " + failures.join(", "));
console.log("Flujos requeridos completos: " + required.join(", "));
