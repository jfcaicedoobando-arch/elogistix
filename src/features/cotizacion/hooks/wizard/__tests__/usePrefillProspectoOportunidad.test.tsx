/**
 * CRM-COT-01 — la precarga desde una oportunidad de prospecto debe llevar al
 * formulario los datos REALES disponibles (destinatario, teléfono, IDs, modo y
 * ruta, moneda), sin inventar lo que el CRM no tiene y sin pisar captura manual.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types/form";
import { COTIZACION_FORM_DEFAULTS } from "@/features/cotizacion/types/formDefaults";

const match = { data: null as unknown };
vi.mock("@/features/crm/hooks/useCrmProspectoOportunidad", () => ({
  useCrmProspectoOportunidad: () => match,
}));

import { usePrefillProspectoOportunidad } from "../usePrefillProspectoOportunidad";

const MATCH_COMPLETO = {
  kind: "oportunidad" as const,
  id: "op-1",
  empresa: "Acme Logistics",
  contacto: "Ana Pérez",
  email: "ana@acme.com",
  telefono: "5555555555",
  leadId: "lead-1",
  moneda: "USD",
  modo: "Marítimo",
  origen: "Shanghai",
  destino: "Manzanillo",
};

function renderPrefill(opts: { enabled?: boolean; iniciales?: Partial<CotizacionFormValues> } = {}) {
  return renderHook(() => {
    const form = useForm<CotizacionFormValues>({
      defaultValues: { ...COTIZACION_FORM_DEFAULTS, ...opts.iniciales },
    });
    usePrefillProspectoOportunidad({
      form,
      oportunidadId: "op-1",
      enabled: opts.enabled ?? true,
    });
    return form;
  });
}

beforeEach(() => {
  match.data = null;
});

describe("usePrefillProspectoOportunidad", () => {
  it("entrada limpia: precarga destinatario, IDs, modo/ruta y moneda", async () => {
    match.data = MATCH_COMPLETO;
    const { result } = renderPrefill();
    await waitFor(() => expect(result.current.getValues("oportunidadId")).toBe("op-1"));
    const v = result.current.getValues();
    expect(v.esProspecto).toBe(true);
    expect(v.leadId).toBe("lead-1");
    expect(v.prospectoEmpresa).toBe("Acme Logistics");
    expect(v.prospectoContacto).toBe("Ana Pérez");
    expect(v.prospectoEmail).toBe("ana@acme.com");
    expect(v.prospectoTelefono).toBe("5555555555");
    expect(v.modo).toBe("Marítimo");
    expect(v.origen).toBe("Shanghai");
    expect(v.destino).toBe("Manzanillo");
    expect(v.monedaCrm).toBe("USD");
  });

  it("no inventa datos: modo no equivalente y ruta vacía dejan los valores del formulario", async () => {
    match.data = { ...MATCH_COMPLETO, modo: "FCL", origen: null, destino: null, moneda: "EUR", telefono: "" };
    const { result } = renderPrefill();
    await waitFor(() => expect(result.current.getValues("oportunidadId")).toBe("op-1"));
    const v = result.current.getValues();
    expect(v.modo).toBe(COTIZACION_FORM_DEFAULTS.modo);
    expect(v.origen).toBe(COTIZACION_FORM_DEFAULTS.origen);
    expect(v.destino).toBe(COTIZACION_FORM_DEFAULTS.destino);
    expect(v.monedaCrm).toBe("");
    expect(v.prospectoTelefono).toBe("");
  });

  it("deshabilitado (borrador pendiente o restaurado): no toca el formulario", async () => {
    match.data = MATCH_COMPLETO;
    const { result } = renderPrefill({ enabled: false });
    await waitFor(() => expect(result.current.getValues("oportunidadId")).toBe(""));
    expect(result.current.getValues("prospectoEmpresa")).toBe("");
  });

  it("respeta la captura manual del usuario (cliente ya elegido)", async () => {
    match.data = MATCH_COMPLETO;
    const { result } = renderPrefill({ iniciales: { clienteId: "cli-9" } });
    await waitFor(() => expect(result.current.getValues("clienteId")).toBe("cli-9"));
    expect(result.current.getValues("oportunidadId")).toBe("");
    expect(result.current.getValues("prospectoEmpresa")).toBe("");
  });

  it("respuesta tardía del CRM no pisa captura manual de modo/ruta ni mezcla el vínculo", async () => {
    // match aún pendiente (null): el usuario captura modo y ruta sin vínculo.
    const { result, rerender } = renderPrefill();
    result.current.setValue("modo", "Aéreo", { shouldDirty: true });
    result.current.setValue("origen", "Veracruz", { shouldDirty: true });
    result.current.setValue("destino", "Houston", { shouldDirty: true });
    // Ahora llega la respuesta del CRM.
    match.data = MATCH_COMPLETO;
    rerender();
    await waitFor(() => expect(result.current.getValues("modo")).toBe("Aéreo"));
    const v = result.current.getValues();
    expect(v.origen).toBe("Veracruz");
    expect(v.destino).toBe("Houston");
    // Sin mezcla silenciosa: no se escribe el vínculo ni el destinatario.
    expect(v.oportunidadId).toBe("");
    expect(v.leadId).toBe("");
    expect(v.esProspecto).toBe(COTIZACION_FORM_DEFAULTS.esProspecto);
    expect(v.prospectoEmpresa).toBe("");
    expect(v.monedaCrm).toBe("");
  });

  it("entrada limpia con respuesta tardía: sí precarga todo", async () => {
    const { result, rerender } = renderPrefill();
    match.data = MATCH_COMPLETO;
    rerender();
    await waitFor(() => expect(result.current.getValues("oportunidadId")).toBe("op-1"));
    expect(result.current.getValues("origen")).toBe("Shanghai");
    expect(result.current.getValues("prospectoEmpresa")).toBe("Acme Logistics");
  });

  it("sin oportunidad elegible (no elegible / sin permisos) no precarga nada", async () => {
    match.data = null;
    const { result } = renderPrefill();
    await waitFor(() => expect(result.current.getValues("oportunidadId")).toBe(""));
    expect(result.current.getValues("esProspecto")).toBe(COTIZACION_FORM_DEFAULTS.esProspecto);
  });

});
