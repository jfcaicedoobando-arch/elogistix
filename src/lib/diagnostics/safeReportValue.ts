/** Bounded diagnostics; skips custom toJSON/getters (native Error.stack is safe). */
const MAX_DEPTH = 8;
const MAX_ITEMS = 100;
const MAX_STRING = 12000;
const SENSITIVE_KEY = /^(password|passwd|contrase[nñ]a|authorization|cookie|set-cookie|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|client[_-]?secret)$/i;

function objectValue(value: object, depth: number, ancestors: WeakSet<object>): unknown {
  if (ancestors.has(value)) return "[Circular]";
  if (depth >= MAX_DEPTH) return "[Profundidad limitada]";
  ancestors.add(value);
  const result = Array.isArray(value)
    ? arrayValue(value, depth, ancestors)
    : properties(value, depth, ancestors);
  ancestors.delete(value);
  return result;
}

function truncation(kind: "array" | "object", total: number, included: number) {
  return { __diagnosticTruncation: { kind, total, included, omitted: total - included } };
}

function arrayValue(value: unknown[], depth: number, ancestors: WeakSet<object>) {
  const included = value.length > MAX_ITEMS ? MAX_ITEMS - 1 : value.length;
  const result = value.slice(0, included).map((item) => normalize(item, depth + 1, ancestors));
  if (included < value.length) result.push(truncation("array", value.length, included));
  return result;
}

function properties(value: object, depth: number, ancestors: WeakSet<object>) {
  const result: Record<string, unknown> = {};
  if (value instanceof Error) result.name = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(value), "name")?.value ?? "Error";
  const allNames = Object.getOwnPropertyNames(value);
  const names = allNames.slice(0, allNames.length > MAX_ITEMS ? MAX_ITEMS - 1 : MAX_ITEMS);
  for (const key of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    // Do not invoke getters or custom serialization on diagnostic objects.
    const next = diagnosticProperty(value, key, descriptor);
    result[key] = SENSITIVE_KEY.test(key) ? "[REDACTADO]" : normalize(next, depth + 1, ancestors);
  }
  if (names.length < allNames.length) Object.assign(result, truncation("object", allNames.length, names.length));
  return result;
}

function diagnosticProperty(value: object, key: string, descriptor?: PropertyDescriptor): unknown {
  if (descriptor && "value" in descriptor) return descriptor.value;
  // Chromium lazily exposes Error.stack through a native accessor.
  if (value instanceof Error && key === "stack" && descriptor?.get
    && Function.prototype.toString.call(descriptor.get).includes("[native code]")) {
    try { return descriptor.get.call(value); } catch { return "[Stack no disponible]"; }
  }
  return "[Accesor omitido]";
}

function normalize(value: unknown, depth: number, ancestors: WeakSet<object>): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "… [Truncado]" : value;
  if (typeof value === "function" || typeof value === "symbol") return String(value);
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  return objectValue(value, depth, ancestors);
}

export function safeReportValue(value: unknown): unknown {
  try {
    return normalize(value, 0, new WeakSet());
  } catch {
    return "[No se pudo extraer el dato]";
  }
}

export function safeReportRecord(value: unknown): Record<string, unknown> | undefined {
  const result = safeReportValue(value);
  return result && typeof result === "object" && !Array.isArray(result)
    ? result as Record<string, unknown> : undefined;
}

export function safeReportJson(value: unknown): string {
  return JSON.stringify(safeReportValue(value), null, 2) ?? "null";
}
