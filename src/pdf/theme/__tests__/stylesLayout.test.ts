import { expect, it, describe } from "vitest";
import { layoutStyles } from "../stylesLayout";

describe("pdf/theme/stylesLayout", () => {
  it("debe definir estilos de página y bandas", () => {
    expect(layoutStyles.page).toBeDefined();
    expect(layoutStyles.topBand).toBeDefined();
  });

  it("debe definir estilos de header y brand", () => {
    expect(layoutStyles.header).toBeDefined();
    expect(layoutStyles.brandBlock).toBeDefined();
  });

  it("debe definir estilos de footer y numeración", () => {
    expect(layoutStyles.footer).toBeDefined();
    expect(layoutStyles.pageNumber).toBeDefined();
  });
});
