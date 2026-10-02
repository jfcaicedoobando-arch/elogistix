import { describe, it, expect } from "vitest";
import { calcularReloj } from "../relojPricing";
import { mensajeErrorPricing, OPCION_VACIA } from "../tiposPricing";
import { opcionDesdeTarifa } from "../tarifasParaPricing";
import { esRolPricing } from "../permisosPricing";
import { solicitudCompleta } from "@/features/crm/components/pricing/SolicitudPricingDialog";

const enviada = "2026-10-01T10:00:00Z";
const vence = "2026-10-01T18:00:00Z"; // 8 h

describe("reloj de Pricing", () => {
  it("verde, amarillo y rojo según el tiempo restante", () => {
    const r = (h: string) => calcularReloj({ enviadaAt: enviada, venceAt: vence, respondidaAt: null, ahora: new Date(h) })?.nivel;
    expect(r("2026-10-01T11:00:00Z")).toBe("ok");
    expect(r("2026-10-01T16:30:00Z")).toBe("alerta");
    expect(r("2026-10-01T19:00:00Z")).toBe("vencida");
  });
  it("se detiene al responder y marca si fue fuera de tiempo", () => {
    const x = calcularReloj({ enviadaAt: enviada, venceAt: vence, respondidaAt: "2026-10-01T20:30:00Z", ahora: new Date() });
    expect(x?.nivel).toBe("detenida");
    expect(x?.texto).toBe("Respondida en 10 h 30 min (fuera de tiempo)");
  });
  it("sin enviar no hay reloj", () => {
    expect(calcularReloj({ enviadaAt: null, venceAt: null, respondidaAt: null, ahora: new Date() })).toBeNull();
  });
});

describe("reglas de Pricing", () => {
  it("traduce errores de la base", () => {
    expect(mensajeErrorPricing(new Error("LC_PRICING_SIN_OPCIONES"))).toMatch(/al menos una opción/);
    expect(mensajeErrorPricing(new Error("otra cosa"))).toBe("No se pudo completar la acción.");
  });
  it("solicitud completa = servicio + origen/POL + destino/POD", () => {
    expect(solicitudCompleta({ solicitante_id: "u", servicio: "Marítimo", pol: "CNSHA", destino: "Manzanillo" })).toBe(true);
    expect(solicitudCompleta({ solicitante_id: "u", servicio: "Marítimo", pol: " ", destino: "Manzanillo" })).toBe(false);
  });
  it("copiar tarifa llena flete y conserva otros cargos", () => {
    const base = { ...OPCION_VACIA, recoleccion_tarifa: 500 };
    const o = opcionDesdeTarifa(base, { id: "t1", naviera_id: "n1", moneda: "USD", flete_base: 1800, transit_time_dias: 28, agente: "Ag", naviera: "MSC" });
    expect(o).toMatchObject({ tarifa_id: "t1", of_tarifa: 1800, of_moneda: "USD", naviera_id: "n1", transito: "28 días", recoleccion_tarifa: 500 });
  });
  it("roles de Pricing", () => {
    expect(esRolPricing("ejecutivo_pricing")).toBe(true);
    expect(esRolPricing("vendedor")).toBe(false);
  });
});
