import { expect, it, describe } from "vitest";
import { contentStyles } from "../stylesContent";
import { COLORS, FONTS } from "../styles";

describe("pdf/theme/stylesContent", () => {
  it("h1 = 16pt bold con color primario", () => {
    expect(contentStyles.h1.fontSize).toBe(16);
    expect(contentStyles.h1.fontFamily).toBe(FONTS.bold);
    expect(contentStyles.h1.color).toBe(COLORS.primary);
  });

  it("h3 = 10pt y h4 = 10pt bold", () => {
    expect(contentStyles.h3.fontSize).toBe(10);
    expect(contentStyles.h4.fontSize).toBe(10);
    expect(contentStyles.h4.fontFamily).toBe(FONTS.bold);
  });

  it("tableHeader usa color primario y td tiene padding interior", () => {
    expect(contentStyles.tableHeader.backgroundColor).toBe(COLORS.primary);
    expect(contentStyles.td.fontSize).toBe(9);
    expect(contentStyles.td.paddingVertical).toBe(5);
    expect(contentStyles.td.paddingHorizontal).toBe(7);
  });

  it("kpiValue es 13pt bold en color primario", () => {
    expect(contentStyles.kpiValue.fontSize).toBe(13);
    expect(contentStyles.kpiValue.color).toBe(COLORS.primary);
    expect(contentStyles.kpiValue.fontFamily).toBe(FONTS.bold);
  });

  it("notesBox tiene padding=10 y fondo zebra", () => {
    expect(contentStyles.notesBox.padding).toBe(10);
    expect(contentStyles.notesBox.backgroundColor).toBe(COLORS.zebra);
  });
});
