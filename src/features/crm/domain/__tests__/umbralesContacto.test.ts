/**
 * Auditoría CRM: el concepto "lead sin contactar" tiene DOS umbrales
 * deliberados — NBA (Mi día) >24h y tarjeta semanal >7 días — y los textos
 * visibles (FAQ, tarjeta) deben reflejar exactamente esos valores.
 */
import { describe, it, expect } from "vitest";
import {
  NBA_LEAD_SIN_CONTACTAR_HORAS,
  SEMANA_LEAD_SIN_CONTACTAR_DIAS,
} from "../umbralesContacto";
import { MODULOS } from "@/features/dashboard/routes/ayudaModulos";

describe("umbrales de 'lead sin contactar'", () => {
  it("los umbrales canónicos siguen siendo 24h (NBA) y 7 días (semana)", () => {
    expect(NBA_LEAD_SIN_CONTACTAR_HORAS).toBe(24);
    expect(SEMANA_LEAD_SIN_CONTACTAR_DIAS).toBe(7);
  });

  it("la FAQ de NBA explica ambos umbrales y deja de decir '3 días'", () => {
    const crm = MODULOS.find((m) => m.id === "crm");
    const faq = crm?.faqs.find((f) => f.pregunta.includes("Next Best Actions"));
    expect(faq).toBeDefined();
    expect(faq?.respuesta).toContain(`${NBA_LEAD_SIN_CONTACTAR_HORAS} horas`);
    expect(faq?.respuesta).toContain(`${SEMANA_LEAD_SIN_CONTACTAR_DIAS} días`);
    expect(faq?.respuesta).not.toContain("3 días");
  });
});
