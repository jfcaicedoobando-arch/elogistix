import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COLORS, FONTS } from "../tokens";

describe("PDF brand contract", () => {
  it("uses the app's Inter family with locally licensed assets", () => {
    const app = readFileSync(resolve("tailwind.config.ts"), "utf8");
    expect(app).toContain('sans: ["Inter", "sans-serif"]');
    expect(FONTS.regular).toBe("Inter");
    for (const file of ["Inter-Regular.ttf", "Inter-SemiBold.ttf", "Inter-Italic.ttf", "Inter-OFL.txt"]) {
      expect(existsSync(resolve("src/pdf/assets", file))).toBe(true);
    }
    expect(readFileSync(resolve("src/pdf/assets/Inter-OFL.txt"), "utf8")).toContain("SIL OPEN FONT LICENSE");
    expect(readFileSync(resolve("public/licenses/inter/OFL.txt"), "utf8")).toBe(readFileSync(resolve("src/pdf/assets/Inter-OFL.txt"), "utf8"));
  });
  it("keeps app brand hues and readable text instead of pale labels", () => {
    const css = readFileSync(resolve("src/index.css"), "utf8");
    expect(css).toContain("--primary: 216 47% 20%");
    expect(css).toContain("--accent: 221 83% 53%");
    expect(COLORS.primary).toBe("#1B2E4B");
    expect(COLORS.accent).toBe("#2463EB");
    expect(COLORS.mutedLight).toBe(COLORS.muted);
  });
});
