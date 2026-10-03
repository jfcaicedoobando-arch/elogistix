import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sonnerLegacyPaths } from "../../../../scripts/lib/sonnerLegacyPaths.ts";

const fixture = [
  "    // SONNER-LEGACY",
  '    ignores: ["src/features/legacy.ts", "src/features/__tests__/**"],',
  "    },",
  '    ignores: ["src/lib/date/mx.ts"],',
  "",
].join("\n");

describe("Sonner baseline line endings", () => {
  it.each(["LF", "CRLF", "mixed"])("bounds the allowlist with %s", (format) => {
    const input = format === "CRLF" ? fixture.replace(/\n/g, "\r\n")
      : format === "mixed" ? fixture.replace("    },\n", "    },\r\n") : fixture;
    expect(sonnerLegacyPaths(input)).toEqual(["src/features/legacy.ts"]);
  });

  it("keeps the real empty baseline identical in Linux and Windows", () => {
    const config = readFileSync(new URL("../../../../eslint.config.js", import.meta.url), "utf8");
    const lf = config.replace(/\r\n?/g, "\n");
    expect(sonnerLegacyPaths(lf)).toEqual([]);
    expect(sonnerLegacyPaths(lf.replace(/\n/g, "\r\n"))).toEqual([]);
  });

  it("fails closed instead of scanning unrelated allowlists", () => {
    expect(() => sonnerLegacyPaths("no marker")).toThrow(/marker/);
    expect(() => sonnerLegacyPaths("// SONNER-LEGACY\n")).toThrow(/fin del bloque/);
  });
});
