import type { StreamedSpanJSON } from "@sentry/core";
import { scrubTelemetryData, scrubTelemetryText } from "../scrubTelemetryData";

/** SDK 11 streams spans; transaction callbacks do not participate. */
export function scrubSpanPii(span: StreamedSpanJSON): StreamedSpanJSON {
  const normalizedName = span.name.replace(
    /[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, ":id",
  );
  span.name = scrubTelemetryText(normalizedName);
  span.attributes = scrubTelemetryData(span.attributes) as typeof span.attributes;
  if (span.links) {
    span.links = span.links.map((link) => ({ ...link,
      attributes: scrubTelemetryData(link.attributes) as typeof link.attributes,
    }));
  }
  return span;
}
