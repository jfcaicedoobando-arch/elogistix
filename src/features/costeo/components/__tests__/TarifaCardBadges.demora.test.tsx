import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { TopTarifaRow } from "@/features/costeo/types";
vi.mock("../CartaGarantiaIndicator", () => ({ CartaGarantiaIndicator: () => null }));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
import { TarifaCardBadges } from "../TarifaCardBadges";
const row = {
  dias_credito: 0, dias_libres_demoras: 11, transit_time_dias: null,
  naviera_demora_dia_6: 7, naviera_demora_desde_dia: 6, naviera_demora_hasta_dia: 10,
} as TopTarifaRow;
describe("AUD147: native currency and actual day-6 bracket", () => {
  it.each(["MXN", "USD", "EUR"])("labels native %s without converting or inferring the first overdue day", (currency) => {
    render(<TarifaCardBadges row={{ ...row, naviera_demora_moneda: currency }} />);
    const badge = screen.getByText(/Demora \(día 6\):/);
    expect(badge).toHaveTextContent(currency);
    expect(badge).toHaveTextContent("7.00");
    if (currency !== "USD") expect(badge).not.toHaveTextContent("USD");
    expect(screen.queryByText(/Demora desde el día 12/)).toBeNull();
    expect(screen.getByText(/Tramo desde el día 6 hasta el 10/)).toBeTruthy();
  });
  it.each([null, undefined, "", "   "])("does not invent USD for missing currency %j", (currency) => {
    render(<TarifaCardBadges row={{ ...row, naviera_demora_moneda: currency }} />);
    expect(screen.getByText(/Moneda de demora no disponible/)).not.toHaveTextContent("USD");
  });
  it("keeps a genuine zero tariff and an open-ended bracket", () => {
    render(<TarifaCardBadges row={{ ...row, naviera_demora_dia_6: 0, naviera_demora_moneda: "MXN", naviera_demora_hasta_dia: null }} />);
    expect(screen.getByText(/Demora \(día 6\):/)).toHaveTextContent("0.00");
    expect(screen.getByText(/Tramo desde el día 6 en adelante/)).toBeTruthy();
  });
  it("omits a badge when no bracket covers day 6", () => {
    render(<TarifaCardBadges row={{ ...row, naviera_demora_dia_6: null }} />);
    expect(screen.queryByText(/Demora \(día 6\):/)).toBeNull();
  });
});
