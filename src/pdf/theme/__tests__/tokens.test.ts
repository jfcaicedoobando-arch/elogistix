import { expect, it, describe } from "vitest";
import { COLORS, FONTS } from "../tokens";

describe("pdf/theme/tokens", () => {
  it("debe exportar objeto COLORS con paleta corporativa", () => {
    expect(COLORS).toBeDefined();
    expect(COLORS.primary).toBe("#0F4C81");
    expect(COLORS.ink).toBeDefined();
    expect(COLORS.muted).toBeDefined();
    expect(COLORS.border).toBeDefined();
  });

  it("debe exportar objeto FONTS con tipografías built-in", () => {
    expect(FONTS).toBeDefined();
    expect(FONTS.regular).toBe("Helvetica");
    expect(FONTS.bold).toBe("Helvetica-Bold");
  });
});
