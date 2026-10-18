// Build-time only: keep product sources untouched until the adoption gate passes.
const routes = {
  table: "src/features/facturacion/components/FacturaManualConceptosTable.tsx",
  dialog: "src/features/facturacion/components/DialogNuevaFacturaManual.tsx",
  form: "src/features/facturacion/hooks/useFacturaManualForm.ts",
};
const totals = "calcularTotalesConceptos(conceptos, tasaIva)";
const valid = `conceptos.every(
    (c) => c.descripcion.trim().length > 0 && Number(c.cantidad) > 0 && Number(c.precio_unitario) >= 0,
  )`;
const estimated = `sumarSubtotales(conceptos, (c) => ({
    cantidad: Number(c.cantidad), precioUnitario: Number(c.precio_unitario),
  }))`;

function target(id) {
  const path = id.replaceAll("\\", "/").split("?")[0];
  return Object.entries(routes).find(([, route]) => path === route || path.endsWith(`/${route}`))?.[0];
}

function replaceOne(code, before, after) {
  const first = code.indexOf(before);
  if (first < 0 || code.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Invoice benchmark source drift: expected exactly one ${JSON.stringify(before)}`);
  }
  return code.slice(0, first) + after + code.slice(first + before.length);
}

/** Minimal candidate, applied by the isolated demo's Vite plugin only. */
export function transformCandidate(code, id) {
  const kind = target(id);
  if (!kind) return code;
  let next = code.replaceAll("\r\n", "\n");
  if (kind === "table") {
    next = replaceOne(next, 'import { Plus, Trash2 } from "lucide-react";',
      'import { memo } from "react";\nimport { Plus, Trash2 } from "lucide-react";');
    next = replaceOne(next,
      "export function FacturaManualConceptosTable({ conceptos, moneda, onChange }: Props) {",
      "export const FacturaManualConceptosTable = memo(function FacturaManualConceptosTable({ conceptos, moneda, onChange }: Props) {");
    if (!next.endsWith("\n}\n")) throw new Error("Invoice benchmark source drift: table closing brace");
    return next.slice(0, -3) + "\n});\n";
  }
  if (kind === "dialog") {
    next = replaceOne(next, 'import { FilePlus2 } from "lucide-react";',
      'import { useMemo } from "react";\nimport { FilePlus2 } from "lucide-react";');
    return replaceOne(next, `const totales = ${totals};`,
      `const totales = useMemo(() => ${totals}, [conceptos, tasaIva]);`);
  }
  next = replaceOne(next, `const conceptosValidos = ${valid};`,
    `const conceptosValidos = useMemo(() => ${valid}, [conceptos]);`);
  return replaceOne(next, `const totalEstimado = ${estimated};`,
    `const totalEstimado = useMemo(() => ${estimated}, [conceptos]);`);
}

// Counters belong exclusively to separate attribution builds. A callback counter
// stays inside useMemo, so it counts executed work rather than parent renders.
const bump = (key) => `((globalThis.__invoiceAttribution ??= {}).${key} = (globalThis.__invoiceAttribution.${key} ?? 0) + 1)`;

/** Apply after transformCandidate for the candidate attribution build. */
export function instrumentAttribution(code, id) {
  const kind = target(id);
  if (!kind) return code;
  let next = code.replaceAll("\r\n", "\n");
  if (kind === "table") {
    const signature = "({ conceptos, moneda, onChange }: Props) {\n";
    return replaceOne(next, signature, `${signature}  ${bump("tableRender")};\n`);
  }
  if (kind === "dialog") {
    return replaceOne(next, totals, `(${bump("totalsCalculation")}, ${totals})`);
  }
  next = replaceOne(next, valid, `(${bump("conceptsValidation")}, ${valid})`);
  return replaceOne(next, estimated, `(${bump("estimatedSubtotal")}, ${estimated})`);
}
