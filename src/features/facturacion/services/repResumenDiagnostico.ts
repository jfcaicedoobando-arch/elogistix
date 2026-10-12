/** Only the REP parity fields returned by the preflight belong in diagnostics. */
import { safeReportValue } from "@/lib/diagnostics/safeReportValue";

type Diagnostic = Record<string, unknown>;

function registro(value: unknown): object | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

/** Inspect only requested own data properties, never getters or foreign keys. */
function propia(source: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch { return undefined; }
}

function seleccionar(
  source: object,
  keys: readonly string[],
  accepts: (value: unknown) => boolean,
): Diagnostic {
  const result: Diagnostic = {};
  for (const key of keys) {
    const value = propia(source, key);
    if (accepts(value)) result[key] = safeReportValue(value);
  }
  return result;
}

const numeroONull = (value: unknown) => value === null || (typeof value === "number" && Number.isFinite(value));
const textoONull = (value: unknown) => value === null || typeof value === "string";

function impuesto(value: unknown): Diagnostic | undefined {
  const source = registro(value);
  if (!source) return undefined;
  const result = {
    ...seleccionar(source, ["type"], textoONull),
    ...seleccionar(source, ["rate", "base"], numeroONull),
    ...seleccionar(source, ["withholding"], value => value === null || typeof value === "boolean"),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Fits the existing diagnostic limit: 99 inspected positions plus one notice.
 * `included` counts source positions inspected; invalid entries are filtered.
 * Read index descriptors so an array accessor never runs through slice/map. */
function lista(value: unknown, select: (entry: unknown) => unknown): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const total = propia(value, "length");
  if (typeof total !== "number" || !Number.isFinite(total)) return undefined;
  const included = total > 100 ? 99 : total;
  const result: unknown[] = [];
  for (let index = 0; index < included; index += 1) {
    const selected = select(propia(value, String(index)));
    if (selected !== undefined) result.push(selected);
  }
  // The notice is appended after selection, never interpreted as a tax row.
  if (included < total) result.push({ __diagnosticTruncation: { kind: "array", total, included, omitted: total - included } });
  return result;
}

function resumen(value: unknown): Diagnostic | null | undefined {
  if (value === null) return null;
  const source = registro(value);
  if (!source) return undefined;
  const result: Diagnostic = {
    ...seleccionar(source, ["installment", "last_balance", "amount"], numeroONull),
    ...seleccionar(source, ["currency"], textoONull),
  };
  const taxes = propia(source, "taxes");
  if (taxes === null) result.taxes = null;
  else {
    const selected = lista(taxes, impuesto);
    if (selected !== undefined) result.taxes = selected;
  }
  return result;
}

/** No provider UUID, raw body, credentials or unrelated metadata is retained.
 * Numbers/nulls are preserved as received: no rounding or currency conversion. */
export function diagnosticoResumenRep(body: unknown): Diagnostic | undefined {
  const source = registro(body);
  if (!source || propia(source, "error") !== "rep_resumen_divergente") return undefined;
  const result: Diagnostic = {
    ...seleccionar(source, ["moneda"], textoONull),
    ...seleccionar(source, ["tolerancia"], numeroONull),
  };
  const divergencias = lista(propia(source, "divergencias"), value => typeof value === "string" ? safeReportValue(value) : undefined);
  if (divergencias !== undefined) result.divergencias = divergencias;
  for (const field of ["local", "proveedor"]) {
    const selected = resumen(propia(source, field));
    if (selected !== undefined) result[field] = selected;
  }
  return result;
}
