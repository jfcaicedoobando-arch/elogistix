import { expect, it, describe } from "vitest";
import { styles, COLORS, FONTS } from "../styles";

describe("pdf/theme/styles", () => {
  it("agrega contentStyles y layoutStyles en un único StyleSheet", () => {
    expect(styles.page).toBeDefined();
    expect(styles.header).toBeDefined();
    expect(styles.h1).toBeDefined();
    expect(styles.table).toBeDefined();
  });

  it("respeta el fontSize base de la página (10pt)", () => {
    expect(styles.page.fontSize).toBe(10);
  });

  it("usa el color primario en h1", () => {
    expect(styles.h1.color).toBe(COLORS.primary);
  });

  it("exporta tokens COLORS y FONTS no vacíos", () => {
    expect(COLORS.primary).toEqual(expect.any(String));
    expect(FONTS.bold).toEqual(expect.any(String));
  });
});
