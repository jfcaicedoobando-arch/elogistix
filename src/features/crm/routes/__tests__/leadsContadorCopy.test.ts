import { describe, it, expect } from "vitest";
import { copiaContadorLeads } from "@/features/crm/routes/leadsContadorCopy";

describe("copiaContadorLeads", () => {
  it("contador de leads: usa singular con 1", () => {
    expect(copiaContadorLeads(1, false)).toBe("1 lead en cartera");
    expect(copiaContadorLeads(1, true)).toBe("1 lead coincide con los filtros");
  });

  it("usa plural con 0", () => {
    expect(copiaContadorLeads(0, false)).toBe("0 leads en cartera");
    expect(copiaContadorLeads(0, true)).toBe("0 leads coinciden con los filtros");
  });

  it("usa plural con varios", () => {
    expect(copiaContadorLeads(7, false)).toBe("7 leads en cartera");
    expect(copiaContadorLeads(7, true)).toBe("7 leads coinciden con los filtros");
  });
});
