/** Bounded, shared redaction for manually supplied error/span metadata. */
import { scrubPii, scrubUrl } from "./piiScrub.ts";

const PRIVATE_KEYS = new Set(["pass", "auth", "rfc", "curp", "email", "phone", "telefono", "ssn", "ipaddress",
  "taxid", "phonenumber", "pan", "cardnumber", "cvv", "clabe", "iban", "accountnumber",
  "direccion", "domicilio", "address", "billingaddress", "firstname", "lastname", "customername", "contactname"]);
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const MAX_DEPTH = 8;
const MAX_NODES = 1000;

export function isPrivateTelemetryKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return PRIVATE_KEYS.has(normalized) || /password|secret|token|authorization|cookie|apikey/.test(normalized)
    || /(?:email|rfc|curp)$/.test(normalized);
}

export function scrubTelemetryText(value: string): string {
  // Valid opaque IDs remain useful in metadata; credentials are removed by key.
  if (UUID.test(value)) return value;
  const withoutSecrets = value
    .replace(/\bBearer\s+[^\s,;"']+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:api[_-]?key|password|secret|(?:access[_-]?|refresh[_-]?)?token|signature)=)[^\s&#"']*/gi, "$1[REDACTED]");
  const isUrl = /^(?:https?:\/\/|\/)/i.test(withoutSecrets);
  return (isUrl ? scrubUrl(withoutSecrets) : scrubPii(withoutSecrets)) ?? "";
}

export function scrubTelemetryData(value: unknown): unknown {
  const ancestors = new WeakSet<object>();
  let visited = 0;
  const walk = (input: unknown, depth: number): unknown => {
    if (++visited > MAX_NODES || depth > MAX_DEPTH) return "[Truncated]";
    if (typeof input === "string") return scrubTelemetryText(input);
    if (typeof input === "bigint") return input.toString();
    if (input instanceof Date) return input.toISOString();
    if (input === null || typeof input !== "object") return input;
    if (ancestors.has(input)) return "[Circular]";
    ancestors.add(input);
    const out: unknown[] | Record<string, unknown> = Array.isArray(input) ? [] : {};
    for (const key of Object.keys(input)) {
      if (visited >= MAX_NODES) break;
      ++visited;
      const item = (input as Record<string, unknown>)[key];
      const clean = isPrivateTelemetryKey(key) ? "[REDACTED]" : walk(item, depth + 1);
      if (Array.isArray(out)) out.push(clean);
      else out[key] = clean;
    }
    ancestors.delete(input);
    return out;
  };
  return walk(value, 0);
}
