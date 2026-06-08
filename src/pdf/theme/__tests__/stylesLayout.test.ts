import { expect, it, describe } from "vitest";
import { layoutStyles } from "../stylesLayout";
import { COLORS } from "../styles";

describe("pdf/theme/stylesLayout", () => {
  it("page tiene márgenes 40/56/36 y fontSize 10", () => {
    expect(layoutStyles.page.paddingTop).toBe(40);
    expect(layoutStyles.page.paddingBottom).toBe(56);
    expect(layoutStyles.page.paddingHorizontal).toBe(36);
    expect(layoutStyles.page.fontSize).toBe(10);
  });

  it("topBand usa color primario como fondo", () => {
    expect(layoutStyles.topBand.backgroundColor).toBe(COLORS.primary);
  });

  it("footer y pageNumber con fontSize chico (7-8pt)", () => {
    expect(layoutStyles.footer.fontSize).toBe(7.5);
    expect(layoutStyles.pageNumber.fontSize).toBe(8);
  });
});
