import { expect, it, describe } from "vitest";
import { contentStyles } from "../stylesContent";

describe("pdf/theme/stylesContent", () => {
  it("debe contener definiciones de encabezados (h1, h3, h4)", () => {
    expect(contentStyles.h1).toBeDefined();
    expect(contentStyles.h3).toBeDefined();
    expect(contentStyles.h4).toBeDefined();
  });

  it("debe contener definiciones de tabla (table, th, td)", () => {
    expect(contentStyles.table).toBeDefined();
    expect(contentStyles.th).toBeDefined();
    expect(contentStyles.td).toBeDefined();
  });

  it("debe contener definiciones de KPIs y notas", () => {
    expect(contentStyles.kpiRow).toBeDefined();
    expect(contentStyles.notesBox).toBeDefined();
  });
});
