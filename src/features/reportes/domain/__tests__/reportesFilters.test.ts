import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { defaultReportesFilters, readReportesSelection, writeReportesSelection } from "../reportesFilters";

const defaults = defaultReportesFilters(new Date(2026, 9, 6));
describe("Rentabilidad URL selection", () => {
  it("reads calendar dates in local time and retains mode and order", () => {
    const value = readReportesSelection(new URLSearchParams("desde=2026-10-15&hasta=2026-10-20&modo=Terrestre&sort=costo_usd&dir=desc"), defaults);
    expect(format(value.fechaDesde, "yyyy-MM-dd")).toBe("2026-10-15");
    expect(format(value.fechaHasta, "yyyy-MM-dd")).toBe("2026-10-20");
    expect(value).toMatchObject({ modo: "Terrestre", sortField: "costo_usd", sortDir: "desc" });
  });
  it.each(["desde=bad&hasta=2026-02-30", "desde=2026-13-01&hasta=invalid", "desde=2026-10-01T00:00:00Z"])("rejects invalid dates %s", (query) => {
    const value = readReportesSelection(new URLSearchParams(query), defaults);
    expect(value.fechaDesde).toEqual(defaults.fechaDesde);
    expect(value.fechaHasta).toEqual(defaults.fechaHasta);
  });
  it("normalizes inverted ranges and unknown modes/sorting before querying", () => {
    const value = readReportesSelection(new URLSearchParams("desde=2026-11-10&hasta=2026-10-20&modo=invalid&sort=constructor&dir=wrong"), defaults);
    expect(format(value.fechaHasta, "yyyy-MM-dd")).toBe("2026-11-30");
    expect(value).toMatchObject({ modo: "all", sortField: "profit_usd", sortDir: "asc" });
  });
  it("writes a whole selection atomically without losing unrelated URL parameters", () => {
    const params = new URLSearchParams("tab=rentabilidad");
    const selection = readReportesSelection(new URLSearchParams("desde=2026-10-15&hasta=2026-10-20&modo=Terrestre&sort=margen&dir=desc"), defaults);
    const written = writeReportesSelection(params, selection);
    expect(written.get("tab")).toBe("rentabilidad");
    expect(readReportesSelection(written, defaults)).toEqual(selection);
    expect(params.toString()).toBe("tab=rentabilidad");
  });
});
