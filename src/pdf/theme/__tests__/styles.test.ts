import { expect, it, describe } from "vitest";
import { styles, COLORS, FONTS } from "../styles";

describe("pdf/theme/styles", () => {
  it("debe exportar StyleSheet con estilos básicos de layout y contenido", () => {
    expect(styles).toBeDefined();
    expect(styles.page).toBeDefined();
    expect(styles.header).toBeDefined();
    expect(styles.h1).toBeDefined();
    expect(styles.table).toBeDefined();
  });

  it("debe re-exportar tokens", () => {
    expect(COLORS).toBeDefined();
    expect(FONTS).toBeDefined();
  });
});
