import { describe, expect, it } from "vitest";
import type { StreamedSpanJSON } from "@sentry/core";
import { scrubEventPii } from "../helpers";
import { scrubSpanPii } from "../spanPrivacy";
import { scrubTelemetryData } from "../../scrubTelemetryData";

describe("Sentry manual metadata privacy", () => {
  it("cleans extra, contexts, cause metadata and camelCase credentials", () => {
    const out = scrubEventPii({
      type: undefined,
      extra: { original: { accessToken: "MOCK_TOKEN", customerEmail: "mock@example.invalid" },
        queryKey: ["clientes", { filter: "RFC XAXX010101000 / mock@example.invalid" }] },
      contexts: { Error: { details: "mock@example.invalid", cause: { apiKey: "MOCK_API_KEY" } } },
    });
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/MOCK_TOKEN|MOCK_API_KEY|mock@example.invalid|XAXX010101000/);
    expect(json).toContain("clientes");
  });

  it("preserves useful scalar data and opaque IDs while bounding cyclic metadata", () => {
    const value: Record<string, unknown> = { amount: 872.61, pg_code: "42703",
      organization_id: "00000000-0000-0000-0000-000000000001" };
    value.self = value;
    expect(scrubTelemetryData(value)).toEqual({ ...value, self: "[Circular]" });
  });

  it("cleans the SDK 11 streamed span shape, including links", () => {
    const span: StreamedSpanJSON = {
      trace_id: "0".repeat(32), span_id: "0".repeat(16), start_timestamp: 1,
      status: "ok", is_segment: true,
      name: "/embarques/00000000-0000-0000-0000-000000000001",
      attributes: { "http.url": "https://mock.invalid/?api_key=MOCK_KEY&email=mock@example.invalid",
        "sentry.op": "navigation", details: "RFC XAXX010101000", amount: 872.61 },
      links: [{ trace_id: "1".repeat(32), span_id: "1".repeat(16),
        attributes: { accessToken: "MOCK_LINK_TOKEN" } }],
    };
    const out = scrubSpanPii(span);
    expect(out.name).toBe("/embarques/:id");
    expect(out.attributes.amount).toBe(872.61);
    expect(JSON.stringify(out)).not.toMatch(/MOCK_KEY|MOCK_LINK_TOKEN|mock@example.invalid|XAXX010101000/);
  });
});
