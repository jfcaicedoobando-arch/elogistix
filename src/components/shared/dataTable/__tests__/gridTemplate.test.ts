import { describe, expect, it } from "vitest";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import {
  FLEX_COL,
  gridTemplateFromWidths,
  widthToTrack,
} from "@/components/shared/dataTable/gridTemplate";

describe("widthToTrack", () => {
  it("convierte anchos fijos arbitrarios a la longitud CSS", () => {
    expect(widthToTrack(COL_W.fecha)).toBe("104px");
    expect(widthToTrack("w-[56px]")).toBe("56px");
  });

  it("convierte min-w-[..] a minmax flexible", () => {
    expect(widthToTrack(COL_W.texto)).toBe("minmax(200px,1fr)");
  });

  it("convierte la escala de spacing de Tailwind a rem", () => {
    expect(widthToTrack("w-24")).toBe("6rem");
    expect(widthToTrack("min-w-40")).toBe("minmax(10rem,1fr)");
  });

  it("cae a columna flexible con valores desconocidos o vacíos", () => {
    expect(widthToTrack(undefined)).toBe(FLEX_COL);
    expect(widthToTrack("w-full")).toBe(FLEX_COL);
    expect(widthToTrack("truncate")).toBe(FLEX_COL);
  });

  it("nunca deja clases Tailwind crudas en el grid-template", () => {
    const template = gridTemplateFromWidths([COL_W.fecha, undefined, COL_W.monto, "w-24"]);
    expect(template).toBe("104px minmax(0,1fr) 128px 6rem");
    expect(template).not.toMatch(/w-/);
  });
});
