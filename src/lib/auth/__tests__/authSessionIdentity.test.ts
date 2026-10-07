import { describe, expect, it } from "vitest";
import { readAuthSessionIdentity } from "../authSessionIdentity";
const token = (payload: unknown) => `mock.${btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.mock`;
describe("non-secret session cache identity", () => {
  it("extracts stable session_id without depending on rotating token metadata", () => {
    expect(readAuthSessionIdentity(token({ session_id: "session-a", exp: 1 }))).toBe("session-a");
    expect(readAuthSessionIdentity(token({ session_id: "session-a", exp: 2 }))).toBe("session-a");
  });
  it.each([undefined, "invalid", "mock.!.mock", token(null), token({}), token({ session_id: 123 }), token({ session_id: "" }), token({ session_id: "x".repeat(129) })])("fails closed on unavailable/invalid metadata %s", (value) => {
    expect(readAuthSessionIdentity(value)).toBeNull();
  });
});
